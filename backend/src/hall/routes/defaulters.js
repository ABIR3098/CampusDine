const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { nowParts } = require("../util");
const { computeBill } = require("./bill");
const { notify } = require("../advanced");

const router = express.Router();
const admin = requireRole("admin");
const pad = (n) => String(n).padStart(2, "0");
const taka = (n) => "৳" + Math.round(Number(n) * 100) / 100;
const monthName = (year, month) => new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const BATCH = 8; // how many people's bills are worked out at the same time

function parseMonth(q, now) {
  const [ny, nm] = now.dateKey.split("-").map(Number);
  const year = q.year === undefined ? ny : Number(q.year);
  const month = q.month === undefined ? nm : Number(q.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

// Everyone in the hall (Hall students + teachers) who still owes something for that month, biggest due first.
// "due" is the same number the person sees on My bill: closed meals minus what they already paid.
async function loadDefaulters(universityId, year, month, now) {
  const key = `${year}-${pad(month)}`;
  const uni = universityId || null;
  const [people] = await pool.query(
    `SELECT u.id, u.name, u.external_id AS externalId, u.role, u.wallet_balance AS walletBalance, COALESCE(a.enabled, 0) AS autopay
     FROM users u LEFT JOIN hall_autopay a ON a.user_id = u.id
     WHERE (u.role = 'teacher' OR (u.role = 'student' AND u.account_type = 'hall')) AND (? IS NULL OR u.university_id = ?)
     ORDER BY u.name`, [uni, uni]);
  const [payRows] = await pool.query("SELECT user_id, COALESCE(SUM(amount), 0) AS paid FROM hall_payments WHERE ym = ? GROUP BY user_id", [key]);
  const [remRows] = await pool.query("SELECT user_id, MAX(created_at) AS last_at, MAX(created_at > NOW() - INTERVAL 1 DAY) AS is_recent FROM hall_notifications WHERE kind = 'bill_reminder' GROUP BY user_id");
  const paidBy = new Map(payRows.map((r) => [r.user_id, Number(r.paid)]));
  const remBy = new Map(remRows.map((r) => [r.user_id, r]));

  const rows = [];
  for (let i = 0; i < people.length; i += BATCH) {
    const bills = await Promise.all(people.slice(i, i + BATCH).map((p) => computeBill(pool, p.id, year, month, now)));
    bills.forEach((bill, j) => {
      const p = people[i + j];
      const paid = paidBy.get(p.id) || 0;
      const confirmed = Number(bill.summary.confirmedTotal) || 0;
      const due = Math.max(0, confirmed - paid);
      if (due <= 0) return;
      const wallet = Number(p.walletBalance) || 0;
      const rem = remBy.get(p.id);
      rows.push({
        id: p.id, name: p.name, externalId: p.externalId, role: p.role,
        due, paid, confirmed, wallet, shortfall: Math.max(0, due - wallet),
        autopay: !!p.autopay, lastReminded: rem ? rem.last_at : null, remindedRecently: !!(rem && Number(rem.is_recent)),
      });
    });
  }
  rows.sort((a, b) => b.due - a.due || String(a.name).localeCompare(String(b.name)));
  return { members: people.length, rows };
}

// GET /api/hall/defaulters?year=2026&month=10   (admin; default: this month)
// → { year, month, today, members, summary: { count, totalDue, totalShortfall, autopayOn }, defaulters: [row] }
router.get("/defaulters", admin, catchAsync(async (req, res) => {
  const now = nowParts();
  const ym = parseMonth(req.query, now);
  if (!ym) return res.status(400).json({ error: "Invalid month" });
  const { members, rows } = await loadDefaulters(req.user.universityId, ym.year, ym.month, now);
  res.json({
    ...ym, today: now.dateKey, members,
    summary: {
      count: rows.length,
      totalDue: rows.reduce((a, r) => a + r.due, 0),
      totalShortfall: rows.reduce((a, r) => a + r.shortfall, 0),
      autopayOn: rows.filter((r) => r.autopay).length,
    },
    defaulters: rows,
  });
}));

// POST /api/hall/defaulters/remind   (admin)   body: { year?, month?, userIds?: [id] }   no userIds = everyone who owes
// Sends a Hall notification (and an email when SMTP is set up). One reminder per person per 24 hours.
// → { sent, skipped: [{ id, name, reason }] }
router.post("/defaulters/remind", admin, catchAsync(async (req, res) => {
  const now = nowParts();
  const b = req.body || {};
  const ym = parseMonth(b, now);
  if (!ym) return res.status(400).json({ error: "Invalid month" });
  let ids = null;
  if (b.userIds !== undefined) {
    if (!Array.isArray(b.userIds) || b.userIds.length > 500 || b.userIds.some((x) => !Number.isSafeInteger(Number(x)))) {
      return res.status(400).json({ error: "userIds must be a list of user ids" });
    }
    ids = b.userIds.map(Number);
  }
  const { rows } = await loadDefaulters(req.user.universityId, ym.year, ym.month, now);
  const targets = ids ? rows.filter((r) => ids.includes(r.id)) : rows;
  const label = monthName(ym.year, ym.month);
  const skipped = [];
  if (ids) for (const id of ids) if (!rows.some((r) => r.id === id)) skipped.push({ id, name: null, reason: "Nothing due" });

  let sent = 0;
  for (const r of targets) {
    if (r.remindedRecently) { skipped.push({ id: r.id, name: r.name, reason: "Reminded in the last 24 hours" }); continue; }
    const hint = r.shortfall > 0 ? ` Your wallet has ${taka(r.wallet)}, so please add at least ${taka(r.shortfall)} first.` : " You can pay it from your wallet now.";
    await notify(r.id, "Hall bill reminder", `You have ${taka(r.due)} unpaid for ${label}.${hint} Open Hall → My bill to pay.`, "bill_reminder");
    sent++;
  }
  res.json({ sent, skipped });
}));

module.exports = router;
module.exports.loadDefaulters = loadDefaulters;
