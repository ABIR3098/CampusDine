const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, isDateKey, addDays, isLocked, localStamp } = require("../util");
const { loadStates } = require("../states");

const router = express.Router();
const LIST_DAYS = 7;   // the "Rate your meals" list shows the last 7 days
const EDIT_DAYS = 14;  // a rating can still be added or changed up to 14 days later
const memberOnly = requireRole("student", "teacher");
const dowOf = (dateKey) => new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0 = Sunday, same as hall_menu.dow

// GET /api/hall/ratings/mine
// → { today, items: [{ date, slot, label, menu, stars, comment }] }  newest first
// Only meals that were ON for the person and have already closed can be rated (stars 0 = not rated yet).
router.get("/ratings/mine", memberOnly, catchAsync(async (req, res) => {
  const now = nowParts();
  const from = addDays(now.dateKey, -(LIST_DAYS - 1));
  const [slotRows] = await pool.query("SELECT * FROM hall_slots");
  const slotBy = Object.fromEntries(slotRows.map((s) => [s.slot, s]));
  const [menuRows] = await pool.query("SELECT dow, slot, items FROM hall_menu");
  const [rated] = await pool.query(
    "SELECT DATE_FORMAT(the_date, '%Y-%m-%d') AS d, slot, stars, comment FROM hall_meal_ratings WHERE user_id = ? AND the_date >= ? AND the_date <= ?",
    [req.user.id, from, now.dateKey]
  );
  const days = await loadStates(pool, req.user.id, from, now.dateKey);

  const items = [];
  for (const day of days.slice().reverse()) {
    for (const slot of SLOTS) {
      if (day.slots[slot].status !== "on" || !isLocked(slotBy[slot], day.date, now)) continue;
      const r = rated.find((x) => x.d === day.date && x.slot === slot);
      const menu = menuRows.find((x) => x.dow === dowOf(day.date) && x.slot === slot);
      items.push({
        date: day.date, slot, label: slotBy[slot].label, menu: menu ? menu.items : "",
        stars: r ? r.stars : 0, comment: r ? r.comment || "" : "",
      });
    }
  }
  res.json({ today: now.dateKey, items });
}));

// PUT /api/hall/ratings/:date/:slot   body: { stars: 1-5, comment?: string }
router.put("/ratings/:date/:slot", memberOnly, catchAsync(async (req, res) => {
  const { date, slot } = req.params;
  const stars = Number((req.body || {}).stars);
  const comment = String((req.body || {}).comment || "").trim().slice(0, 300);
  if (!isDateKey(date)) return res.status(400).json({ error: "Date must look like 2026-10-22" });
  if (!SLOTS.includes(slot)) return res.status(404).json({ error: "Unknown meal" });
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: "Stars must be a whole number from 1 to 5" });

  const now = nowParts();
  if (date > now.dateKey) return res.status(400).json({ error: "You can rate a meal only after it has happened" });
  if (date < addDays(now.dateKey, -EDIT_DAYS)) return res.status(400).json({ error: `Meals older than ${EDIT_DAYS} days can't be rated any more` });
  const [[slotRow]] = await pool.query("SELECT * FROM hall_slots WHERE slot = ?", [slot]);
  if (!slotRow || !isLocked(slotRow, date, now)) return res.status(400).json({ error: "This meal has not closed yet" });
  const [day] = await loadStates(pool, req.user.id, date, date);
  if (day.slots[slot].status !== "on") return res.status(409).json({ error: "You had this meal OFF, so there is nothing to rate" });

  const stamp = localStamp();
  await pool.query(
    `INSERT INTO hall_meal_ratings (user_id, the_date, slot, stars, comment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE stars = VALUES(stars), comment = VALUES(comment), updated_at = VALUES(updated_at)`,
    [req.user.id, date, slot, stars, comment || null, stamp, stamp]
  );
  res.json({ date, slot, stars, comment });
}));

module.exports = router;
