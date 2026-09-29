const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/menu  (any logged-in user)
router.get("/", verifyToken, async (req, res) => {
  const values = [];
  const filters = [];
  if (req.query.search) { filters.push("(name LIKE ? OR name_bn LIKE ?)"); values.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  if (["heavy", "snacks", "drinks"].includes(req.query.category)) { filters.push("category = ?"); values.push(req.query.category); }
  if (req.query.available === "true") filters.push("stock > 0");
  const [rows] = await pool.query(`SELECT * FROM menu_items ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY category, name`, values);
  res.json(rows);
});

// POST /api/menu  (admin only) — add a new item
router.post("/", verifyToken, requireRole("admin"), async (req, res) => {
  const { name, nameBn, category, price, stock, tag } = req.body;
  if (!name || !category || price == null) {
    return res.status(400).json({ error: "name, category and price are required" });
  }
  const [result] = await pool.query(
    "INSERT INTO menu_items (name, name_bn, category, price, stock, tag) VALUES (?, ?, ?, ?, ?, ?)",
    [name, nameBn || null, category, price, stock || 0, tag || null]
  );
  const [row] = await pool.query("SELECT * FROM menu_items WHERE id = ?", [result.insertId]);
  res.status(201).json(row[0]);
});

// PUT /api/menu/:id  (admin only) — update price / stock / tag
router.put("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  const { price, stock, tag } = req.body;
  const fields = [];
  const values = [];
  if (price != null) { fields.push("price = ?"); values.push(price); }
  if (stock != null) { fields.push("stock = ?"); values.push(stock); }
  if (tag !== undefined) { fields.push("tag = ?"); values.push(tag); }
  if (fields.length === 0) return res.status(400).json({ error: "Nothing to update" });

  values.push(req.params.id);
  await pool.query(`UPDATE menu_items SET ${fields.join(", ")} WHERE id = ?`, values);
  const [row] = await pool.query("SELECT * FROM menu_items WHERE id = ?", [req.params.id]);
  if (row.length === 0) return res.status(404).json({ error: "Item not found" });
  res.json(row[0]);
});

module.exports = router;
