const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();
const LOW_STOCK_THRESHOLD = 10;

router.use(verifyToken, requireRole("admin"));

// GET /api/admin/overview
router.get("/overview", async (req, res) => {
  const [[pending]] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM orders WHERE status != 'Ready' AND DATE(created_at) = CURDATE()"
  );
  const [[revenue]] = await pool.query(
    "SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE DATE(created_at) = CURDATE()"
  );
  const [lowStock] = await pool.query("SELECT id, name, stock FROM menu_items WHERE stock <= ?", [
    LOW_STOCK_THRESHOLD,
  ]);
  const [mealCounts] = await pool.query(
    "SELECT status, COUNT(*) AS cnt FROM meal_calendar WHERE the_date = CURDATE() GROUP BY status"
  );

  res.json({
    pendingOrders: pending.cnt,
    revenueToday: revenue.total,
    lowStock,
    fullMealsToday: mealCounts.find((r) => r.status === "full")?.cnt || 0,
    halfMealsToday: mealCounts.find((r) => r.status === "half")?.cnt || 0,
  });
});

// GET /api/admin/reports/revenue-trend — last 6 completed months
router.get("/reports/revenue-trend", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, SUM(total) AS revenue
    FROM orders
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY ym
    ORDER BY ym
  `);
  res.json(rows);
});

// GET /api/admin/reports/forecast — predicted meal count for tomorrow
// Heuristic: how many students/teachers marked Full or Half on this same
// weekday over the last 4 occurrences, averaged. Simple and explainable —
// swap in a real model later if the course wants something fancier.
router.get("/reports/forecast", async (req, res) => {
  const [[{ cnt, weeks }]] = await pool.query(`
    SELECT COUNT(*) AS cnt, COUNT(DISTINCT YEARWEEK(the_date)) AS weeks
    FROM meal_calendar
    WHERE status IN ('full', 'half')
      AND WEEKDAY(the_date) = WEEKDAY(DATE_ADD(CURDATE(), INTERVAL 1 DAY))
      AND the_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
  `);
  const predicted = weeks > 0 ? Math.round(cnt / weeks) : 0;
  res.json({ predictedMealCount: predicted });
});

router.get("/reports/orders.csv", async (req, res) => {
  const [rows] = await pool.query("SELECT o.id, o.token, u.external_id, o.meal_date, o.total, o.payment_method, o.status, o.created_at FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC");
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = ["id,token,external_id,meal_date,total,payment_method,status,created_at", ...rows.map((row) => [row.id, row.token, row.external_id, row.meal_date, row.total, row.payment_method, row.status, row.created_at].map(escape).join(","))].join("\n");
  res.type("text/csv").attachment("orders.csv").send(csv);
});

module.exports = router;
