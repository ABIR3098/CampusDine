const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const { restaurantOf, isRestaurantId } = require("../catalog");
const { loadItemRestaurants } = require("../restaurants");

const router = express.Router();
const LOW_STOCK_THRESHOLD = 10;

router.use(verifyToken, requireRole("admin"));

// GET /api/admin/overview[?restaurant=<id>]
// With ?restaurant= the pending-orders, revenue and low-stock numbers cover only that restaurant
// (worked out from each order's items, so no database change is needed). Meal-plan counts stay campus-wide.
async function restaurantOverview(restaurant) {
  const extra = await loadItemRestaurants();
  const [todays] = await pool.query(
    "SELECT id, status, total FROM orders WHERE DATE(created_at) = CURDATE()"
  );
  let pendingOrders = 0;
  let revenueToday = 0;
  if (todays.length > 0) {
    const [items] = await pool.query(
      `SELECT order_id, menu_item_id, name FROM order_items WHERE order_id IN (${todays.map(() => "?").join(",")})`,
      todays.map((o) => o.id)
    );
    for (const order of todays) {
      const first = items.find((i) => i.order_id === order.id);
      if (restaurantOf(first && first.name, first && first.menu_item_id, extra) !== restaurant) continue;
      if (order.status !== "Ready") pendingOrders += 1;
      if (order.status !== "Cancelled") revenueToday += Number(order.total);
    }
  }
  const [stock] = await pool.query("SELECT id, name, stock FROM menu_items WHERE stock <= ?", [LOW_STOCK_THRESHOLD]);
  const lowStock = stock.filter((m) => restaurantOf(m.name, m.id, extra) === restaurant);
  return { pendingOrders, revenueToday, lowStock };
}

router.get("/overview", catchAsync(async (req, res) => {
  const restaurant = req.query.restaurant;
  if (restaurant && !isRestaurantId(restaurant)) return res.status(400).json({ error: "Unknown restaurant" });
  const [[pending]] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM orders WHERE status != 'Ready' AND DATE(created_at) = CURDATE()"
  );
  const [[revenue]] = await pool.query(
    "SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE DATE(created_at) = CURDATE() AND status != 'Cancelled'"
  );
  const [lowStock] = await pool.query("SELECT id, name, stock FROM menu_items WHERE stock <= ?", [
    LOW_STOCK_THRESHOLD,
  ]);
  const [mealCounts] = await pool.query(
    "SELECT status, COUNT(*) AS cnt FROM meal_calendar WHERE the_date = CURDATE() GROUP BY status"
  );

  const scoped = restaurant ? await restaurantOverview(restaurant) : null;

  res.json({
    pendingOrders: scoped ? scoped.pendingOrders : pending.cnt,
    revenueToday: scoped ? scoped.revenueToday : revenue.total,
    lowStock: scoped ? scoped.lowStock : lowStock,
    fullMealsToday: mealCounts.find((r) => r.status === "full")?.cnt || 0,
    halfMealsToday: mealCounts.find((r) => r.status === "half")?.cnt || 0,
  });
}));

// GET /api/admin/reports/revenue-trend — last 6 completed months
router.get("/reports/revenue-trend", catchAsync(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, SUM(total) AS revenue
    FROM orders
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) AND status != 'Cancelled'
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

// ════════════════════════════════════════════════
//  Report generation
// ════════════════════════════════════════════════
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive). Defaults to the last 30 days.
function readRange(req) {
  let { from, to } = req.query;
  const today = new Date();
  if (!to || !DATE_RE.test(to)) to = ymd(today);
  if (!from || !DATE_RE.test(from)) {
    const d = new Date(today); d.setDate(d.getDate() - 29); from = ymd(d);
  }
  if (from > to) [from, to] = [to, from];
  const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  if (days > 366) return { error: "Pick a range of one year or less" };
  return { from, to, days };
}

// Orders in range: created_at >= from 00:00 and < (to + 1 day) 00:00
const IN_RANGE = "o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)";

// GET /api/admin/reports/summary?from=&to=
router.get("/reports/summary", catchAsync(async (req, res) => {
  const range = readRange(req);
  if (range.error) return res.status(400).json({ error: range.error });
  const { from, to, days } = range;
  const args = [from, to];

  const [[totals]] = await pool.query(`
    SELECT COUNT(*) AS orders,
           COALESCE(SUM(o.total), 0) AS revenue,
           COALESCE(SUM(o.discount_amount), 0) AS discounts,
           COALESCE(AVG(o.total), 0) AS avgOrder,
           SUM(o.picked_up_at IS NOT NULL) AS collected,
           COUNT(DISTINCT o.user_id) AS customers
    FROM orders o WHERE ${IN_RANGE} AND o.status != 'Cancelled'`, args);

  const [[cancelled]] = await pool.query(`
    SELECT COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS amount
    FROM orders o WHERE ${IN_RANGE} AND o.status = 'Cancelled'`, args);

  const [byStatus] = await pool.query(`
    SELECT o.status, COUNT(*) AS orders FROM orders o WHERE ${IN_RANGE} GROUP BY o.status`, args);

  const [byPayment] = await pool.query(`
    SELECT o.payment_method AS method, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS revenue
    FROM orders o WHERE ${IN_RANGE} AND o.status != 'Cancelled' GROUP BY o.payment_method`, args);

  const [byDay] = await pool.query(`
    SELECT DATE_FORMAT(o.created_at, '%Y-%m-%d') AS day, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS revenue
    FROM orders o WHERE ${IN_RANGE} AND o.status != 'Cancelled' GROUP BY day ORDER BY day`, args);

  const [topItems] = await pool.query(`
    SELECT oi.name, SUM(oi.qty) AS qty, COALESCE(SUM(oi.qty * oi.price), 0) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE ${IN_RANGE} AND o.status != 'Cancelled'
    GROUP BY oi.name ORDER BY qty DESC, revenue DESC LIMIT 10`, args);

  const [byRole] = await pool.query(`
    SELECT u.role, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS revenue
    FROM orders o JOIN users u ON u.id = o.user_id
    WHERE ${IN_RANGE} AND o.status != 'Cancelled' GROUP BY u.role`, args);

  const [byResidence] = await pool.query(`
    SELECT u.account_type AS type, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS revenue,
           COUNT(DISTINCT o.user_id) AS customers
    FROM orders o JOIN users u ON u.id = o.user_id
    WHERE ${IN_RANGE} AND o.status != 'Cancelled' GROUP BY u.account_type`, args);

  const [hallResidents] = await pool.query(`
    SELECT u.name, u.external_id AS externalId, u.hall_name AS hallName, u.room_number AS roomNumber, u.hall_id AS hallId,
           COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS spent
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id AND ${IN_RANGE} AND o.status != 'Cancelled'
    WHERE u.account_type = 'hall'
    GROUP BY u.id ORDER BY spent DESC, u.name LIMIT 200`, args);

  const [[userStats]] = await pool.query(`
    SELECT COUNT(*) AS total,
           SUM(account_type = 'hall') AS hall,
           SUM(created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)) AS joined
    FROM users WHERE role != 'admin'`, args);

  const [[fb]] = await pool.query(`
    SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average FROM (
      SELECT rating FROM order_feedback WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
      UNION ALL
      SELECT rating FROM general_feedback WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
    ) t`, [from, to, from, to]);

  const [[wallet]] = await pool.query(`
    SELECT COALESCE(SUM(CASE WHEN label LIKE 'Wallet top-up%' THEN amount ELSE 0 END), 0) AS topups
    FROM wallet_transactions WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`, args);
  const [[held]] = await pool.query("SELECT COALESCE(SUM(wallet_balance), 0) AS total FROM users WHERE role != 'admin'");

  res.json({
    generatedAt: new Date().toISOString(),
    range: { from, to, days },
    totals: {
      orders: Number(totals.orders), revenue: Number(totals.revenue), discounts: Number(totals.discounts),
      avgOrder: Number(totals.avgOrder), collected: Number(totals.collected || 0), customers: Number(totals.customers),
      cancelledOrders: Number(cancelled.orders), cancelledAmount: Number(cancelled.amount),
    },
    byStatus, byPayment, byDay, topItems, byRole, byResidence, hallResidents,
    users: { total: Number(userStats.total), hall: Number(userStats.hall || 0), joined: Number(userStats.joined || 0) },
    feedback: { count: Number(fb.count), average: Number(fb.average) },
    wallet: { topups: Number(wallet.topups), balanceHeld: Number(held.total) },
  });
}));

// CSV helpers — a cell that starts with = + - or @ would be run as a formula by Excel, so it gets a leading '
function csvCell(v) {
  if (v === null || v === undefined) return "";
  let t = v instanceof Date ? v.toISOString().slice(0, 19).replace("T", " ") : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
const toCsv = (header, rows) =>
  "\ufeff" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

// GET /api/admin/reports/export?type=orders|hall&from=&to=   → CSV download
router.get("/reports/export", catchAsync(async (req, res) => {
  const range = readRange(req);
  if (range.error) return res.status(400).json({ error: range.error });
  const { from, to } = range;
  const type = req.query.type === "hall" ? "hall" : "orders";
  let csv;

  if (type === "orders") {
    const [rows] = await pool.query(`
      SELECT o.token, o.created_at, o.status, o.payment_method, o.total, o.discount_amount, o.pickup_time, o.picked_up_at,
             u.name, u.external_id, u.role, u.account_type, u.hall_name, u.room_number, u.hall_id,
             (SELECT GROUP_CONCAT(CONCAT(oi.name, ' x', oi.qty) SEPARATOR '; ') FROM order_items oi WHERE oi.order_id = o.id) AS items
      FROM orders o JOIN users u ON u.id = o.user_id
      WHERE ${IN_RANGE} ORDER BY o.id`, [from, to]);
    csv = toCsv(
      ["Token", "Placed at", "Status", "Payment", "Total (BDT)", "Discount (BDT)", "Scheduled pickup", "Collected at",
        "Customer", "Customer ID", "Role", "Residence", "Hall", "Room", "Hall ID", "Items"],
      rows.map((r) => [r.token, r.created_at, r.status, r.payment_method, r.total, r.discount_amount, r.pickup_time, r.picked_up_at,
        r.name, r.external_id, r.role, r.account_type === "hall" ? "Hall resident" : "Regular", r.hall_name, r.room_number, r.hall_id, r.items])
    );
  } else {
    const [rows] = await pool.query(`
      SELECT u.name, u.external_id, u.email, u.role, u.hall_name, u.room_number, u.hall_id, u.phone, u.created_at,
             COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS spent
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND ${IN_RANGE} AND o.status != 'Cancelled'
      WHERE u.account_type = 'hall'
      GROUP BY u.id ORDER BY u.hall_name, u.room_number`, [from, to]);
    csv = toCsv(
      ["Name", "ID", "Email", "Role", "Hall", "Room", "Hall ID", "Phone", "Joined", "Orders in range", "Spent in range (BDT)"],
      rows.map((r) => [r.name, r.external_id, r.email, r.role, r.hall_name, r.room_number, r.hall_id, r.phone, r.created_at, r.orders, r.spent])
    );
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="campusdine-${type}-${from}_to_${to}.csv"`);
  res.send(csv);
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
