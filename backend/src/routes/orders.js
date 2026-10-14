const express = require("express");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { withTransaction } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { checkCoupon, round2 } = require("../utils/coupons");
const { todayStr, addDays, isDateOnly, mealStart } = require("../utils/dates");
const { notifyOrder, emitOrder, pushNotification } = require("../utils/notify");
const { toCsv } = require("../utils/csv");
const { loadSettings } = require("../utils/settings");
const { lockAndPrice, reserveSlot } = require("../utils/ordering");
const { awardMeal } = require("../utils/loyalty");
const { budgetStatus } = require("../utils/budget");

const router = express.Router();
const FLOW = ["Received", "Cooking", "Ready"]; // "Confirmed" (gateway-paid) behaves like "Received"
const MAX_QTY_PER_ITEM = 20;
const MAX_DAYS_AHEAD = 30;
const CANCELLABLE = ["Received", "Confirmed"];
const ACTIVE = ["Received", "Confirmed", "Cooking"];

// Wallet refund tiers by how long until the meal is served (the booked pickup slot if there is one).
function refundRate(mealDate, slot) {
  const hours = (mealStart(mealDate, slot || process.env.MEAL_TIME || "12:00").getTime() - Date.now()) / 36e5;
  if (hours >= 8) return 1;
  if (hours >= 7) return 0.6;
  if (hours >= 5) return 0.5;
  return 0;
}

// Money was actually taken from the customer (wallet, shared wallets, or a confirmed gateway payment).
const wasPaid = (o) => o.payment_method === "wallet" || o.status === "Confirmed";

async function withItems(orders) {
  if (!orders.length) return orders;
  const ids = orders.map((o) => o.id);
  const ph = ids.map(() => "?").join(",");
  const [items] = await pool.query(`SELECT * FROM order_items WHERE order_id IN (${ph})`, ids);
  const [shares] = await pool.query(`SELECT s.order_id, s.user_id, s.amount, u.name FROM order_shares s JOIN users u ON u.id = s.user_id WHERE s.order_id IN (${ph})`, ids);
  return orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id), shares: shares.filter((s) => s.order_id === o.id).map((s) => ({ user_id: s.user_id, name: s.name, amount: s.amount })) }));
}

// Cancels inside an existing transaction: refund the payer(s), restock, release the coupon.
async function cancelInTx(conn, order, rate) {
  const [shares] = await conn.query("SELECT user_id, amount FROM order_shares WHERE order_id = ?", [order.id]);
  let refundAmount = 0;
  if (shares.length) {
    for (const s of shares) {
      const back = round2(Number(s.amount) * rate);
      if (back <= 0) continue;
      refundAmount += back;
      await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [back, s.user_id]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [s.user_id, `Order #${order.id} refund (${Math.round(rate * 100)}%)`, back]);
    }
    refundAmount = round2(refundAmount);
  } else if (wasPaid(order)) {
    refundAmount = round2(Number(order.total) * rate);
    if (refundAmount > 0) {
      await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [refundAmount, order.user_id]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [order.user_id, `Order #${order.id} refund (${Math.round(rate * 100)}%)`, refundAmount]);
    }
  }
  const status = refundAmount > 0 ? "Refunded" : "Cancelled";
  await conn.query("UPDATE orders SET status = ?, refund_amount = ? WHERE id = ?", [status, refundAmount, order.id]);
  const [items] = await conn.query("SELECT menu_item_id, qty FROM order_items WHERE order_id = ?", [order.id]);
  for (const it of items) await conn.query("UPDATE menu_items SET stock = stock + ? WHERE id = ?", [it.qty, it.menu_item_id]);
  const [usage] = await conn.query("SELECT coupon_id FROM coupon_usage WHERE order_id = ?", [order.id]);
  for (const u of usage) await conn.query("UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?", [u.coupon_id]);
  await conn.query("DELETE FROM coupon_usage WHERE order_id = ?", [order.id]);
  return { status, refundAmount };
}

// POST /api/orders { items:[{id,qty}], paymentMethod, couponCode?, mealDate?, pickupSlot? }  (+ Idempotency-Key header)
router.post("/", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const { items, paymentMethod, couponCode } = req.body;
  const mealDate = req.body.mealDate || todayStr();
  const pickupSlot = req.body.pickupSlot || null;
  const idempotencyKey = req.get("Idempotency-Key") || req.body.idempotencyKey || null;
  if (!Array.isArray(items) || !items.length || items.some((i) => !Number.isInteger(i.id) || !Number.isInteger(i.qty) || i.qty <= 0 || i.qty > MAX_QTY_PER_ITEM))
    return res.status(400).json({ error: `items must contain a positive integer id and qty (max ${MAX_QTY_PER_ITEM} each)` });
  if (!["wallet", "cash", "bkash", "nagad"].includes(paymentMethod)) return res.status(400).json({ error: "paymentMethod must be wallet, cash, bkash or nagad" });
  if (!isDateOnly(mealDate) || mealDate < todayStr() || mealDate > addDays(todayStr(), MAX_DAYS_AHEAD)) return res.status(400).json({ error: `mealDate must be between today and ${MAX_DAYS_AHEAD} days ahead` });
  if (pickupSlot !== null && !/^\d{2}:\d{2}$/.test(String(pickupSlot))) return res.status(400).json({ error: "pickupSlot must be HH:MM" });

  const result = await withTransaction(async (conn) => {
    if (idempotencyKey) {
      const [existing] = await conn.query("SELECT * FROM orders WHERE user_id = ? AND idempotency_key = ?", [req.user.id, idempotencyKey]);
      if (existing.length) return { replay: (await withItems(existing))[0] };
    }
    const S = await loadSettings(conn);
    const quantities = new Map();
    items.forEach((i) => quantities.set(i.id, (quantities.get(i.id) || 0) + i.qty));
    const priced = await lockAndPrice(conn, quantities, mealDate, S);
    const slot = await reserveSlot(conn, mealDate, pickupSlot, S, { hasIftar: priced.hasIftar });
    let discount = 0, coupon = null;
    if (couponCode) {
      const chk = await checkCoupon(conn, couponCode, req.user.id, priced.total, { lock: true });
      discount = chk.discount; coupon = chk.coupon;
    }
    const payable = round2(priced.total - discount);
    if (paymentMethod === "wallet") {
      const [[u]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [req.user.id]);
      if (Number(u.wallet_balance) < payable) throw { status: 402, message: "Insufficient wallet balance" };
      await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [payable, req.user.id]);
    }
    const token = uuidv4();
    const [ins] = await conn.query(
      "INSERT INTO orders (token, user_id, total, total_amount, meal_date, idempotency_key, discount_amount, discount_applied, payment_method, status, pickup_slot, surplus_savings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Received', ?, ?)",
      [token, req.user.id, payable, payable, mealDate, idempotencyKey, discount, Boolean(coupon), paymentMethod, slot, priced.savings]);
    if (paymentMethod === "wallet") await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [req.user.id, `Order #${ins.insertId} payment`, -payable]);
    for (const it of priced.snapshot) await conn.query("INSERT INTO order_items (order_id, menu_item_id, name, price, qty, quantity, original_price) VALUES (?, ?, ?, ?, ?, ?, ?)", [ins.insertId, it.id, it.name, it.price, it.qty, it.qty, it.original_price]);
    if (coupon) {
      await conn.query("INSERT INTO coupon_usage (user_id, coupon_id, order_id) VALUES (?, ?, ?)", [req.user.id, coupon.id, ins.insertId]);
      await conn.query("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", [coupon.id]);
    }
    return { lowNow: priced.lowNow, payable, order: { id: ins.insertId, token, meal_date: mealDate, pickup_slot: slot, total: payable, discount, savings: priced.savings, payment_method: paymentMethod, status: "Received", kind: "own", items: priced.snapshot, user_id: req.user.id } };
  });

  if (result.replay) return res.status(200).json(result.replay);
  const io = req.app.get("io");
  io.to("admins").emit("order:new", { ...result.order, customer: req.user.name });
  result.lowNow.forEach((i) => io.to("admins").emit("stock:low", i));
  notifyOrder(req.app, result.order, "Received");

  // Weekly budget: report status and warn when crossing 80% / 100%.
  const budget = await budgetStatus(pool, req.user.id);
  if (budget.limit) {
    const before = ((budget.spent - result.payable) / budget.limit) * 100;
    if (before < 100 && budget.percent >= 100) await pushNotification(req.app, req.user.id, `Budget alert: you've passed your ৳${budget.limit} weekly budget (spent ৳${budget.spent}).`, { type: "budget" });
    else if (before < 80 && budget.percent >= 80) await pushNotification(req.app, req.user.id, `Heads up: you've used ${budget.percent}% of your ৳${budget.limit} weekly budget.`, { type: "budget" });
  }
  res.status(201).json({ ...result.order, budget });
});

// Orders you own, plus orders you paid part of (group orders and treats you sent).
router.get("/mine", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const [orders] = await pool.query(
    `SELECT DISTINCT o.*, u.name AS owner_name FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN order_shares s ON s.order_id = o.id
      WHERE o.user_id = ? OR s.user_id = ? ORDER BY o.id DESC LIMIT 200`, [req.user.id, req.user.id]);
  res.json(await withItems(orders));
});

// Queue position + ETA for the caller's active orders today.
router.get("/queue/mine", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const S = await loadSettings(pool);
  const [mine] = await pool.query(
    `SELECT DISTINCT o.id, o.status, o.pickup_slot, o.meal_date FROM orders o LEFT JOIN order_shares s ON s.order_id = o.id
      WHERE (o.user_id = ? OR (o.kind = 'group' AND s.user_id = ?)) AND o.status IN ('Received','Confirmed','Cooking') AND o.meal_date = ?`, [req.user.id, req.user.id, todayStr()]);
  const [[t]] = await pool.query("SELECT COUNT(*) AS n, AVG(m) AS avg FROM (SELECT TIMESTAMPDIFF(MINUTE, created_at, ready_at) AS m FROM orders WHERE ready_at IS NOT NULL AND DATE(created_at) = meal_date ORDER BY id DESC LIMIT 30) x");
  const typical = t.n >= 5 ? Math.max(1, Math.round(t.avg)) : null;
  const queue = {};
  for (const o of mine) {
    const slot = o.pickup_slot || "00:00";
    const [[a]] = await pool.query(
      `SELECT COUNT(*) AS c FROM orders WHERE meal_date = ? AND status IN ('Received','Confirmed','Cooking') AND id <> ?
         AND (COALESCE(pickup_slot,'00:00') < ? OR (COALESCE(pickup_slot,'00:00') = ? AND id < ?))`, [o.meal_date, o.id, slot, slot, o.id]);
    const eta = Math.max(1, Math.round(a.c * S.prep_min_per_order + (o.status === "Cooking" ? S.prep_min_per_order / 2 : S.prep_min_per_order)));
    queue[o.id] = { ahead: a.c, etaMinutes: eta, typicalMinutes: typical, pickupSlot: o.pickup_slot };
  }
  res.json({ queue });
});

router.get("/export/csv", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const [orders] = await pool.query("SELECT id, token, meal_date, status, payment_method, total, created_at FROM orders WHERE user_id = ? ORDER BY id DESC", [req.user.id]);
  const detailed = await withItems(orders);
  const rows = detailed.map((o) => [o.id, o.token, o.meal_date, o.items.map((i) => `${i.name} (${i.qty})`).join("; "), o.items.reduce((s, i) => s + Number(i.qty || 0), 0), o.total, o.status, o.payment_method]);
  res.type("text/csv").attachment("order-history.csv").send(toCsv(["Order ID", "Order Token", "Meal Date", "Items", "Quantity", "Total Amount", "Order Status", "Payment Method"], rows));
});

// Admin queue: GET /api/orders?status=Cooking&date=2026-10-01
router.get("/", verifyToken, requireRole("admin"), async (req, res) => {
  const where = [], vals = [];
  if (req.query.status) { where.push("o.status = ?"); vals.push(req.query.status); }
  if (req.query.date && isDateOnly(req.query.date)) { where.push("o.meal_date = ?"); vals.push(req.query.date); }
  const [orders] = await pool.query(`SELECT o.*, u.name AS customer, u.external_id FROM orders o JOIN users u ON u.id = o.user_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY o.id DESC LIMIT 200`, vals);
  res.json(await withItems(orders));
});

// Admin hands over a Ready order. `code` = the QR text ("CD:<token>"), the full token, or the 8-character short code.
router.post("/pickup", verifyToken, requireRole("admin"), async (req, res) => {
  let code = String(req.body.code || "").trim();
  if (/^cd:/i.test(code)) code = code.slice(3);
  if (code.length < 6) return res.status(400).json({ error: "Enter or scan the order code" });
  const [rows] = await pool.query("SELECT o.*, u.name AS customer, u.external_id FROM orders o JOIN users u ON u.id = o.user_id WHERE o.token = ? OR UPPER(LEFT(o.token, 8)) = ? ORDER BY o.id DESC LIMIT 5", [code.toLowerCase(), code.toUpperCase()]);
  if (!rows.length) return res.status(404).json({ error: "No order found for that code" });
  let order = rows.length === 1 ? rows[0] : rows.filter((r) => r.status === "Ready" && !r.picked_up_at);
  if (Array.isArray(order)) { if (order.length !== 1) return res.status(409).json({ error: "That short code matches several orders — scan the QR instead" }); order = order[0]; }
  if (order.picked_up_at) return res.status(409).json({ error: `Order ${order.token.slice(0, 8).toUpperCase()} was already collected` });
  if (order.status !== "Ready") return res.status(409).json({ error: `Order ${order.token.slice(0, 8).toUpperCase()} is ${order.status}, not Ready yet` });
  const out = await withTransaction(async (conn) => {
    const [r] = await conn.query("UPDATE orders SET picked_up_at = NOW() WHERE id = ? AND picked_up_at IS NULL", [order.id]);
    if (!r.affectedRows) throw { status: 409, message: "Order was just collected" };
    const [flag] = await conn.query("UPDATE orders SET points_awarded = 1 WHERE id = ? AND points_awarded = 0", [order.id]);
    const awarded = [];
    if (flag.affectedRows) {
      const [shares] = await conn.query("SELECT user_id FROM order_shares WHERE order_id = ?", [order.id]);
      const eaters = order.kind === "group" ? shares.map((s) => s.user_id) : [order.user_id];
      for (const uid of eaters) awarded.push({ userId: uid, ...(await awardMeal(conn, uid, String(order.meal_date).slice(0, 10))) });
    }
    return awarded;
  });
  const [full] = await pool.query("SELECT * FROM orders WHERE id = ?", [order.id]);
  const detailed = (await withItems(full))[0];
  await emitOrder(req.app, order, "order:update", { ...order, status: order.status, picked_up_at: detailed.picked_up_at });
  for (const a of out) await pushNotification(req.app, a.userId, `Meal collected! +${a.points} points${a.streak > 1 ? ` · ${a.streak}-day streak 🔥` : ""}`, { orderId: order.id, type: "reward" });
  res.json({ ...detailed, customer: order.customer, external_id: order.external_id });
});

// QR code (SVG) for an order — shown to the student, scanned by the admin.
router.get("/:id/qr", verifyToken, async (req, res) => {
  const [[order]] = await pool.query("SELECT id, token, user_id FROM orders WHERE id = ?", [req.params.id]);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (req.user.role !== "admin" && order.user_id !== req.user.id) {
    const [s] = await pool.query("SELECT 1 FROM order_shares WHERE order_id = ? AND user_id = ?", [order.id, req.user.id]);
    if (!s.length) return res.status(404).json({ error: "Order not found" });
  }
  const svg = await QRCode.toString(`CD:${order.token}`, { type: "svg", margin: 1, width: 180, color: { dark: "#1a1208", light: "#ffffff" } });
  res.type("image/svg+xml").send(svg);
});

// Owner cancels their own order (only before cooking starts). Group orders: the host; treats: the receiver.
router.patch("/:id/cancel", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const out = await withTransaction(async (conn) => {
    const [[order]] = await conn.query("SELECT * FROM orders WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!order || order.user_id !== req.user.id) throw { status: 404, message: "Order not found" };
    if (!CANCELLABLE.includes(order.status)) throw { status: 409, message: `Order cannot be cancelled after it becomes ${order.status}` };
    const rate = refundRate(order.meal_date, order.pickup_slot);
    const r = await cancelInTx(conn, order, rate);
    return { order, rate, ...r };
  });
  const updated = { ...out.order, status: out.status, refundRate: out.rate, refundAmount: out.refundAmount };
  await emitOrder(req.app, out.order, "order:update", updated);
  notifyOrder(req.app, out.order, out.status, out.refundAmount ? `৳${out.refundAmount} refunded.` : "");
  res.json(updated);
});

// Admin cancels any not-yet-ready order (e.g. item ran out) — always a FULL refund of money taken.
router.patch("/:id/admin-cancel", verifyToken, requireRole("admin"), async (req, res) => {
  const out = await withTransaction(async (conn) => {
    const [[order]] = await conn.query("SELECT * FROM orders WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!order) throw { status: 404, message: "Order not found" };
    if (![...CANCELLABLE, "Cooking"].includes(order.status)) throw { status: 409, message: `Order is already ${order.status}` };
    return { order, ...(await cancelInTx(conn, order, 1)) };
  });
  const updated = { ...out.order, status: out.status, refundAmount: out.refundAmount };
  await emitOrder(req.app, out.order, "order:update", updated);
  notifyOrder(req.app, out.order, out.status, "The canteen cancelled this order." + (out.refundAmount ? ` ৳${out.refundAmount} refunded.` : ""));
  res.json(updated);
});

// Admin moves an order forward: Received -> Cooking -> Ready. Stops at Ready.
router.patch("/:id/advance", verifyToken, requireRole("admin"), async (req, res) => {
  const [[order]] = await pool.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const current = order.status === "Confirmed" ? "Received" : order.status;
  const index = FLOW.indexOf(current);
  if (index < 0 || index >= FLOW.length - 1) return res.status(409).json({ error: `Order is ${order.status} and cannot advance` });
  const next = FLOW[index + 1];
  const [r] = await pool.query(`UPDATE orders SET status = ?${next === "Ready" ? ", ready_at = NOW()" : ""} WHERE id = ? AND status = ?`, [next, order.id, order.status]); // guards double-click races
  if (!r.affectedRows) return res.status(409).json({ error: "Order was just updated by someone else — refresh" });
  const updated = { ...order, status: next };
  await emitOrder(req.app, order, "order:update", updated);
  notifyOrder(req.app, order, next);
  res.json(updated);
});

module.exports = router;
