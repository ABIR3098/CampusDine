// Streaks + points. A "streak" = consecutive canteen days (Fri/Sat are skipped) with a collected meal.
const { addDays, isWeekend } = require("./dates");
const MILESTONES = { 5: 25, 10: 60, 20: 150 };
const REWARDS = [
  { id: "tk20", cost: 100, discount: 20, minOrder: 40 },
  { id: "tk50", cost: 240, discount: 50, minOrder: 90 },
  { id: "tk120", cost: 550, discount: 120, minOrder: 200 },
];

function nextWorkday(d) { let n = addDays(d, 1); while (isWeekend(n)) n = addDays(n, 1); return n; }

// Called once per order (guarded by orders.points_awarded). `conn` may be a pool or connection.
async function awardMeal(conn, userId, mealDate) {
  await conn.query("INSERT IGNORE INTO loyalty (user_id) VALUES (?)", [userId]);
  const [[l]] = await conn.query("SELECT * FROM loyalty WHERE user_id = ? FOR UPDATE", [userId]);
  const last = l.last_date ? String(l.last_date).slice(0, 10) : null;
  let streak = l.streak, firstOfDay = last !== mealDate;
  if (!last) streak = 1;
  else if (mealDate === last) { /* same day: streak unchanged */ }
  else if (isWeekend(mealDate)) { /* weekend special order: neutral */ }
  else if (mealDate === nextWorkday(last)) streak += 1;
  else if (mealDate > last) streak = 1;
  const newLast = !last || mealDate > last ? mealDate : last;
  let pts = 10;
  const log = [["Meal collected", 10]];
  if (firstOfDay && streak > 1) { const b = Math.min(streak, 7) * 2; pts += b; log.push([`${streak}-day streak bonus`, b]); }
  if (firstOfDay && MILESTONES[streak] && streak > l.streak) { pts += MILESTONES[streak]; log.push([`${streak}-day streak milestone!`, MILESTONES[streak]]); }
  await conn.query("UPDATE loyalty SET points = points + ?, lifetime_points = lifetime_points + ?, streak = ?, best_streak = GREATEST(best_streak, ?), last_date = ? WHERE user_id = ?", [pts, pts, streak, streak, newLast, userId]);
  for (const [reason, p] of log) await conn.query("INSERT INTO points_log (user_id, points, reason) VALUES (?, ?, ?)", [userId, p, reason]);
  return { points: pts, streak };
}

module.exports = { awardMeal, REWARDS, MILESTONES, nextWorkday };
