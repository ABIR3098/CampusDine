const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { toMinutes } = require("../../utils/clock");
const { SLOTS } = require("../util");

const router = express.Router();

const shape = (r) => ({
  slot: r.slot,
  label: r.label,
  cutoffDaysBefore: r.cutoff_days_before,
  cutoffTime: String(r.cutoff_time).slice(0, 5), // "HH:MM"
  price: r.price,
  guestPrice: r.guest_price,
});

// GET /api/hall/slots — breakfast, lunch, dinner (in that order)
router.get("/slots", catchAsync(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM hall_slots");
  rows.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
  res.json(rows.map(shape));
}));

// PUT /api/hall/slots/:slot  (admin)  body: { cutoffTime: "HH:MM", cutoffDaysBefore: 0-3, price, guestPrice }
router.put("/slots/:slot", requireRole("admin"), catchAsync(async (req, res) => {
  const slot = req.params.slot;
  if (!SLOTS.includes(slot)) return res.status(404).json({ error: "Unknown meal" });
  const { cutoffTime, cutoffDaysBefore, price, guestPrice } = req.body || {};

  if (toMinutes(cutoffTime) === null) return res.status(400).json({ error: "Cut-off time must look like 21:00" });
  const days = Number(cutoffDaysBefore);
  if (!Number.isInteger(days) || days < 0 || days > 3) return res.status(400).json({ error: "Cut-off day must be 0 to 3 days before the meal" });
  const p = Number(price), g = Number(guestPrice);
  if (!(p >= 0 && p <= 10000) || !(g >= 0 && g <= 10000)) return res.status(400).json({ error: "Prices must be between 0 and 10000" });

  await pool.query(
    "UPDATE hall_slots SET cutoff_time = ?, cutoff_days_before = ?, price = ?, guest_price = ? WHERE slot = ?",
    [String(cutoffTime).slice(0, 5) + ":00", days, p, g, slot]
  );
  const [[row]] = await pool.query("SELECT * FROM hall_slots WHERE slot = ?", [slot]);
  res.json(shape(row));
}));

module.exports = router;
