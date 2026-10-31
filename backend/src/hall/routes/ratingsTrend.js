const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, addDays } = require("../util");

const router = express.Router();

// GET /api/hall/ratings/trend?days=30   (admin)   days: 7-90, default 30
// → { days, from, to, series: [{ slot, label, count, average, change, points: [{ date, count, average }] }] }
// change = average of the second half of the period minus the first half (null when one half has no ratings)
router.get("/ratings/trend", requireRole("admin"), catchAsync(async (req, res) => {
  const now = nowParts();
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
  const from = addDays(now.dateKey, -(days - 1));
  const to = now.dateKey;
  const mid = addDays(from, Math.floor(days / 2));   // dates before this belong to the first half
  const uni = req.user.universityId || null;
  const round = (n) => Math.round(Number(n) * 10) / 10;

  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(r.the_date, '%Y-%m-%d') AS d, r.slot, COUNT(*) AS n, AVG(r.stars) AS avg_stars
     FROM hall_meal_ratings r JOIN users u ON u.id = r.user_id
     WHERE r.the_date >= ? AND r.the_date <= ? AND (? IS NULL OR u.university_id = ?)
     GROUP BY r.the_date, r.slot ORDER BY r.the_date`, [from, to, uni, uni]);
  const [slotRows] = await pool.query("SELECT slot, label FROM hall_slots");

  const weighted = (list) => {
    const n = list.reduce((a, p) => a + p.count, 0);
    return n ? list.reduce((a, p) => a + p.average * p.count, 0) / n : null;
  };
  res.json({
    days, from, to,
    series: SLOTS.map((slot) => {
      const points = rows.filter((r) => r.slot === slot).map((r) => ({ date: r.d, count: Number(r.n), average: Number(r.avg_stars) }));
      const first = weighted(points.filter((p) => p.date < mid)), second = weighted(points.filter((p) => p.date >= mid));
      const all = weighted(points);
      return {
        slot, label: (slotRows.find((s) => s.slot === slot) || {}).label || slot,
        count: points.reduce((a, p) => a + p.count, 0), average: all == null ? 0 : round(all),
        change: first == null || second == null ? null : round(second - first),
        points: points.map((p) => ({ ...p, average: round(p.average) })),
      };
    }),
  });
}));

module.exports = router;
