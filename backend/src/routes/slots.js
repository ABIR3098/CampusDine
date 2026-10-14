const express = require("express");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");
const { loadSettings } = require("../utils/settings");
const { slotsWithLoad } = require("../utils/slots");
const { todayStr, addDays, isDateOnly, weekdayOf } = require("../utils/dates");

const router = express.Router();

// GET /api/slots?date=YYYY-MM-DD — pickup slots with the live "rush meter" (quiet / moderate / busy / full).
router.get("/", verifyToken, async (req, res) => {
  const date = req.query.date || todayStr();
  if (!isDateOnly(date) || date < todayStr() || date > addDays(todayStr(), 30)) return res.status(400).json({ error: "date must be between today and 30 days ahead" });
  const S = await loadSettings(pool);
  let classes = [];
  if (req.user.role !== "admin") [classes] = await pool.query("SELECT title, start_time, end_time FROM class_schedule WHERE user_id = ? AND weekday = ?", [req.user.id, weekdayOf(date)]);
  const slots = await slotsWithLoad(pool, date, S, classes);
  res.json({ date, slots, ramadan: S.ramadan_mode, jummah: S.jummah_mode && weekdayOf(date) === 5, open: S.open_time, close: S.close_time });
});

module.exports = router;
