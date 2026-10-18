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
  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [uid]);

  res.json({
    year, month,
    totals: {
      orders: Number(totals.orders), spent: Number(totals.spent), discounts: Number(totals.discounts),
      avgOrder: Number(totals.avgOrder), biggest: Number(totals.biggest), activeDays: Number(totals.activeDays),
    },
    prev: { year: prevYear, month: prevMonth, orders: Number(prev.orders), spent: Number(prev.spent) },
    byDay, topItems, byCategory, byPayment,
    wallet: { topups: Number(topups.total), balance: Number(user.wallet_balance) },
  });
}));

module.exports = router;
