const express = require("express");
const pool = require("../db");
const { withTransaction } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { todayStr, isDateOnly } = require("../utils/dates");
const { round2 } = require("../utils/coupons");
const { v4: uuidv4 } = require("uuid");
const { notifyUser } = require("../utils/notify");
const { loadSettings } = require("../utils/settings");
const { lockAndPrice } = require("../utils/ordering");

const router = express.Router();
const idOf = (req) => { const n = Number(req.params.menuItemId); if (!Number.isInteger(n) || n < 1) throw { status: 400, message: "Invalid menu item" }; return n; };

router.get("/", verifyToken, async (req, res) => {
  const [favorites] = await pool.query(
    `SELECT mi.id, mi.name, mi.name_bn, mi.description, mi.price, mi.stock, mi.category, mi.image_url, ROUND(AVG(mr.rating), 2) AS averageRating, COUNT(mr.id) AS totalRatings
       FROM user_favorites uf JOIN menu_items mi ON uf.menu_item_id = mi.id LEFT JOIN menu_ratings mr ON mi.id = mr.menu_item_id
      WHERE uf.user_id = ? AND mi.is_active = 1 GROUP BY mi.id ORDER BY MAX(uf.created_at) DESC`, [req.user.id]);
  res.json({ favorites });
});

router.get("/trending/items", verifyToken, async (req, res) => {
  const [trending] = await pool.query("SELECT mi.id, mi.name, mi.price, COUNT(uf.id) AS favoriteCount FROM user_favorites uf JOIN menu_items mi ON uf.menu_item_id = mi.id WHERE mi.is_active = 1 GROUP BY mi.id ORDER BY favoriteCount DESC LIMIT 10");
  res.json({ trending });
});

router.post("/:menuItemId", verifyToken, async (req, res) => {
  const id = idOf(req);
  const [item] = await pool.query("SELECT name FROM menu_items WHERE id = ?", [id]);
  if (!item.length) return res.status(404).json({ error: "Menu item not found" });
  const [r] = await pool.query("INSERT IGNORE INTO user_favorites (user_id, menu_item_id) VALUES (?, ?)", [req.user.id, id]); // race-safe: a double-tap is not an error
  res.json({ success: true, alreadyFavorite: r.affectedRows === 0, message: `${item[0].name} added to favorites` });
});

router.delete("/:menuItemId", verifyToken, async (req, res) => {
  await pool.query("DELETE FROM user_favorites WHERE user_id = ? AND menu_item_id = ?", [req.user.id, idOf(req)]);
  res.json({ success: true, message: "Removed from favorites" });
});

router.get("/:menuItemId/is-favorite", verifyToken, async (req, res) => {
  const [rows] = await pool.query("SELECT 1 FROM user_favorites WHERE user_id = ? AND menu_item_id = ?", [req.user.id, idOf(req)]);
  res.json({ isFavorite: rows.length > 0 });
});

router.get("/:menuItemId/count", verifyToken, async (req, res) => {
  const [[c]] = await pool.query("SELECT COUNT(*) AS c FROM user_favorites WHERE menu_item_id = ?", [idOf(req)]);
  res.json({ count: c.c });
});

// One-tap wallet order for a favourite. Now locks stock + balance (it used to skip stock entirely).
router.post("/:menuItemId/quick-order", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const id = idOf(req);
  const quantity = Number(req.body.quantity);
  const mealDate = req.body.mealDate || todayStr();
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return res.status(400).json({ error: "quantity must be a whole number from 1 to 20" });
  if (!isDateOnly(mealDate) || mealDate < todayStr()) return res.status(400).json({ error: "mealDate must be today or a future date" });

  const out = await withTransaction(async (conn) => {
    const S = await loadSettings(conn);
    const priced = await lockAndPrice(conn, new Map([[id, quantity]]), mealDate, S); // same stock locking + last-hour deal pricing as normal orders
    const [[u]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [req.user.id]);
    if (u.wallet_balance < priced.total) throw { status: 402, message: "Insufficient wallet balance" };
    const token = uuidv4();
    const [o] = await conn.query("INSERT INTO orders (token, user_id, total, total_amount, meal_date, payment_method, status, surplus_savings) VALUES (?, ?, ?, ?, ?, 'wallet', 'Received', ?)", [token, req.user.id, priced.total, priced.total, mealDate, priced.savings]);
    const it = priced.snapshot[0];
    await conn.query("INSERT INTO order_items (order_id, menu_item_id, name, price, qty, quantity, original_price) VALUES (?, ?, ?, ?, ?, ?, ?)", [o.insertId, it.id, it.name, it.price, it.qty, it.qty, it.original_price]);
    await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [priced.total, req.user.id]);
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [req.user.id, `Order #${o.insertId} payment (quick order)`, -priced.total]);
    return { orderId: o.insertId, token, total: priced.total, item: it };
  });
  req.app.get("io").to("admins").emit("order:new", { id: out.orderId, token: out.token, meal_date: mealDate, total: out.total, payment_method: "wallet", status: "Received", items: [out.item], customer: req.user.name });
  notifyUser(req.app, req.user.id, out.orderId, "Received");
  res.status(201).json({ success: true, orderId: out.orderId, orderToken: out.token, totalAmount: out.total, message: "Quick order placed successfully" });
});

module.exports = router;
