// "Effective" on/off state of a person's meals.
//
// Rule: a meal is what the person last chose for that meal; if they never chose, it is DEFAULT_STATE.
// So if you switch lunch off on Monday and never touch it again, lunch stays off every day after.
const { addDays } = require("./util");
const { SLOTS } = require("./util");

const DEFAULT_STATE = "on"; // a person who never touched anything has every meal on
const MAX_DAYS = 62;

// → [{ date: "YYYY-MM-DD", slots: { breakfast: { status, source }, lunch: {...}, dinner: {...} } }, ...]
// source: "manual" (clicked), "auto" (filled at cut-off) or "carry" (no row yet — taken from the previous choice)
async function loadStates(db, userId, from, to) {
  const dates = [];
  for (let d = from; d <= to && dates.length < MAX_DAYS; d = addDays(d, 1)) dates.push(d);

  // last choice before `from`, per meal
  const [before] = await db.query(
    `SELECT s.slot, s.status FROM hall_meal_state s
     JOIN (SELECT slot, MAX(the_date) AS d FROM hall_meal_state WHERE user_id = ? AND the_date < ? GROUP BY slot) m
       ON m.slot = s.slot AND m.d = s.the_date
     WHERE s.user_id = ?`,
    [userId, from, userId]
  );
  const carry = {};
  for (const slot of SLOTS) carry[slot] = (before.find((r) => r.slot === slot) || {}).status || DEFAULT_STATE;

  const [rows] = await db.query(
    `SELECT DATE_FORMAT(the_date, '%Y-%m-%d') AS d, slot, status, source FROM hall_meal_state
     WHERE user_id = ? AND the_date >= ? AND the_date <= ?`,
    [userId, from, dates[dates.length - 1]]
  );
  const byKey = {};
  for (const r of rows) byKey[`${r.d}|${r.slot}`] = r;

  return dates.map((date) => {
    const slots = {};
    for (const slot of SLOTS) {
      const row = byKey[`${date}|${slot}`];
      if (row) { carry[slot] = row.status; slots[slot] = { status: row.status, source: row.source }; }
      else slots[slot] = { status: carry[slot], source: "carry" };
    }
    return { date, slots };
  });
}

module.exports = { loadStates, DEFAULT_STATE, MAX_DAYS };
