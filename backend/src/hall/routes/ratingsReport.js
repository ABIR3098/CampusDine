const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, addDays } = require("../util");

const router = express.Router();

// GET /api/hall/ratings/summary?days=30   (admin)   days: 1-90, default 30
// → { days, from, to, overall: { count, average }, bySlot: [{ slot, label, count, average }],
//     distribution: [{ stars, count }], meals: [{ date, slot, items, count, average }] (lowest rated first),
//     comments: [{ date, slot, stars, comment }] (newest first, names left out on purpose) }
router.get("/ratings/summary", requireRole("admin"), catchAsync(async (req, res) => {
  const now = nowParts();
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
  const from = addDays(now.dateKey, -(days - 1));
  const to = now.dateKey;
  const uni = req.user.universityId || null;
  const filter = "r.the_date >= ? AND r.the_date <= ? AND (? IS NULL OR u.university_id = ?)";
  const args = [from, to, uni, uni];
  const base = "FROM hall_meal_ratings r JOIN users u ON u.id = r.user_id";
  const round = (n) => Math.round(Number(n || 0) * 10) / 10;

  const [[overall]] = await pool.query(`SELECT COUNT(*) AS n, AVG(r.stars) AS avg_stars ${base} WHERE ${filter}`, args);
  const [slotRows] = await pool.query("SELECT slot, label FROM hall_slots");
  const [perSlot] = await pool.query(`SELECT r.slot, COUNT(*) AS n, AVG(r.stars) AS avg_stars ${base} WHERE ${filter} GROUP BY r.slot`, args);
  const [perStars] = await pool.query(`SELECT r.stars, COUNT(*) AS n ${base} WHERE ${filter} GROUP BY r.stars`, args);
  const [perMeal] = await pool.query(
    `SELECT DATE_FORMAT(r.the_date, '%Y-%m-%d') AS d, r.slot, m.items AS items, COUNT(*) AS n, AVG(r.stars) AS avg_stars
     ${base} LEFT JOIN hall_menu m ON m.dow = (DAYOFWEEK(r.the_date) - 1) AND m.slot = r.slot
     WHERE ${filter} GROUP BY r.the_date, r.slot, m.items ORDER BY avg_stars ASC, n DESC LIMIT 100`, args);
  const [comments] = await pool.query(
    `SELECT DATE_FORMAT(r.the_date, '%Y-%m-%d') AS d, r.slot, r.stars, r.comment ${base}
     WHERE ${filter} AND r.comment IS NOT NULL AND r.comment <> '' ORDER BY r.updated_at DESC LIMIT 10`, args);

  res.json({
    days, from, to,
    overall: { count: Number(overall.n), average: round(overall.avg_stars) },
    bySlot: SLOTS.map((slot) => {
      const row = perSlot.find((x) => x.slot === slot);
      const info = slotRows.find((x) => x.slot === slot);
      return { slot, label: info ? info.label : slot, count: row ? Number(row.n) : 0, average: row ? round(row.avg_stars) : 0 };
    }),
    distribution: [1, 2, 3, 4, 5].map((stars) => {
      const row = perStars.find((x) => Number(x.stars) === stars);
      return { stars, count: row ? Number(row.n) : 0 };
    }),
    meals: perMeal.map((x) => ({ date: x.d, slot: x.slot, items: x.items || "", count: Number(x.n), average: round(x.avg_stars) })),
    comments: comments.map((x) => ({ date: x.d, slot: x.slot, stars: x.stars, comment: x.comment })),
  });
}));

module.exports = router;
