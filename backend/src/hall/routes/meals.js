const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, isDateKey, addDays, isLocked, cutoffOf, localStamp } = require("../util");
const { dayDiff } = require("../../utils/clock");
const { loadStates, MAX_DAYS } = require("../states");

const MAX_AHEAD_DAYS = 31; // how far ahead a person can plan
const { MAX_GUESTS } = require("./guests"); // step 8

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
  const [feasts] = await pool.query(
    "SELECT DATE_FORMAT(the_date, '%Y-%m-%d') AS d, slot, title, extra_price FROM hall_feasts WHERE the_date >= ? AND the_date <= ?",
    [from, days[days.length - 1].date]
  );
  const [guests] = await pool.query(
    "SELECT DATE_FORMAT(the_date, '%Y-%m-%d') AS d, slot, guest_count FROM hall_guests WHERE user_id = ? AND the_date >= ? AND the_date <= ?",
    [req.user.id, from, days[days.length - 1].date]
  ); // step 8
  for (const day of days) {
    for (const slot of SLOTS) {
      const cell = day.slots[slot];
      cell.guests = (guests.find((g) => g.d === day.date && g.slot === slot) || {}).guest_count || 0; // step 8
      cell.locked = isLocked(slotBy[slot], day.date, now);
      const feast = feasts.find((f) => f.d === day.date && f.slot === slot);
      cell.feast = feast ? { title: feast.title, extraPrice: feast.extra_price } : null; // step 7
      // minutes left before it locks (null once locked)
      const c = cutoffOf(slotBy[slot], day.date);
      cell.closesInMinutes = cell.locked ? null : dayDiff(now.dateKey, c.dateKey) * 1440 + c.minutes - now.minutes;
    }
  }
  res.json({ today: now.dateKey, maxGuests: MAX_GUESTS, days });
}));

// PUT /api/hall/meals/:date/:slot   body: { status: "on" | "off", onlyThisDay?: boolean }
// Allowed only until the meal's cut-off. By default the new choice also applies to the days after
// (until changed again); onlyThisDay: true keeps the next day exactly as it was.
router.put("/meals/:date/:slot", catchAsync(async (req, res) => {
  const { date, slot } = req.params;
  const { status, onlyThisDay } = req.body || {};
  if (!isDateKey(date)) return res.status(400).json({ error: "Date must look like 2026-10-22" });
  if (!SLOTS.includes(slot)) return res.status(404).json({ error: "Unknown meal" });
  if (!["on", "off"].includes(status)) return res.status(400).json({ error: "status must be on or off" });

  const now = nowParts();
  if (date > addDays(now.dateKey, MAX_AHEAD_DAYS)) return res.status(400).json({ error: `You can plan at most ${MAX_AHEAD_DAYS} days ahead` });
  const [[slotRow]] = await pool.query("SELECT * FROM hall_slots WHERE slot = ?", [slot]);
  if (isLocked(slotRow, date, now)) return res.status(409).json({ error: `${slotRow.label} for ${date} is closed — it can't be changed any more` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [day] = await loadStates(conn, req.user.id, date, date);
    const before = day.slots[slot].status;
    if (before === status) { await conn.rollback(); return res.json({ date, slot, status, changed: false }); }

    const stamp = localStamp();
    await conn.query(
      `INSERT INTO hall_meal_state (user_id, the_date, slot, status, source, changed_at) VALUES (?, ?, ?, ?, 'manual', ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), source = 'manual', changed_at = VALUES(changed_at)`,
      [req.user.id, date, slot, status, stamp]
    );
    await conn.query(
      "INSERT INTO hall_meal_log (user_id, the_date, slot, old_status, new_status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.id, date, slot, before, status, stamp]
    );
    if (onlyThisDay) {
      // pin the next day to what it was, so it doesn't inherit this change (not a new choice, so no log row)
      await conn.query(
        "INSERT IGNORE INTO hall_meal_state (user_id, the_date, slot, status, source, changed_at) VALUES (?, ?, ?, ?, 'auto', ?)",
        [req.user.id, addDays(date, 1), slot, before, stamp]
      );
    }
    await conn.commit();
    res.json({ date, slot, status, changed: true });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

module.exports = router;
