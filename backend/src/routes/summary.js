const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();

// GET /api/summary?year=2026&month=10  (student/teacher) — "where did my money go this month"
// Only the logged-in person's own orders are counted. Cancelled orders are left out.
router.get("/", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const now = new Date();
  let year = Number(req.query.year) || now.getFullYear();
  let month = Number(req.query.month) || now.getMonth() + 1;
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid month" });
  }
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const uid = req.user.id;

  // created_at in [first day of month, first day of next month)
  const inMonth = "o.user_id = ? AND o.status != 'Cancelled' AND o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 MONTH)";

  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS spent, COALESCE(SUM(o.discount_amount), 0) AS discounts,
            COALESCE(AVG(o.total), 0) AS avgOrder, COALESCE(MAX(o.total), 0) AS biggest,
            COUNT(DISTINCT DATE(o.created_at)) AS activeDays
     FROM orders o WHERE ${inMonth}`, [uid, start, start]);

  const [[prev]] = await pool.query(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS spent FROM orders o WHERE ${inMonth}`, [uid, prevStart, prevStart]);

  const [byDay] = await pool.query(
    `SELECT DAY(o.created_at) AS day, COALESCE(SUM(o.total), 0) AS spent, COUNT(*) AS orders
     FROM orders o WHERE ${inMonth} GROUP BY day ORDER BY day`, [uid, start, start]);

  const [topItems] = await pool.query(
    `SELECT oi.name, SUM(oi.qty) AS qty, COALESCE(SUM(oi.qty * oi.price), 0) AS spent
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE ${inMonth} GROUP BY oi.name ORDER BY qty DESC, spent DESC LIMIT 5`, [uid, start, start]);

  const [byCategory] = await pool.query(
    `SELECT COALESCE(m.category, 'other') AS category, COALESCE(SUM(oi.qty * oi.price), 0) AS spent
     FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN menu_items m ON m.id = oi.menu_item_id
     WHERE ${inMonth} GROUP BY category ORDER BY spent DESC`, [uid, start, start]);

  const [byPayment] = await pool.query(
    `SELECT o.payment_method AS method, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS spent
     FROM orders o WHERE ${inMonth} GROUP BY o.payment_method`, [uid, start, start]);

  const [[topups]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_transactions
     WHERE user_id = ? AND label LIKE 'Wallet top-up%' AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 MONTH)`,
    [uid, start, start]);
  // Feature: spending — last 6 months (the selected month and the 5 before it), cancelled orders left out
  const [monthRows] = await pool.query(
    `SELECT YEAR(o.created_at) AS y, MONTH(o.created_at) AS m, COALESCE(SUM(o.total), 0) AS spent, COUNT(*) AS orders
     FROM orders o
     WHERE o.user_id = ? AND o.status != 'Cancelled'
       AND o.created_at >= DATE_SUB(?, INTERVAL 5 MONTH) AND o.created_at < DATE_ADD(?, INTERVAL 1 MONTH)
     GROUP BY y, m`, [uid, start, start]);
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const idx = year * 12 + (month - 1) - i;
    const y = Math.floor(idx / 12), m = (idx % 12) + 1;
    const row = monthRows.find((r) => Number(r.y) === y && Number(r.m) === m);
    months.push({ year: y, month: m, spent: row ? Number(row.spent) : 0, orders: row ? Number(row.orders) : 0 });
  }
  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [uid]);

  res.json({
    year, month,
    totals: {
      orders: Number(totals.orders), spent: Number(totals.spent), discounts: Number(totals.discounts),
      avgOrder: Number(totals.avgOrder), biggest: Number(totals.biggest), activeDays: Number(totals.activeDays),
    },
    prev: { year: prevYear, month: prevMonth, orders: Number(prev.orders), spent: Number(prev.spent) },
    byDay, topItems, byCategory, byPayment, months,
    wallet: { topups: Number(topups.total), balance: Number(user.wallet_balance) },
  });
}));

// Feature: monthly budget — the limit the user set and how much of this month they have spent (same rule as the Spending tab)
async function budgetInfo(uid) {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [[u]] = await pool.query("SELECT monthly_budget FROM users WHERE id = ?", [uid]);
  const [[s]] = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS spent FROM orders
     WHERE user_id = ? AND status != 'Cancelled' AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 MONTH)`, [uid, start, start]);
  return { limit: u && u.monthly_budget !== null ? Number(u.monthly_budget) : null, spent: Number(s.spent), month: start.slice(0, 7) };
}

// GET /api/summary/budget
router.get("/budget", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  res.json(await budgetInfo(req.user.id));
}));

// PUT /api/summary/budget  { limit: number | null }  — null removes the limit
router.put("/budget", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const raw = req.body ? req.body.limit : undefined;
  if (raw === null || raw === "") {
    await pool.query("UPDATE users SET monthly_budget = NULL WHERE id = ?", [req.user.id]);
  } else {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 50 || n > 100000) return res.status(400).json({ error: "Budget must be between ৳50 and ৳100,000" });
    await pool.query("UPDATE users SET monthly_budget = ? WHERE id = ?", [Math.round(n), req.user.id]);
  }
  res.json(await budgetInfo(req.user.id));
}));

module.exports = router;
