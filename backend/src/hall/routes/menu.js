const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS } = require("../util");

const router = express.Router();
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// GET /api/hall/menu → { days: [{ dow: 0-6 (0 = Sunday), name, slots: { breakfast: "…", lunch: "…", dinner: "…" } }] }
router.get("/menu", catchAsync(async (req, res) => {
  const [rows] = await pool.query("SELECT dow, slot, items FROM hall_menu");
  const days = DAY_NAMES.map((name, dow) => ({
    dow, name,
    slots: Object.fromEntries(SLOTS.map((s) => [s, (rows.find((r) => r.dow === dow && r.slot === s) || {}).items || ""])),
  }));
  res.json({ days });
}));

// PUT /api/hall/menu/:dow/:slot  (admin)  body: { items: "Rice, Dal, Fish curry" }
router.put("/menu/:dow/:slot", requireRole("admin"), catchAsync(async (req, res) => {
  const dow = Number(req.params.dow), slot = req.params.slot;
  if (!Number.isInteger(dow) || dow < 0 || dow > 6) return res.status(400).json({ error: "Day must be 0 (Sunday) to 6 (Saturday)" });
  if (!SLOTS.includes(slot)) return res.status(404).json({ error: "Unknown meal" });
  const items = String((req.body || {}).items || "").trim();
  if (!items || items.length > 255) return res.status(400).json({ error: "Write the menu (1 to 255 characters)" });
  await pool.query(
    "INSERT INTO hall_menu (dow, slot, items) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE items = VALUES(items)",
    [dow, slot, items]
  );
  res.json({ dow, slot, items });
}));

module.exports = router;
