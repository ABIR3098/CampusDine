const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, isDateKey, addDays, isLocked } = require("../util");
const { loadStates, MAX_DAYS } = require("../states");

const router = express.Router();
router.use("/meals", requireRole("student", "teacher")); // the admin has no meals of their own

// GET /api/hall/meals?from=YYYY-MM-DD&to=YYYY-MM-DD   (default: today and the next 6 days)
// → { today, days: [{ date, slots: { breakfast: { status, source, locked }, ... } }] }
router.get("/meals", catchAsync(async (req, res) => {
  const now = nowParts();
  const from = req.query.from || now.dateKey;
  const to = req.query.to || addDays(from, 6);
  if (!isDateKey(from) || !isDateKey(to) || to < from) return res.status(400).json({ error: "from / to must be dates like 2026-10-22" });
  if (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`) > (MAX_DAYS - 1) * 86400000) return res.status(400).json({ error: `Ask for at most ${MAX_DAYS} days at a time` });

  const [slotRows] = await pool.query("SELECT * FROM hall_slots");
  const slotBy = Object.fromEntries(slotRows.map((s) => [s.slot, s]));
  const days = await loadStates(pool, req.user.id, from, to);
  for (const day of days) {
    for (const slot of SLOTS) day.slots[slot].locked = isLocked(slotBy[slot], day.date, now);
  }
  res.json({ today: now.dateKey, days });
}));

module.exports = router;
