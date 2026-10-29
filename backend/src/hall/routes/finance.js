const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, isDateKey, localStamp } = require("../util");

const router = express.Router();
const admin = requireRole("admin");
const pad = (n) => String(n).padStart(2, "0");
const money = (n) => Math.round(Number(n || 0) * 100) / 100;
// the people whose meals count: Hall students and teachers (regular canteen accounts are not part of the hall)
const MEMBER = "(u.role = 'teacher' OR (u.role = 'student' AND u.account_type = 'hall')) AND (? IS NULL OR u.university_id = ?)";

const CATEGORIES = [
  { key: "grains", label: "Rice & grains" },
  { key: "protein", label: "Meat, fish & eggs" },
  { key: "veg", label: "Vegetables & fruit" },
  { key: "oil", label: "Oil, spices & dairy" },
  { key: "fuel", label: "Gas & fuel" },
  { key: "wages", label: "Staff wages" },
  { key: "utility", label: "Water & electricity" },
  { key: "repair", label: "Repairs & equipment" },
  { key: "other", label: "Other" },
];

function parseMonth(q, now) {
  const [ny, nm] = now.dateKey.split("-").map(Number);
  const year = q.year === undefined ? ny : Number(q.year);
  const month = q.month === undefined ? nm : Number(q.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}
const lastDayOf = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

// GET /api/hall/finance/summary?year=2026&month=10   (admin; default this month)
// Income counts closed meals only (their price is fixed), so the numbers can't change after the fact.
// → { year, month, today, plates, billed, collected, outstanding, lastCall: { plates, amount }, expense: { total, byCategory },
//     perPlate: { cost, price, margin }, result: { cash, ifAllPaid }, bySlot: [{ slot, plates, billed }], daily: [{ date, plates, billed, expense }] }
router.get("/finance/summary", admin, catchAsync(async (req, res) => {
  const now = nowParts();
  const ym = parseMonth(req.query, now);
  if (!ym) return res.status(400).json({ error: "Invalid month" });
  const key = `${ym.year}-${pad(ym.month)}`;
  const from = `${key}-01`;
  const days = lastDayOf(ym.year, ym.month);
  const to = `${key}-${pad(days)}`;
  const uni = req.user.universityId || null;

  const [own] = await pool.query(
    `SELECT DATE_FORMAT(s.the_date, '%Y-%m-%d') AS d, s.slot, COUNT(*) AS plates, COALESCE(SUM(s.charged), 0) AS billed
     FROM hall_meal_state s JOIN users u ON u.id = s.user_id
     WHERE s.the_date >= ? AND s.the_date <= ? AND s.status = 'on' AND s.charged IS NOT NULL AND ${MEMBER}
     GROUP BY s.the_date, s.slot`, [from, to, uni, uni]);
  const [guest] = await pool.query(
    `SELECT DATE_FORMAT(g.the_date, '%Y-%m-%d') AS d, g.slot, COALESCE(SUM(g.guest_count), 0) AS plates, COALESCE(SUM(g.charged), 0) AS billed
     FROM hall_guests g JOIN users u ON u.id = g.user_id
     WHERE g.the_date >= ? AND g.the_date <= ? AND g.charged IS NOT NULL AND ${MEMBER}
     GROUP BY g.the_date, g.slot`, [from, to, uni, uni]);
  const [[paid]] = await pool.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS collected FROM hall_payments p JOIN users u ON u.id = p.user_id WHERE p.ym = ? AND ${MEMBER}`, [key, uni, uni]);
  const [spent] = await pool.query(
    `SELECT DATE_FORMAT(expense_date, '%Y-%m-%d') AS d, category, SUM(amount) AS amount FROM hall_expenses
     WHERE expense_date >= ? AND expense_date <= ? AND (? IS NULL OR university_id = ?) GROUP BY expense_date, category`, [from, to, uni, uni]);
  let lastCall = { plates: 0, amount: 0 };
  try {
    const [[lc]] = await pool.query(
      `SELECT COUNT(c.id) AS plates, COALESCE(SUM(c.price), 0) AS amount FROM hall_lastcall_claims c JOIN hall_lastcalls l ON l.id = c.lastcall_id
       WHERE l.the_date >= ? AND l.the_date <= ? AND c.status <> 'cancelled' AND (? IS NULL OR l.university_id = ?)`, [from, to, uni, uni]);
    lastCall = { plates: Number(lc.plates), amount: money(lc.amount) };
  } catch (e) { /* the last-call tables are not there yet: count it as zero */ }

  const daily = Array.from({ length: days }, (_, i) => ({ date: `${key}-${pad(i + 1)}`, plates: 0, billed: 0, expense: 0 }));
  const dayOf = (d) => daily[Number(d.slice(8, 10)) - 1];
  const bySlot = Object.fromEntries(SLOTS.map((s) => [s, { slot: s, plates: 0, billed: 0 }]));
  for (const r of [...own, ...guest]) {
    const day = dayOf(r.d);
    day.plates += Number(r.plates); day.billed += Number(r.billed);
    if (bySlot[r.slot]) { bySlot[r.slot].plates += Number(r.plates); bySlot[r.slot].billed += Number(r.billed); }
  }
  const byCat = {};
  for (const r of spent) { dayOf(r.d).expense += Number(r.amount); byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount); }

  const plates = daily.reduce((a, d) => a + d.plates, 0);
  const billed = money(daily.reduce((a, d) => a + d.billed, 0));
  const expenseTotal = money(daily.reduce((a, d) => a + d.expense, 0));
  const collected = money(paid.collected);
  res.json({
    ...ym, today: now.dateKey, plates, billed, collected, outstanding: money(Math.max(0, billed - collected)), lastCall,
    expense: {
      total: expenseTotal,
      byCategory: Object.keys(byCat).map((k) => ({ category: k, label: (CATEGORIES.find((c) => c.key === k) || { label: k }).label, amount: money(byCat[k]) })).sort((a, b) => b.amount - a.amount),
    },
    perPlate: plates ? { cost: money(expenseTotal / plates), price: money(billed / plates), margin: money((billed - expenseTotal) / plates) } : null,
    result: { cash: money(collected + lastCall.amount - expenseTotal), ifAllPaid: money(billed + lastCall.amount - expenseTotal) },
    bySlot: SLOTS.map((s) => ({ slot: s, plates: bySlot[s].plates, billed: money(bySlot[s].billed) })),
    daily: daily.map((d) => ({ ...d, billed: money(d.billed), expense: money(d.expense) })),
  });
}));

// GET /api/hall/finance/expenses?year=&month=  → { categories, expenses: [{ id, date, category, categoryLabel, amount, supplierId, supplierName, note }] } newest first
router.get("/finance/expenses", admin, catchAsync(async (req, res) => {
  const ym = parseMonth(req.query, nowParts());
  if (!ym) return res.status(400).json({ error: "Invalid month" });
  const key = `${ym.year}-${pad(ym.month)}`;
  const uni = req.user.universityId || null;
  const [rows] = await pool.query(
    `SELECT e.id, DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS date, e.category, e.amount, e.supplier_id AS supplierId, s.name AS supplierName, e.note
     FROM hall_expenses e LEFT JOIN hall_suppliers s ON s.id = e.supplier_id
     WHERE e.expense_date >= ? AND e.expense_date <= ? AND (? IS NULL OR e.university_id = ?)
     ORDER BY e.expense_date DESC, e.id DESC`, [`${key}-01`, `${key}-${pad(lastDayOf(ym.year, ym.month))}`, uni, uni]);
  res.json({
    categories: CATEGORIES,
    expenses: rows.map((r) => ({ ...r, amount: money(r.amount), categoryLabel: (CATEGORIES.find((c) => c.key === r.category) || { label: r.category }).label })),
  });
}));

// POST /api/hall/finance/expenses   body: { date, category, amount, supplierId?, note? }
router.post("/finance/expenses", admin, catchAsync(async (req, res) => {
  const b = req.body || {};
  const date = String(b.date || "");
  const amount = Number(b.amount);
  const note = String(b.note || "").trim().slice(0, 255);
  const uni = req.user.universityId || null;
  if (!isDateKey(date)) return res.status(400).json({ error: "Date must look like 2026-10-22" });
  if (!CATEGORIES.some((c) => c.key === b.category)) return res.status(400).json({ error: "Pick a category" });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) return res.status(400).json({ error: "Amount must be more than 0" });
  let supplierId = null;
  if (b.supplierId !== undefined && b.supplierId !== null && b.supplierId !== "") {
    supplierId = Number(b.supplierId);
    if (!Number.isSafeInteger(supplierId) || supplierId < 1) return res.status(400).json({ error: "Invalid supplier" });
    const [[sup]] = await pool.query("SELECT id FROM hall_suppliers WHERE id = ? AND (? IS NULL OR university_id = ?)", [supplierId, uni, uni]);
    if (!sup) return res.status(400).json({ error: "Supplier not found" });
  }
  const [r] = await pool.query(
    "INSERT INTO hall_expenses (expense_date, category, amount, supplier_id, note, created_by, university_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [date, b.category, money(amount), supplierId, note || null, req.user.id, uni, localStamp()]);
  res.status(201).json({ id: r.insertId });
}));

// DELETE /api/hall/finance/expenses/:id   (for a wrong entry)
router.delete("/finance/expenses/:id", admin, catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
  const uni = req.user.universityId || null;
  const [r] = await pool.query("DELETE FROM hall_expenses WHERE id = ? AND (? IS NULL OR university_id = ?)", [id, uni, uni]);
  if (!r.affectedRows) return res.status(404).json({ error: "Expense not found" });
  res.json({ deleted: id });
}));

module.exports = router;
module.exports.CATEGORIES = CATEGORIES;
