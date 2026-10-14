const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { toCsv } = require("../utils/csv");
const { loadSettings, validateSettings, saveSettings } = require("../utils/settings");
const { todayStr, addDays, isDateOnly, weekdayOf } = require("../utils/dates");

const router = express.Router();
const LOW_STOCK_THRESHOLD = 10;
// Revenue = what the canteen actually keeps: total minus refunds. A cancelled
// cash/bKash/Nagad order was never paid, so it counts as 0.
const REVENUE = "CASE WHEN status IN ('Cancelled','Refunded') AND payment_method <> 'wallet' THEN 0 ELSE total - refund_amount END";

router.use(verifyToken, requireRole("admin"));

router.get("/overview", async (req, res) => {
  const [[pending]] = await pool.query("SELECT COUNT(*) AS cnt FROM orders WHERE status IN ('Received','Confirmed','Cooking') AND DATE(created_at) = CURDATE()");
  const [[revenue]] = await pool.query(`SELECT COALESCE(SUM(${REVENUE}), 0) AS total, COUNT(*) AS orders FROM orders WHERE DATE(created_at) = CURDATE()`);
  const [lowStock] = await pool.query("SELECT id, name, stock FROM menu_items WHERE is_active = 1 AND stock <= ? ORDER BY stock", [LOW_STOCK_THRESHOLD]);
  const [mealCounts] = await pool.query("SELECT status, COUNT(*) AS cnt FROM meal_calendar WHERE the_date = CURDATE() GROUP BY status");
  const [[awaiting]] = await pool.query("SELECT COUNT(*) AS cnt FROM orders WHERE status = 'Ready' AND picked_up_at IS NULL AND meal_date = CURDATE()");
  res.json({
    awaitingPickup: awaiting.cnt,
    pendingOrders: pending.cnt,
    revenueToday: revenue.total,
    ordersToday: revenue.orders,
    lowStock,
    fullMealsToday: mealCounts.find((r) => r.status === "full")?.cnt || 0,
    halfMealsToday: mealCounts.find((r) => r.status === "half")?.cnt || 0,
  });
});

router.get("/reports/revenue-trend", async (req, res) => {
  const [rows] = await pool.query(`SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, SUM(${REVENUE}) AS revenue FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY ym ORDER BY ym`);
  res.json(rows);
});

// Last 7 days: orders + revenue per day (zero-filled)
router.get("/reports/daily", async (req, res) => {
  const [rows] = await pool.query(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS orders, SUM(${REVENUE}) AS revenue FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY day ORDER BY day`);
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const [[d]] = await pool.query("SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? DAY), '%Y-%m-%d') AS d", [i]);
    const hit = rows.find((r) => r.day === d.d);
    out.push({ day: d.d, orders: hit?.orders || 0, revenue: hit?.revenue || 0 });
  }
  res.json(out);
});

router.get("/reports/top-items", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT oi.name, SUM(oi.qty) AS sold, SUM(oi.qty * oi.price) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ('Cancelled','Refunded') AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY oi.name ORDER BY sold DESC LIMIT 8`);
  res.json(rows);
});

// Tomorrow's expected meal count: average of Full/Half marks on the same weekday over the last 4 weeks.
router.get("/reports/forecast", async (req, res) => {
  const [[{ cnt, weeks }]] = await pool.query(`
    SELECT COUNT(*) AS cnt, COUNT(DISTINCT YEARWEEK(the_date)) AS weeks FROM meal_calendar
     WHERE status IN ('full','half') AND WEEKDAY(the_date) = WEEKDAY(DATE_ADD(CURDATE(), INTERVAL 1 DAY)) AND the_date >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)`);
  res.json({ predictedMealCount: weeks > 0 ? Math.round(cnt / weeks) : 0 });
});

router.get("/reports/orders.csv", async (req, res) => {
  const [rows] = await pool.query("SELECT o.id, o.token, u.external_id, o.meal_date, o.total, o.refund_amount, o.payment_method, o.status, o.created_at FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC");
  const csv = toCsv(["id", "token", "external_id", "meal_date", "total", "refund_amount", "payment_method", "status", "created_at"], rows.map((r) => [r.id, r.token, r.external_id, r.meal_date, r.total, r.refund_amount, r.payment_method, r.status, r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at]));
  res.type("text/csv").attachment("orders.csv").send(csv);
});

// ---- Canteen settings (hours, slot capacity, Ramadan / Jummah mode, last-hour deals) ----
router.get("/settings", async (req, res) => res.json(await loadSettings(pool)));
router.put("/settings", async (req, res) => {
  const current = await loadSettings(pool);
  const { error, value } = validateSettings(req.body, current);
  if (error) return res.status(400).json({ error });
  if (!Object.keys(value).length) return res.status(400).json({ error: "No valid settings to update" });
  await saveSettings(pool, value);
  res.json(await loadSettings(pool));
});

// ---- Cook plan: how much of each dish to prepare for a day (default tomorrow) ----
router.get("/reports/demand", async (req, res) => {
  const S = await loadSettings(pool);
  const target = isDateOnly(req.query.date) ? req.query.date : addDays(todayStr(), 1);
  const since = addDays(target, -56);
  const [hist] = await pool.query(
    `SELECT oi.menu_item_id AS id, o.meal_date AS d, SUM(oi.qty) AS q FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ('Cancelled','Refunded') AND o.meal_date >= ? AND o.meal_date < ? AND DAYOFWEEK(o.meal_date) = ? GROUP BY oi.menu_item_id, o.meal_date`, [since, target, weekdayOf(target) + 1]);
  const dates = [...new Set(hist.map((h) => String(h.d).slice(0, 10)))];
  const weightOf = (d) => ((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 864e5 <= 14 ? 2 : 1); // recent same-weekdays count double
  const totalW = dates.reduce((s, d) => s + weightOf(d), 0);
  const [pre] = await pool.query("SELECT oi.menu_item_id AS id, SUM(oi.qty) AS q FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.meal_date = ? AND o.status NOT IN ('Cancelled','Refunded') GROUP BY oi.menu_item_id", [target]);
  // Meal-calendar signal: how many people marked themselves "eating" vs. a typical same weekday.
  const [[marks]] = await pool.query("SELECT COUNT(*) AS c FROM meal_calendar WHERE the_date = ? AND status IN ('full','half')", [target]);
  const [histMarks] = await pool.query("SELECT the_date, COUNT(*) AS c FROM meal_calendar WHERE the_date >= ? AND the_date < ? AND DAYOFWEEK(the_date) = ? AND status IN ('full','half') GROUP BY the_date", [since, target, weekdayOf(target) + 1]);
  const avgMarks = histMarks.length ? histMarks.reduce((s, r) => s + r.c, 0) / histMarks.length : 0;
  const scale = avgMarks > 0 && marks.c > 0 ? Math.min(1.5, Math.max(0.7, marks.c / avgMarks)) : 1;
  const [menu] = await pool.query("SELECT id, name, category, stock FROM menu_items WHERE is_active = 1 AND (iftar_only = 0 OR ?) ORDER BY category, name", [S.ramadan_mode ? 1 : 0]);
  const items = menu.map((m) => {
    const rows = hist.filter((h) => h.id === m.id);
    const baseline = totalW ? rows.reduce((s, r) => s + weightOf(String(r.d).slice(0, 10)) * Number(r.q), 0) / totalW : 0;
    const preOrdered = Number(pre.find((p) => p.id === m.id)?.q || 0);
    const raw = Math.max(preOrdered, baseline * scale);
    const recommended = raw > 0 ? Math.ceil(raw * 1.1 - 1e-9) : 0; // +10% safety margin
    return { id: m.id, name: m.name, category: m.category, inStock: m.stock, expected: Math.round(baseline * scale * 10) / 10, preOrdered, recommended, toPrepare: Math.max(0, recommended - m.stock) };
  }).sort((a, b) => b.recommended - a.recommended);
  res.json({ date: target, basedOnDays: dates.length, confidence: dates.length >= 4 ? "high" : dates.length >= 2 ? "medium" : "low", calendarScale: Math.round(scale * 100) / 100, markedMeals: marks.c, items });
});

// ---- Pickup stats ----
router.get("/reports/pickup", async (req, res) => {
  const [[c]] = await pool.query("SELECT COUNT(*) AS collected, AVG(TIMESTAMPDIFF(MINUTE, ready_at, picked_up_at)) AS avgWait FROM orders WHERE picked_up_at IS NOT NULL AND DATE(picked_up_at) = CURDATE()");
  const [waiting] = await pool.query("SELECT id, token, TIMESTAMPDIFF(MINUTE, ready_at, NOW()) AS minutes FROM orders WHERE status = 'Ready' AND picked_up_at IS NULL AND meal_date = CURDATE() ORDER BY ready_at");
  res.json({ collectedToday: c.collected, avgMinutesUntilCollected: c.avgWait == null ? null : Math.round(c.avgWait), waiting });
});

module.exports = router;
