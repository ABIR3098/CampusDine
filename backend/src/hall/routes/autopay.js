const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { nowParts, localStamp } = require("../util");
const { GRACE_DAYS, previousMonth, runAutoPay } = require("../autopay");

const router = express.Router();
const memberOnly = requireRole("student", "teacher");

// GET /api/hall/autopay → { enabled, graceDays, history: [{ ym, status, amount, due, balance, createdAt }] }  (last 6 runs, newest first)
router.get("/autopay", memberOnly, catchAsync(async (req, res) => {
  const [[row]] = await pool.query("SELECT enabled FROM hall_autopay WHERE user_id = ?", [req.user.id]);
  const [logs] = await pool.query(
    "SELECT ym, status, amount, due, balance, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS createdAt FROM hall_autopay_log WHERE user_id = ? ORDER BY id DESC LIMIT 6",
    [req.user.id]);
  res.json({ enabled: !!(row && row.enabled), graceDays: GRACE_DAYS, history: logs });
}));

// PUT /api/hall/autopay   body: { enabled: true | false }
router.put("/autopay", memberOnly, catchAsync(async (req, res) => {
  const enabled = (req.body || {}).enabled;
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be true or false" });
  await pool.query(
    "INSERT INTO hall_autopay (user_id, enabled, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_at = VALUES(updated_at)",
    [req.user.id, enabled ? 1 : 0, localStamp()]);
  res.json({ enabled });
}));

// POST /api/hall/autopay/run   (admin)   body: { year?, month? }  default: last month
// Runs auto-pay right now for this university (ignores the 1st-10th window, so it can be shown in a demo).
router.post("/autopay/run", requireRole("admin"), catchAsync(async (req, res) => {
  const now = nowParts();
  const b = req.body || {};
  let target = previousMonth(now);
  if (b.year != null || b.month != null) {
    const year = Number(b.year), month = Number(b.month);
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: "year and month must look like 2026 and 10" });
    }
    target = { year, month };
  }
  const done = await runAutoPay(now, { target, ignoreGrace: true, universityId: req.user.universityId });
  res.json({
    year: target.year, month: target.month, people: done.length,
    paid: done.filter((d) => d.status === "paid").length,
    short: done.filter((d) => d.status === "short").length,
    nothing: done.filter((d) => d.status === "nothing").length,
    failed: done.filter((d) => d.status === "error").length,
    totalTaken: done.reduce((a, d) => a + (d.amount || 0), 0),
  });
}));

module.exports = router;
