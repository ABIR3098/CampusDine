// Small helpers shared by every Hall route.
const { localParts, addDays } = require("../utils/clock");

const SLOTS = ["breakfast", "lunch", "dinner"];

// Canteen-local "now": { dateKey: "YYYY-MM-DD", dow: 0-6 (0 = Sunday), minutes: since midnight }
const nowParts = () => localParts();

// true only for a real calendar date written as YYYY-MM-DD
function isDateKey(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// A slot row from hall_slots → the moment it closes for the meal on `dateKey`.
// e.g. dinner (0 days before, 15:00) on 2026-10-22 closes 2026-10-22 15:00; breakfast (1 day before, 21:00) on the 22nd closes the 21st at 21:00.
function cutoffOf(slotRow, dateKey) {
  const [h, m] = String(slotRow.cutoff_time).split(":").map(Number);
  return { dateKey: addDays(dateKey, -Number(slotRow.cutoff_days_before)), minutes: h * 60 + m };
}

// true once the slot is closed for that date (nobody can change it any more)
function isLocked(slotRow, dateKey, now = nowParts()) {
  const c = cutoffOf(slotRow, dateKey);
  return now.dateKey > c.dateKey || (now.dateKey === c.dateKey && now.minutes >= c.minutes);
}

module.exports = { SLOTS, nowParts, isDateKey, addDays, cutoffOf, isLocked };
