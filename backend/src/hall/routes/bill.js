const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, isLocked, addDays } = require("../util");
const { loadStates } = require("../states");

const router = express.Router();
router.use("/bill", requireRole("student", "teacher"));

const pad = (n) => String(n).padStart(2, "0");

function parseMonth(q, now) {
  const [ny, nm] = now.dateKey.split("-").map(Number);
  const year = q.year === undefined ? ny : Number(q.year);
  const month = q.month === undefined ? nm : Number(q.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

// The month's bill for one person. Meals that have closed use the price fixed at cut-off ("confirmed");
// open meals use today's price ("estimate", it can still change). → also used by the payment step.
async function computeBill(db, userId, year, month, now = nowParts()) {
  const from = `${year}-${pad(month)}-01`;
  const to = addDays(`${month === 12 ? year + 1 : year}-${pad(month === 12 ? 1 : month + 1)}-01`, -1);

  const [slotRows] = await db.query("SELECT * FROM hall_slots");
  const slotBy = Object.fromEntries(slotRows.map((s) => [s.slot, s]));
  const days = await loadStates(db, userId, from, to);
  const [feasts] = await db.query(
    "SELECT DATE_FORMAT(the_date, '%Y-%m-%d') AS d, slot, title, extra_price FROM hall_feasts WHERE the_date >= ? AND the_date <= ?", [from, to]);
  const [guests] = await db.query(
    "SELECT DATE_FORMAT(the_date, '%Y-%m-%d') AS d, slot, guest_count, charged FROM hall_guests WHERE user_id = ? AND the_date >= ? AND the_date <= ?", [userId, from, to]);

  const summary = {
    mealsOn: { breakfast: 0, lunch: 0, dinner: 0, total: 0 },
    guestPlates: 0, mealCost: 0, guestCost: 0, feastExtra: 0,
    total: 0,           // the whole month, open meals at today's price
    confirmedTotal: 0,  // only meals that have closed (this part can no longer change)
  };

  for (const day of days) {
    day.total = 0; day.lockedTotal = 0;
    for (const slot of SLOTS) {
      const cell = day.slots[slot];
      const s = slotBy[slot];
      const feast = feasts.find((f) => f.d === day.date && f.slot === slot);
      const extra = feast ? feast.extra_price : 0;
      const locked = isLocked(s, day.date, now);
      const g = guests.find((x) => x.d === day.date && x.slot === slot);
      const guestCount = g ? g.guest_count : 0;

      const own = cell.charged !== null ? cell.charged : (cell.status === "on" ? s.price + extra : 0);
      const guestAmount = g ? (g.charged !== null ? g.charged : guestCount * (s.guest_price + extra)) : 0;

      cell.locked = locked;
      cell.amount = own;
      cell.guests = guestCount;
      cell.guestAmount = guestAmount;
      cell.feast = feast ? { title: feast.title, extraPrice: extra } : null;
      delete cell.charged;

      day.total += own + guestAmount;
      if (locked) day.lockedTotal += own + guestAmount;
      if (cell.status === "on") { summary.mealsOn[slot]++; summary.mealsOn.total++; summary.feastExtra += extra; }
      summary.guestPlates += guestCount;
      summary.feastExtra += guestCount * extra;
      summary.mealCost += own;
      summary.guestCost += guestAmount;
    }
    summary.total += day.total;
    summary.confirmedTotal += day.lockedTotal;
  }
  return { year, month, days, summary };
}

// GET /api/hall/bill?year=2026&month=10   (default: this month)
router.get("/bill", catchAsync(async (req, res) => {
  const now = nowParts();
  const ym = parseMonth(req.query, now);
  if (!ym) return res.status(400).json({ error: "Invalid month" });
  const bill = await computeBill(pool, req.user.id, ym.year, ym.month, now);
  res.json({ ...bill, today: now.dateKey });
}));

module.exports = router;
module.exports.computeBill = computeBill;
