const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();
const LOW_STOCK_THRESHOLD = 10;

router.use(verifyToken, requireRole("admin"));

// GET /api/admin/overview
router.get("/overview", catchAsync(async (req, res) => {
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
}));

// GET /api/admin/reports/revenue-trend — last 6 completed months
router.get("/reports/revenue-trend", catchAsync(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, SUM(total) AS revenue
    FROM orders
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY ym
    ORDER BY ym
  `);
  res.json(rows);
}));

// GET /api/admin/reports/forecast — predicted meal count for tomorrow
// Heuristic: how many students/teachers marked Full or Half on this same
// weekday over the last 4 occurrences, averaged. Simple and explainable —
// swap in a real model later if the course wants something fancier.
router.get("/reports/forecast", catchAsync(async (req, res) => {
  const [[{ cnt, weeks }]] = await pool.query(`
    SELECT COUNT(*) AS cnt, COUNT(DISTINCT YEARWEEK(the_date)) AS weeks
    FROM meal_calendar
    WHERE status IN ('full', 'half')
      AND WEEKDAY(the_date) = WEEKDAY(DATE_ADD(CURDATE(), INTERVAL 1 DAY))
      AND the_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
  `);
  const predicted = weeks > 0 ? Math.round(cnt / weeks) : 0;
  res.json({ predictedMealCount: predicted });
}));

// GET /api/admin/feedback — summary + rating breakdown + recent feedback
// Combines per-order ratings with general (not order-linked) feedback.
router.get("/feedback", catchAsync(async (req, res) => {
  const [orderRows] = await pool.query(`
    SELECT f.id, f.rating, f.comment, f.created_at, o.token, u.name AS userName, u.role AS userRole,
           (SELECT GROUP_CONCAT(CONCAT(oi.name, ' ×', oi.qty) SEPARATOR ', ') FROM order_items oi WHERE oi.order_id = o.id) AS items
    FROM order_feedback f
    JOIN orders o ON o.id = f.order_id
    JOIN users u ON u.id = f.user_id
    ORDER BY f.id DESC
    LIMIT 100
  `).catch(async () => {
    // Older databases may not have order_items.name — fall back to the plain query
    return pool.query(`
      SELECT f.id, f.rating, f.comment, f.created_at, o.token, u.name AS userName, u.role AS userRole, NULL AS items
      FROM order_feedback f
      JOIN orders o ON o.id = f.order_id
      JOIN users u ON u.id = f.user_id
      ORDER BY f.id DESC
      LIMIT 100
    `);
  });
  const [generalRows] = await pool.query(`
    SELECT g.id, g.rating, g.comment, g.category, g.created_at, u.name AS userName, u.role AS userRole
    FROM general_feedback g
    JOIN users u ON u.id = g.user_id
    ORDER BY g.id DESC
    LIMIT 100
  `);

  const entries = [
    ...orderRows.map((r) => ({ ...r, kind: "order" })),
    ...generalRows.map((r) => ({ ...r, kind: "general" })),
  ]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 100);

  const [[orderStats]] = await pool.query("SELECT COALESCE(SUM(rating), 0) AS total, COUNT(*) AS count FROM order_feedback");
  const [[generalStats]] = await pool.query("SELECT COALESCE(SUM(rating), 0) AS total, COUNT(*) AS count FROM general_feedback");
  const count = Number(orderStats.count) + Number(generalStats.count);
  const average = count ? (Number(orderStats.total) + Number(generalStats.total)) / count : 0;

  const [dist] = await pool.query(`
    SELECT rating, COUNT(*) AS cnt FROM (
      SELECT rating FROM order_feedback
      UNION ALL
      SELECT rating FROM general_feedback
    ) t GROUP BY rating
  `);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  dist.forEach((d) => { distribution[d.rating] = Number(d.cnt); });

  res.json({ average, count, distribution, entries });
}));

// POST /api/admin/announcement — broadcast a live announcement to all users
router.post("/announcement", catchAsync(async (req, res) => {
  const { message } = req.body || {};
  const text = String(message || "").trim();
  if (!text) {
    return res.status(400).json({ error: "Announcement message is required" });
  }

  const payload = {
    id: Date.now(),
    message: text,
    createdAt: new Date().toISOString(),
  };

  req.app.get("io").emit("announcement", payload);
  res.json({ success: true, announcement: payload });
}));

module.exports = router;
