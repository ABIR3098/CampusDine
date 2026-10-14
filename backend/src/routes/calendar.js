const express = require("express");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");
const { todayStr, isDateOnly } = require("../utils/dates");

const router = express.Router();

function parseYearMonth(query) {
  const [ty, tm] = todayStr().split("-").map(Number);
  const year = query.year === undefined ? ty : Number(query.year);
  const month = query.month === undefined ? tm : Number(query.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) throw { status: 400, message: "Invalid year or month" };
  return { year, month };
}

router.get("/", verifyToken, async (req, res) => {
  const { year, month } = parseYearMonth(req.query);
  const [rows] = await pool.query("SELECT the_date, status FROM meal_calendar WHERE user_id = ? AND YEAR(the_date) = ? AND MONTH(the_date) = ?", [req.user.id, year, month]);
  res.json(rows);
});

// PUT /api/calendar/:day { year, month, status }
router.put("/:day", verifyToken, async (req, res) => {
  const { status } = req.body;
  if (!["off", "full", "half"].includes(status)) return res.status(400).json({ error: "status must be off, full or half" });
  const year = Number(req.body.year), month = Number(req.body.month), day = Number(req.params.day);
  if (![year, month, day].every(Number.isInteger) || month < 1 || month > 12 || day < 1 || day > 31) return res.status(400).json({ error: "Invalid calendar date" });
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!isDateOnly(dateStr) || dateStr < todayStr()) return res.status(400).json({ error: "Calendar date must be today or in the future" });
  await pool.query("INSERT INTO meal_calendar (user_id, the_date, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)", [req.user.id, dateStr, status]);
  res.json({ date: dateStr, status });
});

router.get("/bill", verifyToken, async (req, res) => {
  const { year, month } = parseYearMonth(req.query);
  const [[rate]] = await pool.query("SELECT full_rate, half_rate FROM meal_rates WHERE role = ?", [req.user.role === "teacher" ? "teacher" : "student"]);
  const [rows] = await pool.query("SELECT status, COUNT(*) AS cnt FROM meal_calendar WHERE user_id = ? AND YEAR(the_date) = ? AND MONTH(the_date) = ? GROUP BY status", [req.user.id, year, month]);
  const fullDays = rows.find((r) => r.status === "full")?.cnt || 0;
  const halfDays = rows.find((r) => r.status === "half")?.cnt || 0;
  const fullRate = rate?.full_rate || 0, halfRate = rate?.half_rate || 0;
  res.json({ fullDays, halfDays, fullRate, halfRate, total: fullDays * fullRate + halfDays * halfRate });
});

module.exports = router;
