const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { loadSettings } = require("../utils/settings");
const { decorateMenu } = require("../utils/ordering");

const router = express.Router();
const CATEGORIES = ["heavy", "snacks", "drinks"];
const flag = (v) => (v === true || v === "true" || v === 1 || v === "1" ? 1 : 0);

// Validates admin input. Returns { error } or { value } holding only the fields present.
function parseItem(body, { partial }) {
  const v = {};
  const bad = (error) => ({ error });
  if (body.name !== undefined) { const n = String(body.name).trim(); if (!n || n.length > 100) return bad("name must be 1-100 characters"); v.name = n; }
  else if (!partial) return bad("name, category and price are required");
  const nameBn = body.nameBn ?? body.name_bn; if (nameBn !== undefined) v.name_bn = String(nameBn).trim().slice(0, 100) || null;
  if (body.category !== undefined) { if (!CATEGORIES.includes(body.category)) return bad("category must be heavy, snacks or drinks"); v.category = body.category; }
  else if (!partial) return bad("name, category and price are required");
  if (body.price !== undefined) { const p = Number(body.price); if (!Number.isFinite(p) || p < 0 || p > 100000) return bad("price must be a number between 0 and 100000"); v.price = p; }
  else if (!partial) return bad("name, category and price are required");
  if (body.stock !== undefined) { const s = Number(body.stock); if (!Number.isInteger(s) || s < 0 || s > 100000) return bad("stock must be a whole number ≥ 0"); v.stock = s; }
  if (body.tag !== undefined) v.tag = body.tag ? String(body.tag).slice(0, 30) : null;
  if (body.description !== undefined) v.description = body.description ? String(body.description).slice(0, 255) : null;
  const active = body.isActive ?? body.is_active; if (active !== undefined) v.is_active = flag(active);
  // dietary tags
  const veg = body.isVeg ?? body.is_veg; if (veg !== undefined) v.is_veg = flag(veg);
  const halal = body.isHalal ?? body.is_halal; if (halal !== undefined) v.is_halal = flag(halal);
  const nuts = body.hasNuts ?? body.has_nuts; if (nuts !== undefined) v.has_nuts = flag(nuts);
  const iftar = body.iftarOnly ?? body.iftar_only; if (iftar !== undefined) v.iftar_only = flag(iftar);
  const surplus = body.surplusEligible ?? body.surplus_eligible; if (surplus !== undefined) v.surplus_eligible = flag(surplus);
  const spice = body.spiceLevel ?? body.spice_level; if (spice !== undefined) { const n = Number(spice); if (!Number.isInteger(n) || n < 0 || n > 3) return bad("spiceLevel must be 0, 1, 2 or 3"); v.spice_level = n; }
  return { value: v };
}

// GET /api/menu?search=&category=&available=true&veg=true&halal=true&nonuts=true&maxSpice=1&includeArchived=true(admin)
router.get("/", verifyToken, async (req, res) => {
  const S = await loadSettings(pool);
  const isAdmin = req.user.role === "admin";
  const values = [];
  const filters = [];
  if (!(isAdmin && req.query.includeArchived === "true")) filters.push("m.is_active = 1");
  if (!S.ramadan_mode && !(isAdmin && req.query.includeArchived === "true")) filters.push("m.iftar_only = 0"); // iftar specials only exist during Ramadan mode
  if (req.query.search) { filters.push("(m.name LIKE ? OR m.name_bn LIKE ?)"); values.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  if (CATEGORIES.includes(req.query.category)) { filters.push("m.category = ?"); values.push(req.query.category); }
  if (req.query.available === "true") filters.push("m.stock > 0");
  if (req.query.veg === "true") filters.push("m.is_veg = 1");
  if (req.query.halal === "true") filters.push("m.is_halal = 1");
  if (req.query.nonuts === "true") filters.push("m.has_nuts = 0");
  if (req.query.maxSpice !== undefined && Number.isInteger(Number(req.query.maxSpice))) { filters.push("m.spice_level <= ?"); values.push(Number(req.query.maxSpice)); }
  const [rows] = await pool.query(
    `SELECT m.*, ROUND(r.avg_rating, 1) AS avg_rating, COALESCE(r.rating_count, 0) AS rating_count
       FROM menu_items m
       LEFT JOIN (SELECT menu_item_id, AVG(rating) AS avg_rating, COUNT(*) AS rating_count FROM menu_ratings GROUP BY menu_item_id) r ON r.menu_item_id = m.id
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY m.category, m.name`, values);
  res.json(decorateMenu(rows, S));
});

router.post("/", verifyToken, requireRole("admin"), async (req, res) => {
  const { error, value } = parseItem(req.body, { partial: false });
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(value);
  const [result] = await pool.query(`INSERT INTO menu_items (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((c) => value[c]));
  const [row] = await pool.query("SELECT * FROM menu_items WHERE id = ?", [result.insertId]);
  res.status(201).json(row[0]);
});

router.put("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  const { error, value } = parseItem(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(value);
  if (!cols.length) return res.status(400).json({ error: "Nothing to update" });
  const [result] = await pool.query(`UPDATE menu_items SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [...cols.map((c) => value[c]), req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Item not found" });
  const [row] = await pool.query("SELECT * FROM menu_items WHERE id = ?", [req.params.id]);
  res.json(row[0]);
});

// DELETE archives instead of deleting: past orders/ratings keep pointing at the item.
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  const [result] = await pool.query("UPDATE menu_items SET is_active = 0 WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Item not found" });
  res.json({ ok: true, message: "Item archived" });
});

module.exports = router;
