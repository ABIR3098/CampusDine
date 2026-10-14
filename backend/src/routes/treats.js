// "Treat a friend": send wallet credit, or buy them a meal that they collect themselves.
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { withTransaction } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { loadSettings } = require("../utils/settings");
const { lockAndPrice, reserveSlot, round2 } = require("../utils/ordering");
const { todayStr, addDays, isDateOnly } = require("../utils/dates");
const { pushNotification } = require("../utils/notify");

const router = express.Router();
router.use(verifyToken, requireRole("student", "teacher"));
const MAX_CREDIT = 1000, MAX_PER_DAY = 10;

async function findFriend(q, externalId, selfId) {
  const [rows] = await q.query("SELECT id, name, role FROM users WHERE external_id = ?", [String(externalId || "").trim()]);
  const u = rows[0];
  if (!u || u.role === "admin") throw { status: 404, message: "No student or teacher with that ID" };
  if (u.id === selfId) throw { status: 400, message: "You can't treat yourself 😄" };
  return u;
}

router.get("/lookup", async (req, res) => {
  const u = await findFriend(pool, req.query.externalId, req.user.id);
  res.json({ name: u.name });
});

router.get("/", async (req, res) => {
  const cols = "t.id, t.kind, t.amount, t.message, t.order_id, t.created_at";
  const [sent] = await pool.query(`SELECT ${cols}, u.name AS other FROM treats t JOIN users u ON u.id = t.to_user WHERE t.from_user = ? ORDER BY t.id DESC LIMIT 20`, [req.user.id]);
  const [received] = await pool.query(`SELECT ${cols}, u.name AS other FROM treats t JOIN users u ON u.id = t.from_user WHERE t.to_user = ? ORDER BY t.id DESC LIMIT 20`, [req.user.id]);
  res.json({ sent, received });
});

// POST { toExternalId, kind: "credit"|"meal", amount | menuItemId + qty, message?, mealDate?, pickupSlot? }
router.post("/", async (req, res) => {
  const kind = req.body.kind;
  const message = String(req.body.message || "").trim().slice(0, 140);
  if (!["credit", "meal"].includes(kind)) return res.status(400).json({ error: "kind must be credit or meal" });
  const friend = await findFriend(pool, req.body.toExternalId, req.user.id);
  const [[today]] = await pool.query("SELECT COUNT(*) AS c FROM treats WHERE from_user = ? AND DATE(created_at) = CURDATE()", [req.user.id]);
  if (today.c >= MAX_PER_DAY) return res.status(429).json({ error: `You can send up to ${MAX_PER_DAY} treats a day` });

  if (kind === "credit") {
    const amount = round2(req.body.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > MAX_CREDIT) return res.status(400).json({ error: `Amount must be between ৳1 and ৳${MAX_CREDIT}` });
    await withTransaction(async (conn) => {
      const ids = [req.user.id, friend.id].sort((a, b) => a - b);
      const [users] = await conn.query("SELECT id, name, wallet_balance FROM users WHERE id IN (?, ?) ORDER BY id FOR UPDATE", ids);
      const me = users.find((u) => u.id === req.user.id);
      if (Number(me.wallet_balance) < amount) throw { status: 402, message: "Insufficient wallet balance" };
      await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [amount, me.id]);
      await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, friend.id]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [me.id, `Treat sent to ${friend.name}`, -amount]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [friend.id, `Treat from ${me.name}`, amount]);
      await conn.query("INSERT INTO treats (from_user, to_user, kind, amount, message) VALUES (?, ?, 'credit', ?, ?)", [me.id, friend.id, amount, message || null]);
    });
    await pushNotification(req.app, friend.id, `🎁 ${req.user.name} sent you ৳${amount}${message ? `: "${message}"` : "!"}`, { type: "treat" });
    return res.status(201).json({ ok: true, message: `৳${amount} sent to ${friend.name}` });
  }

  // kind === "meal": you pay now, they collect it.
  const menuItemId = Number(req.body.menuItemId), qty = Number(req.body.qty || 1);
  const mealDate = req.body.mealDate || todayStr();
  const pickupSlot = req.body.pickupSlot || null;
  if (!Number.isInteger(menuItemId) || !Number.isInteger(qty) || qty < 1 || qty > 5) return res.status(400).json({ error: "menuItemId and qty (1-5) are required" });
  if (!isDateOnly(mealDate) || mealDate < todayStr() || mealDate > addDays(todayStr(), 30)) return res.status(400).json({ error: "mealDate must be between today and 30 days ahead" });
  const out = await withTransaction(async (conn) => {
    const S = await loadSettings(conn);
    const priced = await lockAndPrice(conn, new Map([[menuItemId, qty]]), mealDate, S);
    const slot = await reserveSlot(conn, mealDate, pickupSlot, S, { hasIftar: priced.hasIftar });
    const [[me]] = await conn.query("SELECT id, name, wallet_balance FROM users WHERE id = ? FOR UPDATE", [req.user.id]);
    if (Number(me.wallet_balance) < priced.total) throw { status: 402, message: "Insufficient wallet balance" };
    await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [priced.total, me.id]);
    const token = uuidv4();
    const label = `🎁 Treat from ${me.name}${message ? `: ${message}` : ""}`.slice(0, 160);
    const [ins] = await conn.query("INSERT INTO orders (token, user_id, total, total_amount, meal_date, payment_method, status, pickup_slot, surplus_savings, kind, label) VALUES (?, ?, ?, ?, ?, 'wallet', 'Received', ?, ?, 'treat', ?)", [token, friend.id, priced.total, priced.total, mealDate, slot, priced.savings, label]);
    for (const it of priced.snapshot) await conn.query("INSERT INTO order_items (order_id, menu_item_id, name, price, qty, quantity, original_price) VALUES (?, ?, ?, ?, ?, ?, ?)", [ins.insertId, it.id, it.name, it.price, it.qty, it.qty, it.original_price]);
    await conn.query("INSERT INTO order_shares (order_id, user_id, amount) VALUES (?, ?, ?)", [ins.insertId, me.id, priced.total]);
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [me.id, `Treat for ${friend.name} (order #${ins.insertId})`, -priced.total]);
    await conn.query("INSERT INTO treats (from_user, to_user, kind, amount, order_id, message) VALUES (?, ?, 'meal', ?, ?, ?)", [me.id, friend.id, priced.total, ins.insertId, message || null]);
    return { priced, orderId: ins.insertId, token, slot, label };
  });
  const io = req.app.get("io");
  io.to("admins").emit("order:new", { id: out.orderId, token: out.token, meal_date: mealDate, pickup_slot: out.slot, total: out.priced.total, payment_method: "wallet", status: "Received", kind: "treat", label: out.label, items: out.priced.snapshot, customer: friend.name });
  out.priced.lowNow.forEach((i) => io.to("admins").emit("stock:low", i));
  const what = out.priced.snapshot.map((i) => `${i.name} ×${i.qty}`).join(", ");
  await pushNotification(req.app, friend.id, `🎁 ${req.user.name} bought you ${what}${out.slot ? ` — pickup ${out.slot}` : ""}${message ? `: "${message}"` : ""}`, { orderId: out.orderId, type: "treat" });
  res.status(201).json({ ok: true, orderId: out.orderId, message: `${what} ordered for ${friend.name}` });
});

module.exports = router;
