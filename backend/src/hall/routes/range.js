// "I'm away": switch every meal in a date range ON or OFF in one go (instead of tapping each day).
const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, isDateKey, addDays, isLocked, localStamp } = require("../util");
const { loadStates } = require("../states");

const MAX_AHEAD_DAYS = 31;
const MAX_RANGE_DAYS = 31;

const router = express.Router();

// PUT /api/hall/meals-range   body: { from, to, status: "on" | "off", slots?: ["breakfast", ...] }
// Every open meal from `from` to `to` (inclusive) gets the status. Meals that already closed are skipped.
// The day after `to` keeps whatever it was before, so "away 15–20" does not stay off for ever.
// → { from, to, status, changed, skippedLocked }
router.put("/meals-range", requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const { from, to, status } = req.body || {};
  if (!isDateKey(from) || !isDateKey(to) || to < from) return res.status(400).json({ error: "from and to must be dates like 2026-10-22, and to can't be before from" });
  if (!["on", "off"].includes(status)) return res.status(400).json({ error: "status must be on or off" });
  const slots = Array.isArray(req.body.slots) && req.body.slots.length ? req.body.slots : SLOTS;
  if (slots.some((s) => !SLOTS.includes(s))) return res.status(400).json({ error: "Unknown meal in slots" });

  const now = nowParts();
  if (to > addDays(now.dateKey, MAX_AHEAD_DAYS)) return res.status(400).json({ error: `You can plan at most ${MAX_AHEAD_DAYS} days ahead` });
  if (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`) > (MAX_RANGE_DAYS - 1) * 86400000) return res.status(400).json({ error: `Choose at most ${MAX_RANGE_DAYS} days` });

  const [slotRows] = await pool.query("SELECT * FROM hall_slots");
  const slotBy = Object.fromEntries(slotRows.map((s) => [s.slot, s]));
  const after = addDays(to, 1);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const days = await loadStates(conn, req.user.id, from, after); // effective state of every day, before any change
    const dayAfter = days[days.length - 1];
    const stamp = localStamp();
    let changed = 0, skippedLocked = 0;

    for (const day of days) {
      if (day.date === after) continue;
      for (const slot of slots) {
        if (isLocked(slotBy[slot], day.date, now)) { skippedLocked++; continue; }
        const before = day.slots[slot].status;
        await conn.query(
          `INSERT INTO hall_meal_state (user_id, the_date, slot, status, source, changed_at) VALUES (?, ?, ?, ?, 'manual', ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), source = 'manual', changed_at = VALUES(changed_at)`,
          [req.user.id, day.date, slot, status, stamp]);
        if (before !== status) {
          changed++;
          await conn.query("INSERT INTO hall_meal_log (user_id, the_date, slot, old_status, new_status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [req.user.id, day.date, slot, before, status, stamp]);
        }
      }
    }
    // pin the day after the range to what it was, so it does not inherit the new status
    for (const slot of slots) {
      await conn.query("INSERT IGNORE INTO hall_meal_state (user_id, the_date, slot, status, source, changed_at) VALUES (?, ?, ?, ?, 'auto', ?)",
        [req.user.id, after, slot, dayAfter.slots[slot].status, stamp]);
    }
    await conn.commit();
    res.json({ from, to, status, changed, skippedLocked });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

module.exports = router;
