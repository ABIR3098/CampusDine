// Group orders: one shared cart, one pickup, and the bill is split between everyone's own wallets.
const express = require("express");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { withTransaction } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { loadSettings } = require("../utils/settings");
const { lockAndPrice, reserveSlot, surplusActive, dealPrice, round2 } = require("../utils/ordering");
const { slotList, isPast } = require("../utils/slots");
const { todayStr, addDays, isDateOnly } = require("../utils/dates");
const { pushNotification } = require("../utils/notify");

const router = express.Router();
router.use(verifyToken, requireRole("student", "teacher"));
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const MAX_MEMBERS = 10;
const newCode = () => Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");

async function getGroup(q, code, { lock = false } = {}) {
  const [rows] = await q.query(`SELECT g.*, u.name AS host_name FROM group_orders g JOIN users u ON u.id = g.host_id WHERE g.code = ? ${lock ? "FOR UPDATE" : ""}`, [String(code || "").trim().toUpperCase()]);
  if (!rows.length) throw { status: 404, message: "Group not found" };
  return rows[0];
}
async function requireMember(q, g, userId) {
  const [m] = await q.query("SELECT confirmed FROM group_members WHERE group_id = ? AND user_id = ?", [g.id, userId]);
  if (!m.length) throw { status: 403, message: "Join this group first" };
  return m[0];
}
const resetConfirmations = (q, groupId) => q.query("UPDATE group_members SET confirmed = 0 WHERE group_id = ?", [groupId]);

// Everything the UI needs: members, items, current prices, each person's share.
async function view(q, g, viewerId) {
  const S = await loadSettings(q);
  const [members] = await q.query("SELECT gm.user_id, gm.confirmed, u.name FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ? ORDER BY gm.joined_at", [g.id]);
  const [rows] = await q.query("SELECT gi.user_id, gi.menu_item_id, gi.qty, mi.name, mi.price, mi.stock, mi.surplus_eligible, u.name AS user_name FROM group_items gi JOIN menu_items mi ON mi.id = gi.menu_item_id JOIN users u ON u.id = gi.user_id WHERE gi.group_id = ? ORDER BY gi.user_id, mi.name", [g.id]);
  const deal = surplusActive(S, String(g.meal_date).slice(0, 10));
  const items = rows.map((r) => { const unit = deal && r.surplus_eligible ? dealPrice(r.price, S) : Number(r.price); return { userId: r.user_id, userName: r.user_name, itemId: r.menu_item_id, name: r.name, qty: r.qty, unit, line: round2(unit * r.qty), stock: r.stock }; });
  const total = round2(items.reduce((s, i) => s + i.line, 0));
  const shares = new Map();
  if (g.split_mode === "own") members.forEach((m) => shares.set(m.user_id, round2(items.filter((i) => i.userId === m.user_id).reduce((s, i) => s + i.line, 0))));
  else {
    const base = Math.floor((total * 100) / Math.max(members.length, 1)) / 100;
    members.forEach((m) => shares.set(m.user_id, base));
    shares.set(g.host_id, round2(base + (total - base * members.length))); // the host absorbs the odd cent
  }
  return {
    id: g.id, code: g.code, name: g.name, splitMode: g.split_mode, status: g.status, mealDate: String(g.meal_date).slice(0, 10), pickupSlot: g.pickup_slot, orderId: g.order_id,
    host: { id: g.host_id, name: g.host_name }, isHost: g.host_id === viewerId, total, items,
    members: members.map((m) => ({ userId: m.user_id, name: m.name, confirmed: Boolean(m.confirmed), isHost: m.user_id === g.host_id, share: shares.get(m.user_id) || 0 })),
    allConfirmed: members.length > 0 && members.every((m) => m.confirmed), myConfirmed: Boolean(members.find((m) => m.user_id === viewerId)?.confirmed),
  };
}

router.post("/", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const mealDate = req.body.mealDate || todayStr();
  const pickupSlot = req.body.pickupSlot || null;
  const splitMode = req.body.splitMode === "own" ? "own" : "equal";
  if (!name || name.length > 60) return res.status(400).json({ error: "Group name must be 1-60 characters" });
  if (!isDateOnly(mealDate) || mealDate < todayStr() || mealDate > addDays(todayStr(), 30)) return res.status(400).json({ error: "mealDate must be between today and 30 days ahead" });
  if (pickupSlot) {
    const S = await loadSettings(pool);
    if (!slotList(mealDate, S).some((s) => s.time === pickupSlot)) return res.status(400).json({ error: "That pickup time is not available on this date" });
    if (isPast(mealDate, pickupSlot)) return res.status(400).json({ error: "That pickup time has already passed" });
  }
  const [[open]] = await pool.query("SELECT COUNT(*) AS c FROM group_orders WHERE host_id = ? AND status = 'open'", [req.user.id]);
  if (open.c >= 5) return res.status(400).json({ error: "You already host 5 open groups" });
  let g;
  for (let i = 0; i < 5 && !g; i++) {
    try { const [r] = await pool.query("INSERT INTO group_orders (code, host_id, name, split_mode, meal_date, pickup_slot) VALUES (?, ?, ?, ?, ?, ?)", [newCode(), req.user.id, name, splitMode, mealDate, pickupSlot]); g = r.insertId; }
    catch (err) { if (err.code !== "ER_DUP_ENTRY") throw err; }
  }
  if (!g) throw new Error("Could not allocate a group code");
  await pool.query("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", [g, req.user.id]);
  const [[row]] = await pool.query("SELECT code FROM group_orders WHERE id = ?", [g]);
  res.status(201).json(await view(pool, await getGroup(pool, row.code), req.user.id));
});

router.get("/mine", async (req, res) => {
  const [groups] = await pool.query(
    `SELECT g.code, g.name, g.status, g.meal_date, g.pickup_slot, g.order_id, u.name AS host_name, (SELECT COUNT(*) FROM group_members x WHERE x.group_id = g.id) AS members
       FROM group_orders g JOIN group_members m ON m.group_id = g.id AND m.user_id = ? JOIN users u ON u.id = g.host_id
      WHERE g.status = 'open' OR g.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY) ORDER BY g.id DESC LIMIT 20`, [req.user.id]);
  res.json({ groups });
});

router.post("/join", async (req, res) => {
  const out = await withTransaction(async (conn) => {
    const g = await getGroup(conn, req.body.code, { lock: true });
    if (g.status !== "open") throw { status: 409, message: "This group order is already closed" };
    const [[c]] = await conn.query("SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?", [g.id]);
    const [already] = await conn.query("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", [g.id, req.user.id]);
    if (!already.length) {
      if (c.c >= MAX_MEMBERS) throw { status: 409, message: `A group can have at most ${MAX_MEMBERS} people` };
      await conn.query("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", [g.id, req.user.id]);
      await resetConfirmations(conn, g.id);
    }
    return g;
  });
  res.json(await view(pool, out, req.user.id));
});

router.get("/:code", async (req, res) => {
  const g = await getGroup(pool, req.params.code);
  await requireMember(pool, g, req.user.id);
  res.json(await view(pool, g, req.user.id));
});

// PUT { itemId, qty } — set YOUR quantity of an item (0 removes it). Any change asks everyone to re-confirm.
router.put("/:code/items", async (req, res) => {
  const itemId = Number(req.body.itemId), qty = Number(req.body.qty);
  if (!Number.isInteger(itemId) || !Number.isInteger(qty) || qty < 0 || qty > 20) return res.status(400).json({ error: "itemId and qty (0-20) are required" });
  const g = await getGroup(pool, req.params.code);
  await requireMember(pool, g, req.user.id);
  if (g.status !== "open") return res.status(409).json({ error: "This group order is closed" });
  if (qty === 0) await pool.query("DELETE FROM group_items WHERE group_id = ? AND user_id = ? AND menu_item_id = ?", [g.id, req.user.id, itemId]);
  else {
    const S = await loadSettings(pool);
    const [[m]] = await pool.query("SELECT id, is_active, iftar_only, stock FROM menu_items WHERE id = ?", [itemId]);
    if (!m || !m.is_active || (m.iftar_only && !S.ramadan_mode)) return res.status(404).json({ error: "Menu item is not available" });
    if (qty > m.stock) return res.status(409).json({ error: `Only ${m.stock} left` });
    await pool.query("INSERT INTO group_items (group_id, user_id, menu_item_id, qty) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE qty = VALUES(qty)", [g.id, req.user.id, itemId, qty]);
  }
  await resetConfirmations(pool, g.id);
  res.json(await view(pool, g, req.user.id));
});

router.post("/:code/confirm", async (req, res) => {
  const g = await getGroup(pool, req.params.code);
  await requireMember(pool, g, req.user.id);
  if (g.status !== "open") return res.status(409).json({ error: "This group order is closed" });
  await pool.query("UPDATE group_members SET confirmed = ? WHERE group_id = ? AND user_id = ?", [req.body.confirmed === false ? 0 : 1, g.id, req.user.id]);
  res.json(await view(pool, g, req.user.id));
});

router.post("/:code/leave", async (req, res) => {
  const g = await getGroup(pool, req.params.code);
  await requireMember(pool, g, req.user.id);
  if (g.host_id === req.user.id) return res.status(400).json({ error: "The host can't leave — cancel the group instead" });
  if (g.status !== "open") return res.status(409).json({ error: "This group order is closed" });
  await pool.query("DELETE FROM group_items WHERE group_id = ? AND user_id = ?", [g.id, req.user.id]);
  await pool.query("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", [g.id, req.user.id]);
  await resetConfirmations(pool, g.id);
  res.json({ ok: true });
});

router.delete("/:code", async (req, res) => {
  const g = await getGroup(pool, req.params.code);
  if (g.host_id !== req.user.id) return res.status(403).json({ error: "Only the host can cancel the group" });
  if (g.status !== "open") return res.status(409).json({ error: "This group order is already closed" });
  await pool.query("UPDATE group_orders SET status = 'cancelled' WHERE id = ?", [g.id]);
  res.json({ ok: true });
});

// Host places the order. Atomic: stock + slot + EVERY member's wallet, or nothing happens.
router.post("/:code/checkout", async (req, res) => {
  const out = await withTransaction(async (conn) => {
    const g = await getGroup(conn, req.params.code, { lock: true });
    if (g.host_id !== req.user.id) throw { status: 403, message: "Only the host can place the group order" };
    if (g.status !== "open") throw { status: 409, message: "This group order is already closed" };
    const mealDate = String(g.meal_date).slice(0, 10);
    if (mealDate < todayStr()) throw { status: 409, message: "The meal date has passed — create a new group" };
    const v = await view(conn, g, req.user.id);
    if (!v.items.length) throw { status: 400, message: "Add at least one item first" };
    if (!v.allConfirmed) throw { status: 409, message: "Everyone must confirm before the host can place the order" };

    const S = await loadSettings(conn);
    const quantities = new Map();
    v.items.forEach((i) => quantities.set(i.itemId, (quantities.get(i.itemId) || 0) + i.qty));
    const priced = await lockAndPrice(conn, quantities, mealDate, S);
    const slot = await reserveSlot(conn, mealDate, g.pickup_slot, S, { hasIftar: priced.hasIftar });

    // Shares, recomputed from the locked prices so the money matches the order exactly.
    const memberIds = v.members.map((m) => m.userId).sort((a, b) => a - b);
    const lineOf = (uid) => v.items.filter((i) => i.userId === uid).reduce((s, i) => s + i.qty * (priced.snapshot.find((p) => p.id === i.itemId)?.price || 0), 0);
    const shares = new Map();
    if (g.split_mode === "own") memberIds.forEach((u) => shares.set(u, round2(lineOf(u))));
    else { const base = Math.floor((priced.total * 100) / memberIds.length) / 100; memberIds.forEach((u) => shares.set(u, base)); shares.set(g.host_id, round2(base + (priced.total - base * memberIds.length))); }

    const [users] = await conn.query(`SELECT id, name, wallet_balance FROM users WHERE id IN (${memberIds.map(() => "?").join(",")}) ORDER BY id FOR UPDATE`, memberIds);
    for (const u of users) if (Number(u.wallet_balance) < shares.get(u.id)) throw { status: 402, message: u.id === req.user.id ? `Your wallet is short — your share is ৳${shares.get(u.id)}` : `${u.name} doesn't have enough wallet balance for their ৳${shares.get(u.id)} share` };

    const token = uuidv4();
    const [ins] = await conn.query(
      "INSERT INTO orders (token, user_id, total, total_amount, meal_date, payment_method, status, pickup_slot, surplus_savings, kind, group_id, label) VALUES (?, ?, ?, ?, ?, 'wallet', 'Received', ?, ?, 'group', ?, ?)",
      [token, g.host_id, priced.total, priced.total, mealDate, slot, priced.savings, g.id, `Group: ${g.name}`.slice(0, 160)]);
    for (const it of priced.snapshot) await conn.query("INSERT INTO order_items (order_id, menu_item_id, name, price, qty, quantity, original_price) VALUES (?, ?, ?, ?, ?, ?, ?)", [ins.insertId, it.id, it.name, it.price, it.qty, it.qty, it.original_price]);
    for (const u of users) {
      const share = shares.get(u.id);
      await conn.query("INSERT INTO order_shares (order_id, user_id, amount) VALUES (?, ?, ?)", [ins.insertId, u.id, share]);
      if (share > 0) {
        await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [share, u.id]);
        await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [u.id, `Group "${g.name}" share (order #${ins.insertId})`, -share]);
      }
    }
    await conn.query("UPDATE group_orders SET status = 'placed', order_id = ? WHERE id = ?", [ins.insertId, g.id]);
    return { g, orderId: ins.insertId, token, slot, mealDate, priced, shares: Object.fromEntries(shares), memberIds };
  });
  const io = req.app.get("io");
  const order = { id: out.orderId, token: out.token, meal_date: out.mealDate, pickup_slot: out.slot, total: out.priced.total, payment_method: "wallet", status: "Received", kind: "group", label: `Group: ${out.g.name}`, items: out.priced.snapshot, customer: `${req.user.name} + group` };
  io.to("admins").emit("order:new", order);
  out.priced.lowNow.forEach((i) => io.to("admins").emit("stock:low", i));
  for (const uid of out.memberIds) await pushNotification(req.app, uid, `Group order "${out.g.name}" placed (#${out.orderId}). Your share: ৳${out.shares[uid]}.`, { orderId: out.orderId, type: "order", status: "Received" });
  res.status(201).json({ orderId: out.orderId, token: out.token, total: out.priced.total, shares: out.shares });
});

module.exports = router;
