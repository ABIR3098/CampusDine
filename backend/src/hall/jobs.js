// Cut-off job: once a meal is locked, write down every person's state for it (source = 'auto'
// where they never chose, copied from their previous choice). After this the day's numbers are fixed.
const pool = require("../db");
const { SLOTS, nowParts, addDays, isLocked, localStamp } = require("./util");
const { DEFAULT_STATE } = require("./states");

const LOOK_BACK_DAYS = 1; // also catches up if the server was off over a cut-off
const LOOK_AHEAD_DAYS = 3; // the longest "days before" an admin can set

// → [{ date, slot, added, priced }]  (only the date/meal pairs that are locked;
//    added = people written this run, priced = rows whose price was fixed this run)
async function runAutoFill(db = pool) {
  const now = nowParts();
  const [slotRows] = await db.query("SELECT * FROM hall_slots");
  const slotBy = Object.fromEntries(slotRows.map((s) => [s.slot, s]));
  const stamp = localStamp();
  const done = [];

  for (let i = -LOOK_BACK_DAYS; i <= LOOK_AHEAD_DAYS; i++) {
    const date = addDays(now.dateKey, i);
    for (const slot of SLOTS) {
      if (!slotBy[slot] || !isLocked(slotBy[slot], date, now)) continue;
      const [r] = await db.query(
        `INSERT IGNORE INTO hall_meal_state (user_id, the_date, slot, status, source, changed_at)
         SELECT u.id, ?, ?,
                COALESCE((SELECT s.status FROM hall_meal_state s
                          WHERE s.user_id = u.id AND s.slot = ? AND s.the_date < ?
                          ORDER BY s.the_date DESC LIMIT 1), ?),
                'auto', ?
         FROM users u WHERE u.role IN ('student', 'teacher')`,
        [date, slot, slot, date, DEFAULT_STATE, stamp]
      );

      // fix the price: own plate (0 if OFF) and guest plates, each plus the feast extra of that date + meal.
      // Only rows with no price yet are touched, so a later price change never alters a locked meal.
      const [priced] = await db.query(
        `UPDATE hall_meal_state s
         SET s.charged = IF(s.status = 'on', ? + COALESCE((SELECT f.extra_price FROM hall_feasts f WHERE f.the_date = s.the_date AND f.slot = s.slot), 0), 0)
         WHERE s.the_date = ? AND s.slot = ? AND s.charged IS NULL`,
        [slotBy[slot].price, date, slot]
      );
      await db.query(
        `UPDATE hall_guests g
         SET g.charged = g.guest_count * (? + COALESCE((SELECT f.extra_price FROM hall_feasts f WHERE f.the_date = g.the_date AND f.slot = g.slot), 0))
         WHERE g.the_date = ? AND g.slot = ? AND g.charged IS NULL`,
        [slotBy[slot].guest_price, date, slot]
      );
      done.push({ date, slot, added: r.affectedRows, priced: priced.affectedRows });
    }
  }
  return done;
}

let timer = null;
function startAutoFill() {
  const tick = async () => {
    try {
      const done = await runAutoFill();
      const added = done.reduce((a, d) => a + d.added, 0);
      if (added > 0) console.log(`🍛 Hall: locked meals filled for ${added} person-meal(s)`);
    } catch (e) {
      console.warn("⚠️ Hall auto-fill failed:", e.message);
    }
  };
  tick();
  timer = setInterval(tick, 60 * 1000);
  if (timer.unref) timer.unref();
}

module.exports = { runAutoFill, startAutoFill };
