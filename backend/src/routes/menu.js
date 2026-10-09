const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();

// GET /api/menu  (any logged-in user) — includes is_favorite for the caller
router.get("/", verifyToken, catchAsync(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.*, IF(f.user_id IS NULL, 0, 1) AS is_favorite
     FROM menu_items m
     LEFT JOIN favorites f ON f.menu_item_id = m.id AND f.user_id = ?
     ORDER BY m.category, m.name`,
    [req.user.id]
  );
  res.json(rows);
}));

// POST /api/menu/:id/favorite  (any logged-in user) — star an item (idempotent)
router.post("/:id/favorite", verifyToken, catchAsync(async (req, res) => {
  const [[item]] = await pool.query("SELECT id FROM menu_items WHERE id = ?", [req.params.id]);
  if (!item) return res.status(404).json({ error: "Item not found" });
  await pool.query(
    "INSERT INTO favorites (user_id, menu_item_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE user_id = user_id",
    [req.user.id, req.params.id]
  );
  res.json({ menuItemId: Number(req.params.id), isFavorite: true });
}));

// DELETE /api/menu/:id/favorite  (any logged-in user) — unstar an item
router.delete("/:id/favorite", verifyToken, catchAsync(async (req, res) => {
  await pool.query("DELETE FROM favorites WHERE user_id = ? AND menu_item_id = ?", [req.user.id, req.params.id]);
  res.json({ menuItemId: Number(req.params.id), isFavorite: false });
}));

// POST /api/menu  (admin only) — add a new item
router.post("/", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const { name, nameBn, category, price, stock, tag, isVeg } = req.body;
  if (!name || !category || price == null) {
    return res.status(400).json({ error: "name, category and price are required" });
  }
  const [result] = await pool.query(
    "INSERT INTO menu_items (name, name_bn, category, price, stock, tag, is_veg) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name, nameBn || null, category, price, stock || 0, tag || null, isVeg === false ? 0 : 1]
  );
  const [row] = await pool.query("SELECT * FROM menu_items WHERE id = ?", [result.insertId]);
  res.status(201).json(row[0]);
}));

// PUT /api/menu/:id  (admin only) — update price / stock / tag / veg flag
router.put("/:id", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const { price, stock, tag, isVeg } = req.body;
  const fields = [];
  const values = [];
  if (price != null) { fields.push("price = ?"); values.push(price); }
  if (stock != null) { fields.push("stock = ?"); values.push(stock); }
  if (tag !== undefined) { fields.push("tag = ?"); values.push(tag); }
  if (isVeg !== undefined) { fields.push("is_veg = ?"); values.push(isVeg ? 1 : 0); }
  if (fields.length === 0) return res.status(400).json({ error: "Nothing to update" });

  values.push(req.params.id);
  await pool.query(`UPDATE menu_items SET ${fields.join(", ")} WHERE id = ?`, values);
  const [row] = await pool.query("SELECT * FROM menu_items WHERE id = ?", [req.params.id]);
  if (row.length === 0) return res.status(404).json({ error: "Item not found" });
  res.json(row[0]);
}));

module.exports = router;