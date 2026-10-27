const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, isDateKey, addDays, isLocked } = require("../util");

const MAX_GUESTS = 5;       // guests per meal
const MAX_AHEAD_DAYS = 31;

// guest_names is JSON text: [{ name, phone }, ...]
function parseGuests(text) {
  try { const a = JSON.parse(text || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
// clean what the browser sent (at most `count` guests, short name, phone with digits only); null when no list was sent
function cleanGuests(raw, count) {
  if (!Array.isArray(raw)) return null;
  return raw.slice(0, count).map((g) => ({
    name: String((g && g.name) || "").trim().slice(0, 40),
    phone: String((g && g.phone) || "").replace(/[^\d+\-\s]/g, "").trim().slice(0, 20),
  }));
}

const router = express.Router();
router.use("/guests", requireRole("student", "teacher")); // the admin has no meals / guests of their own

// GET /api/hall/guests?from=&to=  → [{ date, slot, count, names: [{ name, phone }] }]   (default: today + 6 days)
router.get("/guests", catchAsync(async (req, res) => {
  const now = nowParts();
  const from = req.query.from || now.dateKey;
  const to = req.query.to || addDays(from, 6);
  if (!isDateKey(from) || !isDateKey(to) || to < from) return res.status(400).json({ error: "from / to must be dates like 2026-10-22" });
  const [rows] = await pool.query(
    "SELECT DATE_FORMAT(the_date, '%Y-%m-%d') AS d, slot, guest_count, guest_names FROM hall_guests WHERE user_id = ? AND the_date >= ? AND the_date <= ? ORDER BY the_date",
    [req.user.id, from, to]
  );
  res.json(rows.map((r) => ({ date: r.d, slot: r.slot, count: r.guest_count, names: parseGuests(r.guest_names) })));
}));

// PUT /api/hall/guests/:date/:slot   body: { count: 0-5, names?: [{ name, phone }] }   (0 removes the booking) — only until the meal's cut-off
// If `names` is left out the names already saved are kept (cut down to `count`).
router.put("/guests/:date/:slot", catchAsync(async (req, res) => {
  const { date, slot } = req.params;
  const count = Number((req.body || {}).count);
  if (!isDateKey(date)) return res.status(400).json({ error: "Date must look like 2026-10-22" });
  if (!SLOTS.includes(slot)) return res.status(404).json({ error: "Unknown meal" });
  if (!Number.isInteger(count) || count < 0 || count > MAX_GUESTS) return res.status(400).json({ error: `Guests must be 0 to ${MAX_GUESTS}` });

  const now = nowParts();
  if (date > addDays(now.dateKey, MAX_AHEAD_DAYS)) return res.status(400).json({ error: `You can plan at most ${MAX_AHEAD_DAYS} days ahead` });
  const [[slotRow]] = await pool.query("SELECT * FROM hall_slots WHERE slot = ?", [slot]);
  if (isLocked(slotRow, date, now)) return res.status(409).json({ error: `${slotRow.label} for ${date} is closed — guests can't be changed any more` });

  let names = [];
  if (count === 0) {
    await pool.query("DELETE FROM hall_guests WHERE user_id = ? AND the_date = ? AND slot = ?", [req.user.id, date, slot]);
  } else {
    const [[old]] = await pool.query("SELECT guest_names FROM hall_guests WHERE user_id = ? AND the_date = ? AND slot = ?", [req.user.id, date, slot]);
    names = cleanGuests((req.body || {}).names, count) || parseGuests(old && old.guest_names).slice(0, count);
    await pool.query(
      `INSERT INTO hall_guests (user_id, the_date, slot, guest_count, guest_names) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE guest_count = VALUES(guest_count), guest_names = VALUES(guest_names)`,
      [req.user.id, date, slot, count, JSON.stringify(names)]
    );
  }
  res.json({ date, slot, count, names });
}));

module.exports = router;
module.exports.MAX_GUESTS = MAX_GUESTS;
module.exports.parseGuests = parseGuests;
