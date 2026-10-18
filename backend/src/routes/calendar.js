const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();
router.use(verifyToken, requireRole("student", "teacher")); // meal plans are for students and teachers

// ─────────────── Meal plan = the monthly calendar, pre-paid from the wallet ───────────────
// Each day is Off / Full / Half. Marked days are "due" until the person pays the month's plan from
// their wallet. A paid day remembers what it cost (paid_amount). Paid days in the future can still be
// changed (the money goes back to the wallet); today's and past paid days are locked.

const pad = (n) => String(n).padStart(2, "0");
const dateStr = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const todayStr = () => { const t = new Date(); return dateStr(t.getFullYear(), t.getMonth() + 1, t.getDate()); };

function parseYearMonth(src) {
  const now = new Date();
  const year = Number(src.year) || now.getFullYear();
  const month = Number(src.month) || now.getMonth() + 1;
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

async function ratesFor(db, role) {
  const [[rate]] = await db.query("SELECT full_rate, half_rate FROM meal_rates WHERE role = ?", [role === "teacher" ? "teacher" : "student"]);
  return rate;
}

// GET /api/calendar?year=2026&month=8   (month is 1-12)  → [{ the_date, status, paid }]
router.get("/", catchAsync(async (req, res) => {
  const ym = parseYearMonth(req.query);
  if (!ym) return res.status(400).json({ error: "Invalid month" });
  const [rows] = await pool.query(
    "SELECT the_date, status, (paid_amount IS NOT NULL) AS paid FROM meal_calendar WHERE user_id = ? AND YEAR(the_date) = ? AND MONTH(the_date) = ?",
    [req.user.id, ym.year, ym.month]
  );
  res.json(rows.map((r) => ({ the_date: r.the_date, status: r.status, paid: !!r.paid })));
}));

// GET /api/calendar/bill?year=&month= — the month's plan: total, what is already paid, what is still due
router.get("/bill", catchAsync(async (req, res) => {
  const ym = parseYearMonth(req.query);
  if (!ym) return res.status(400).json({ error: "Invalid month" });
  const rate = await ratesFor(pool, req.user.role);
  const [rows] = await pool.query(
    `SELECT status, (paid_amount IS NOT NULL) AS paid, COUNT(*) AS cnt, COALESCE(SUM(paid_amount), 0) AS paidSum
     FROM meal_calendar WHERE user_id = ? AND YEAR(the_date) = ? AND MONTH(the_date) = ? AND status IN ('full','half')
     GROUP BY status, paid`,
    [req.user.id, ym.year, ym.month]
  );
  const n = (status, paid) => Number((rows.find((r) => r.status === status && !!r.paid === paid) || {}).cnt || 0);
  const fullDays = n("full", true) + n("full", false);
  const halfDays = n("half", true) + n("half", false);
  const dueFull = n("full", false), dueHalf = n("half", false);
  const paidAmount = rows.filter((r) => r.paid).reduce((a, r) => a + Number(r.paidSum), 0);
  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);

  res.json({
    fullDays, halfDays, fullRate: rate.full_rate, halfRate: rate.half_rate,
    total: fullDays * rate.full_rate + halfDays * rate.half_rate,
    paidDays: n("full", true) + n("half", true), paidAmount,
    dueDays: dueFull + dueHalf, dueAmount: dueFull * rate.full_rate + dueHalf * rate.half_rate,
    walletBalance: user.wallet_balance,
  });
}));

// POST /api/calendar/pay  body: { year, month } — pay every unpaid Full/Half day of the month from the wallet
router.post("/pay", catchAsync(async (req, res) => {
  const ym = parseYearMonth(req.body || {});
  if (!ym) return res.status(400).json({ error: "Invalid month" });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const rate = await ratesFor(conn, req.user.role);
    const [days] = await conn.query(
      `SELECT id, status FROM meal_calendar
       WHERE user_id = ? AND YEAR(the_date) = ? AND MONTH(the_date) = ? AND status IN ('full','half') AND paid_amount IS NULL FOR UPDATE`,
      [req.user.id, ym.year, ym.month]
    );
    if (days.length === 0) { await conn.rollback(); return res.status(400).json({ error: "Nothing to pay — no unpaid meal days this month" }); }
    const full = days.filter((d) => d.status === "full").length;
    const half = days.length - full;
    const total = full * rate.full_rate + half * rate.half_rate;

    const [[user]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [req.user.id]);
    if (user.wallet_balance < total) { await conn.rollback(); return res.status(402).json({ error: "Insufficient wallet balance — add money to your wallet first" }); }

    await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [total, req.user.id]);
    await conn.query(
      `UPDATE meal_calendar SET paid_amount = IF(status = 'full', ?, ?), paid_at = NOW()
       WHERE id IN (${days.map(() => "?").join(",")})`,
      [rate.full_rate, rate.half_rate, ...days.map((d) => d.id)]
    );
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
      req.user.id, `Meal plan ${ym.year}-${pad(ym.month)} (${full} full, ${half} half)`, -total,
    ]);
    await conn.commit();
    res.json({ ok: true, paid: total, days: days.length, balance: user.wallet_balance - total });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// POST /api/calendar/repeat  body: { year, month } — copy the usual weekly pattern of the previous month
// onto this month's days that are still unmarked (today and later). Nothing is paid by this.
router.post("/repeat", catchAsync(async (req, res) => {
  const ym = parseYearMonth(req.body || {});
  if (!ym) return res.status(400).json({ error: "Invalid month" });
  const prevYear = ym.month === 1 ? ym.year - 1 : ym.year;
  const prevMonth = ym.month === 1 ? 12 : ym.month - 1;

  // for each weekday (1 = Sunday … 7 = Saturday) the status used most often last month
  const [rows] = await pool.query(
    `SELECT DAYOFWEEK(the_date) AS dow, status, COUNT(*) AS cnt FROM meal_calendar
     WHERE user_id = ? AND YEAR(the_date) = ? AND MONTH(the_date) = ? GROUP BY dow, status`,
    [req.user.id, prevYear, prevMonth]
  );
  if (rows.length === 0) return res.status(400).json({ error: "Last month has no meal plan to copy" });
  const pattern = {};
  for (const r of rows) if (!pattern[r.dow] || r.cnt > pattern[r.dow].cnt) pattern[r.dow] = r;

  const [existing] = await pool.query(
    "SELECT DAY(the_date) AS d FROM meal_calendar WHERE user_id = ? AND YEAR(the_date) = ? AND MONTH(the_date) = ?",
    [req.user.id, ym.year, ym.month]
  );
  const taken = new Set(existing.map((e) => e.d));
  const today = todayStr();
  const last = new Date(ym.year, ym.month, 0).getDate();
  const toAdd = [];
  for (let d = 1; d <= last; d++) {
    const ds = dateStr(ym.year, ym.month, d);
    if (ds < today || taken.has(d)) continue;
    const p = pattern[new Date(ym.year, ym.month - 1, d).getDay() + 1];
    if (p && p.status !== "off") toAdd.push([req.user.id, ds, p.status]);
  }
  if (toAdd.length) await pool.query("INSERT INTO meal_calendar (user_id, the_date, status) VALUES ?", [toAdd]);
  res.json({ added: toAdd.length });
}));

// PUT /api/calendar/:day  body: { year, month, status: 'off'|'full'|'half' }
router.put("/:day", catchAsync(async (req, res) => {
  const { year, month, status } = req.body;
  const day = Number(req.params.day);
  if (!["off", "full", "half"].includes(status)) return res.status(400).json({ error: "status must be off, full or half" });
  const y = Number(year), m = Number(month);
  const real = new Date(y, m - 1, day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(day) || real.getFullYear() !== y || real.getMonth() !== m - 1 || real.getDate() !== day) {
    return res.status(400).json({ error: "Invalid date" });
  }
  const ds = dateStr(y, m, day);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[row]] = await conn.query("SELECT id, status, paid_amount FROM meal_calendar WHERE user_id = ? AND the_date = ? FOR UPDATE", [req.user.id, ds]);
    let refunded = 0;
    if (row && row.paid_amount !== null) {
      if (ds <= todayStr()) { await conn.rollback(); return res.status(409).json({ error: "This day is already paid and locked — today's and past meals can't be changed" }); }
      refunded = Number(row.paid_amount);
      await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [refunded, req.user.id]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [req.user.id, `Meal plan refund ${ds}`, refunded]);
    }
    await conn.query(
      `INSERT INTO meal_calendar (user_id, the_date, status) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), paid_amount = NULL, paid_at = NULL`,
      [req.user.id, ds, status]
    );
    await conn.commit();
    res.json({ date: ds, status, refunded });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

module.exports = router;
