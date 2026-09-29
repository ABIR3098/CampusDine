const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const { v4: uuidv4 } = require("uuid");

const router = express.Router();
const STATUSES = ["Received", "Cooking", "Ready", "Cancelled", "Refunded"];
const dateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const MEAL_TIME = process.env.MEAL_TIME || "12:00";

function refundRate(mealDate) {
  const mealStart = new Date(`${mealDate}T${MEAL_TIME}:00`);
  const hoursUntilMeal = (mealStart.getTime() - Date.now()) / (60 * 60 * 1000);
  if (hoursUntilMeal >= 8) return 1;
  if (hoursUntilMeal >= 7) return 0.6;
  if (hoursUntilMeal >= 5) return 0.5;
  return 0;
}

async function withItems(orders) {
  if (!orders.length) return orders;
  const [items] = await pool.query(`SELECT * FROM order_items WHERE order_id IN (${orders.map(() => "?").join(",")})`, orders.map((order) => order.id));
  return orders.map((order) => ({ ...order, items: items.filter((item) => item.order_id === order.id) }));
}

router.post("/", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const { items, paymentMethod, couponCode } = req.body;
  const mealDate = req.body.mealDate || new Date().toISOString().slice(0, 10);
  const idempotencyKey = req.get("Idempotency-Key") || req.body.idempotencyKey || null;
  if (!Array.isArray(items) || !items.length || items.some((item) => !Number.isInteger(item.id) || !Number.isInteger(item.qty) || item.qty <= 0)) return res.status(400).json({ error: "items must contain positive integer id and qty" });
  if (!["wallet", "cash", "bkash", "nagad"].includes(paymentMethod)) return res.status(400).json({ error: "paymentMethod must be wallet, cash, bkash or nagad" });
  if (!dateOnly(mealDate) || mealDate < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: "mealDate must be today or a future date" });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (idempotencyKey) {
      const [existing] = await conn.query("SELECT * FROM orders WHERE user_id = ? AND idempotency_key = ?", [req.user.id, idempotencyKey]);
      if (existing.length) { await conn.commit(); return res.status(200).json(existing[0]); }
    }
    const quantities = new Map();
    items.forEach((item) => quantities.set(item.id, (quantities.get(item.id) || 0) + item.qty));
    const ids = [...quantities.keys()];
    const [menuRows] = await conn.query(`SELECT * FROM menu_items WHERE id IN (${ids.map(() => "?").join(",")}) FOR UPDATE`, ids);
    const snapshot = [];
    let total = 0;
    for (const [id, qty] of quantities) {
      const menuItem = menuRows.find((item) => item.id === id);
      if (!menuItem) throw { status: 404, message: `Menu item ${id} not found` };
      if (menuItem.stock < qty) throw { status: 409, message: `${menuItem.name} is out of stock` };
      total += Number(menuItem.price) * qty;
      snapshot.push({ id: menuItem.id, name: menuItem.name, price: menuItem.price, qty });
      await conn.query("UPDATE menu_items SET stock = stock - ? WHERE id = ?", [qty, id]);
    }
    let discount = 0;
    let coupon = null;
    if (couponCode) {
      const [[candidate]] = await conn.query("SELECT * FROM coupons WHERE code = ? AND is_active = 1 FOR UPDATE", [String(couponCode).trim().toUpperCase()]);
      if (!candidate || (candidate.expiry_date && new Date(candidate.expiry_date) < new Date()) || (candidate.usage_limit && candidate.used_count >= candidate.usage_limit) || total < Number(candidate.min_order_amount)) {
        throw { status: 400, message: "Coupon is invalid or not applicable" };
      }
      const [[used]] = await conn.query("SELECT id FROM coupon_usage WHERE coupon_id = ? AND user_id = ?", [candidate.id, req.user.id]);
      if (used) throw { status: 400, message: "You have already used this coupon" };
      discount = candidate.discount_type === "PERCENTAGE" ? total * Number(candidate.discount_value) / 100 : Number(candidate.discount_value);
      if (candidate.max_discount) discount = Math.min(discount, Number(candidate.max_discount));
      discount = Math.min(discount, total);
      coupon = candidate;
    }
    const payableTotal = total - discount;
    if (paymentMethod === "wallet") {
      const [[user]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [req.user.id]);
      if (Number(user.wallet_balance) < payableTotal) throw { status: 402, message: "Insufficient wallet balance" };
      await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [payableTotal, req.user.id]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, 'Order payment', ?)", [req.user.id, -payableTotal]);
    }
    const token = uuidv4();
    const [result] = await conn.query("INSERT INTO orders (token, user_id, total, total_amount, meal_date, idempotency_key, discount_amount, discount_applied, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Received')", [token, req.user.id, payableTotal, payableTotal, mealDate, idempotencyKey, discount, Boolean(coupon), paymentMethod]);
    for (const item of snapshot) await conn.query("INSERT INTO order_items (order_id, menu_item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)", [result.insertId, item.id, item.name, item.price, item.qty]);
    if (coupon) {
      await conn.query("INSERT INTO coupon_usage (user_id, coupon_id, order_id) VALUES (?, ?, ?)", [req.user.id, coupon.id, result.insertId]);
      await conn.query("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", [coupon.id]);
    }
    await conn.commit();
    const order = { id: result.insertId, token, meal_date: mealDate, total: payableTotal, discount, payment_method: paymentMethod, status: "Received", items: snapshot };
    req.app.get("io").to("admins").emit("order:new", order);
    return res.status(201).json(order);
  } catch (err) { await conn.rollback(); console.error(err); return res.status(err.status || 500).json({ error: err.message || "Failed to place order" }); }
  finally { conn.release(); }
});

router.get("/mine", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const [orders] = await pool.query("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", [req.user.id]);
  res.json(await withItems(orders));
});

router.get("/export/csv", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const [orders] = await pool.query("SELECT id, token, meal_date, status, payment_method, total, created_at FROM orders WHERE user_id = ? ORDER BY id DESC", [req.user.id]);
  const detailed = await withItems(orders);
  const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = ["Order ID,Order Token,Order Date,Items,Quantity,Total Amount,Order Status,Payment Method"];
  detailed.forEach((order) => {
    const items = order.items.map((item) => `${item.name} (${item.qty})`).join("; ");
    const quantity = order.items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    rows.push([order.id, order.token, order.meal_date, items, quantity, order.total, order.status, order.payment_method].map(escapeCsv).join(","));
  });
  res.type("text/csv").attachment("order-history.csv").send(rows.join("\n"));
});

router.get("/", verifyToken, requireRole("admin"), async (req, res) => {
  const [orders] = await pool.query("SELECT * FROM orders ORDER BY id DESC LIMIT 100");
  res.json(await withItems(orders));
});

router.patch("/:id/cancel", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query("SELECT * FROM orders WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!order || order.user_id !== req.user.id) { await conn.rollback(); return res.status(404).json({ error: "Order not found" }); }
    if (order.status !== "Received") { await conn.rollback(); return res.status(409).json({ error: `Order cannot be cancelled after it becomes ${order.status}` }); }
    const rate = order.payment_method === "wallet" ? refundRate(order.meal_date) : 0;
    const refundAmount = Math.round(Number(order.total) * rate * 100) / 100;
    await conn.query("UPDATE orders SET status = ? WHERE id = ?", [refundAmount > 0 ? "Refunded" : "Cancelled", order.id]);
    if (refundAmount > 0) {
      await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [refundAmount, order.user_id]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [order.user_id, `Order refund (${Math.round(rate * 100)}%)`, refundAmount]);
    }
    const [items] = await conn.query("SELECT menu_item_id, qty FROM order_items WHERE order_id = ?", [order.id]);
    for (const item of items) await conn.query("UPDATE menu_items SET stock = stock + ? WHERE id = ?", [item.qty, item.menu_item_id]);
    await conn.commit();
    const updated = { ...order, status: refundAmount > 0 ? "Refunded" : "Cancelled", refundRate: rate, refundAmount };
    req.app.get("io").to(`user:${order.user_id}`).emit("order:update", updated);
    return res.json(updated);
  } catch (err) { await conn.rollback(); return res.status(500).json({ error: "Cancellation failed" }); }
  finally { conn.release(); }
});

router.patch("/:id/advance", verifyToken, requireRole("admin"), async (req, res) => {
  const [[order]] = await pool.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const index = STATUSES.indexOf(order.status);
  if (index < 0 || index > 2) return res.status(409).json({ error: "Order cannot advance" });
  const status = STATUSES[index + 1];
  await pool.query("UPDATE orders SET status = ? WHERE id = ?", [status, order.id]);
  const updated = { ...order, status };
  req.app.get("io").to("admins").emit("order:update", updated);
  req.app.get("io").to(`user:${order.user_id}`).emit("order:update", updated);
  res.json(updated);
});

module.exports = router;
