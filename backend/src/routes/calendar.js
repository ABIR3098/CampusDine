const express = require("express");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// GET /api/calendar?year=2026&month=8   (month is 1-12)
router.get("/", verifyToken, async (req, res) => {
  const { year, month } = parseYearMonth(req.query);
  const [rows] = await pool.query(
    "SELECT the_date, status FROM meal_calendar WHERE user_id = ? AND YEAR(the_date) = ? AND MONTH(the_date) = ?",
    [req.user.id, year, month]
  );
  res.json(rows);
});

// PUT /api/calendar/:day  body: { year, month, status: 'off'|'full'|'half' }
router.put("/:day", verifyToken, async (req, res) => {
  const { year, month, status } = req.body;
  const day = Number(req.params.day);
  if (!["off", "full", "half"].includes(status)) {
    return res.status(400).json({ error: "status must be off, full or half" });
  }
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  await pool.query(
    `INSERT INTO meal_calendar (user_id, the_date, status) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status)`,
    [req.user.id, dateStr, status]
  );
  res.json({ date: dateStr, status });
});

// GET /api/calendar/bill?year=2026&month=8 — auto-computed monthly bill for the logged-in user
router.get("/bill", verifyToken, async (req, res) => {
  const { year, month } = parseYearMonth(req.query);

  const [[rate]] = await pool.query("SELECT full_rate, half_rate FROM meal_rates WHERE role = ?", [
    req.user.role === "teacher" ? "teacher" : "student",
  ]);
  const [rows] = await pool.query(
    "SELECT status, COUNT(*) AS cnt FROM meal_calendar WHERE user_id = ? AND YEAR(the_date) = ? AND MONTH(the_date) = ? GROUP BY status",
    [req.user.id, year, month]
  );

  const fullDays = rows.find((r) => r.status === "full")?.cnt || 0;
  const halfDays = rows.find((r) => r.status === "half")?.cnt || 0;
  const total = fullDays * rate.full_rate + halfDays * rate.half_rate;

  res.json({ fullDays, halfDays, fullRate: rate.full_rate, halfRate: rate.half_rate, total });
});

function parseYearMonth(query) {
  const now = new Date();
  return {
    year: Number(query.year) || now.getFullYear(),
    month: Number(query.month) || now.getMonth() + 1,
  };
}

module.exports = router;
