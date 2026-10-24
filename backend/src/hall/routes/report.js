const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, isDateKey, addDays, isLocked } = require("../util");
const { DEFAULT_STATE } = require("../states");

const router = express.Router();
router.use("/report", requireRole("admin"));

// Everyone's effective state for one date + meal (the row if there is one, else their last earlier choice, else the default).
async function peopleFor(date, slot) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.external_id AS externalId, u.role,
            COALESCE(cur.status,
                     (SELECT p.status FROM hall_meal_state p WHERE p.user_id = u.id AND p.slot = ? AND p.the_date < ? ORDER BY p.the_date DESC LIMIT 1),
                     ?) AS status
     FROM users u
     LEFT JOIN hall_meal_state cur ON cur.user_id = u.id AND cur.the_date = ? AND cur.slot = ?
     WHERE u.role IN ('student', 'teacher')
     ORDER BY u.name`,
    [slot, date, DEFAULT_STATE, date, slot]
  );
  return rows;
}

async function guestPlates(date, slot) {
  const [[r]] = await pool.query("SELECT COALESCE(SUM(guest_count), 0) AS n FROM hall_guests WHERE the_date = ? AND slot = ?", [date, slot]);
  return Number(r.n);
}

// GET /api/hall/report/day?date=YYYY-MM-DD (default today)
// → { date, slots: [{ slot, label, locked, members, on, off, guests, plates, feast, offList: [{ name, externalId, role }] }] }
router.get("/report/day", catchAsync(async (req, res) => {
  const now = nowParts();
  const date = req.query.date || now.dateKey;
  if (!isDateKey(date)) return res.status(400).json({ error: "date must look like 2026-10-22" });
  const [slotRows] = await pool.query("SELECT * FROM hall_slots");
  const [feasts] = await pool.query("SELECT slot, title, extra_price FROM hall_feasts WHERE the_date = ?", [date]);

  const slots = [];
  for (const slot of SLOTS) {
    const s = slotRows.find((x) => x.slot === slot);
    const people = await peopleFor(date, slot);
    const on = people.filter((p) => p.status === "on").length;
    const guests = await guestPlates(date, slot);
    const feast = feasts.find((f) => f.slot === slot);
    slots.push({
      slot, label: s.label, locked: isLocked(s, date, now),
      members: people.length, on, off: people.length - on, guests, plates: on + guests,
      feast: feast ? { title: feast.title, extraPrice: feast.extra_price } : null,
      offList: people.filter((p) => p.status === "off").map(({ name, externalId, role }) => ({ name, externalId, role })),
    });
  }
  res.json({ date, today: now.dateKey, slots });
}));

// GET /api/hall/report/range?from=&to=  (at most 31 days) → [{ date, breakfast: plates, lunch: plates, dinner: plates, total }]
router.get("/report/range", catchAsync(async (req, res) => {
  const now = nowParts();
  const from = req.query.from || now.dateKey;
  const to = req.query.to || addDays(from, 6);
  if (!isDateKey(from) || !isDateKey(to) || to < from) return res.status(400).json({ error: "from / to must be dates like 2026-10-22" });
  if (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`) > 30 * 86400000) return res.status(400).json({ error: "Ask for at most 31 days" });
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const row = { date: d, total: 0 };
    for (const slot of SLOTS) {
      const people = await peopleFor(d, slot);
      row[slot] = people.filter((p) => p.status === "on").length + (await guestPlates(d, slot));
      row.total += row[slot];
    }
    out.push(row);
  }
  res.json(out);
}));

// GET /api/hall/report/changes?date=&slot=&only=off  — who changed a meal for that date, and when (canteen time)
router.get("/report/changes", catchAsync(async (req, res) => {
  const date = req.query.date || nowParts().dateKey;
  if (!isDateKey(date)) return res.status(400).json({ error: "date must look like 2026-10-22" });
  const where = ["l.the_date = ?"], args = [date];
  if (req.query.slot) { if (!SLOTS.includes(req.query.slot)) return res.status(400).json({ error: "Unknown meal" }); where.push("l.slot = ?"); args.push(req.query.slot); }
  if (req.query.only === "off") where.push("l.new_status = 'off'");
  const [rows] = await pool.query(
    `SELECT u.name, u.external_id AS externalId, l.slot, l.old_status AS fromStatus, l.new_status AS toStatus,
            DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i') AS at
     FROM hall_meal_log l JOIN users u ON u.id = l.user_id
     WHERE ${where.join(" AND ")} ORDER BY l.created_at DESC, l.id DESC LIMIT 500`, args);
  res.json(rows);
}));

module.exports = router;
