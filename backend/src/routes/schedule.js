const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { loadSettings } = require("../utils/settings");
const { slotsWithLoad } = require("../utils/slots");
const { todayStr, isDateOnly, weekdayOf, nowMinutes, toMin, fromMin } = require("../utils/dates");

const router = express.Router();
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
router.use(verifyToken, requireRole("student", "teacher"));

router.get("/", async (req, res) => {
  const [classes] = await pool.query("SELECT id, weekday, TIME_FORMAT(start_time, '%H:%i') AS start_time, TIME_FORMAT(end_time, '%H:%i') AS end_time, title FROM class_schedule WHERE user_id = ? ORDER BY weekday, start_time", [req.user.id]);
  res.json({ classes });
});

// POST { weekday: 0-6 (0 = Sunday), start: "09:00", end: "10:30", title }
router.post("/", async (req, res) => {
  const weekday = Number(req.body.weekday);
  const { start, end } = req.body;
  const title = String(req.body.title || "").trim();
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return res.status(400).json({ error: "weekday must be 0 (Sunday) to 6 (Saturday)" });
  if (!TIME_RE.test(String(start)) || !TIME_RE.test(String(end))) return res.status(400).json({ error: "start and end must be HH:MM" });
  if (start >= end) return res.status(400).json({ error: "End time must be after start time" });
  if (!title || title.length > 80) return res.status(400).json({ error: "title must be 1-80 characters" });
  const [[cnt]] = await pool.query("SELECT COUNT(*) AS c FROM class_schedule WHERE user_id = ?", [req.user.id]);
  if (cnt.c >= 40) return res.status(400).json({ error: "You can save up to 40 classes" });
  const [clash] = await pool.query("SELECT title FROM class_schedule WHERE user_id = ? AND weekday = ? AND start_time < ? AND end_time > ? LIMIT 1", [req.user.id, weekday, end, start]);
  if (clash.length) return res.status(409).json({ error: `Overlaps with "${clash[0].title}"` });
  const [r] = await pool.query("INSERT INTO class_schedule (user_id, weekday, start_time, end_time, title) VALUES (?, ?, ?, ?, ?)", [req.user.id, weekday, start, end, title]);
  res.status(201).json({ id: r.insertId, weekday, start_time: start, end_time: end, title });
});

router.delete("/:id", async (req, res) => {
  const [r] = await pool.query("DELETE FROM class_schedule WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (!r.affectedRows) return res.status(404).json({ error: "Class not found" });
  res.json({ ok: true });
});

// GET /api/schedule/suggest?date= — free windows around your lectures + the best slot to order for.
router.get("/suggest", async (req, res) => {
  const date = req.query.date || todayStr();
  if (!isDateOnly(date) || date < todayStr()) return res.status(400).json({ error: "date must be today or later" });
  const S = await loadSettings(pool);
  const [classes] = await pool.query("SELECT title, TIME_FORMAT(start_time, '%H:%i:%s') AS start_time, TIME_FORMAT(end_time, '%H:%i:%s') AS end_time FROM class_schedule WHERE user_id = ? AND weekday = ? ORDER BY start_time", [req.user.id, weekdayOf(date)]);
  const slots = await slotsWithLoad(pool, date, S, classes);
  const free = [];
  let cur = null;
  for (const s of slots) {
    const ok = !s.clash && !s.past;
    if (ok && cur && toMin(s.time) === toMin(cur.to)) cur.to = s.endTime;
    else if (ok) { cur = { from: s.time, to: s.endTime }; free.push(cur); }
    else cur = null;
  }
  const lead = date === todayStr() ? nowMinutes() + 10 : -1; // today: leave 10 min for the kitchen
  const usable = slots.filter((s) => s.available && !s.clash && toMin(s.time) >= lead);
  const best = usable.find((s) => s.status !== "busy") || usable[0] || null;
  const nextClass = date === todayStr() ? classes.find((c) => toMin(c.start_time.slice(0, 5)) > nowMinutes()) || null : classes[0] || null;
  res.json({
    date, classes: classes.map((c) => ({ title: c.title, start: c.start_time.slice(0, 5), end: c.end_time.slice(0, 5) })),
    free: free.map((f) => ({ ...f, minutes: toMin(f.to) - toMin(f.from) })),
    suggestedSlot: best ? best.time : null,
    message: best ? `You're free at ${best.time} — order now for a ${best.time} pickup${best.status === "quiet" ? " (quiet time!)" : ""}.` : slots.length ? "No free slot fits around your classes today." : "The canteen has no pickup slots on this date.",
    nextClass: nextClass ? { title: nextClass.title, start: nextClass.start_time.slice(0, 5) } : null,
  });
});

module.exports = router;
