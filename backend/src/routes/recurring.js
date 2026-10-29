// Weekly (recurring) order reminders — nothing is ordered or charged automatically.
const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();
router.use(verifyToken, requireRole("student", "teacher"));

const MAX_PLANS = 5;          // per person
const DUE_WINDOW_MIN = 240;   // a reminder stays on screen for 4 hours after its time

const pad = (n) => String(n).padStart(2, "0");
const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const shape = (row) => ({
  id: row.id,
  items: JSON.parse(row.items),
  days: String(row.days).split(",").filter((x) => x !== "").map(Number),
  time: row.at_time,
  active: !!row.active,
});

// GET /api/recurring — my plans
router.get("/", catchAsync(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM recurring_orders WHERE user_id = ? ORDER BY id", [req.user.id]);
  res.json(rows.map(shape));
}));

// GET /api/recurring/due — plans whose reminder time has come today (and that weren't added/skipped yet)
router.get("/due", catchAsync(async (req, res) => {
  const now = new Date();
  const today = todayStr(now);
  const dow = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [rows] = await pool.query(
    "SELECT * FROM recurring_orders WHERE user_id = ? AND active = 1 AND (last_done IS NULL OR last_done <> ?)", [req.user.id, today]);
  const due = rows.map(shape)
    .filter((p) => p.days.includes(dow) && nowMin - minutesOf(p.time) >= 0 && nowMin - minutesOf(p.time) <= DUE_WINDOW_MIN)
    .map((p) => ({ ...p, today }));
  res.json(due);
}));

// POST /api/recurring — { items: [{ id?, name?, qty }], days: [0-6], time: "HH:MM" }
router.post("/", catchAsync(async (req, res) => {
  const rawItems = Array.isArray(req.body.items) ? req.body.items.slice(0, 8) : [];
  const days = [...new Set((Array.isArray(req.body.days) ? req.body.days : []).map(Number))]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  const time = String(req.body.time || "");
  if (days.length === 0) return res.status(400).json({ error: "Choose at least one day" });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return res.status(400).json({ error: "Choose a reminder time" });

  const merged = new Map();
  for (const it of rawItems) {
    const qty = Math.min(5, Math.max(1, parseInt(it && it.qty, 10) || 1));
    let found = null;
    if (it && Number.isInteger(Number(it.id)) && it.id !== null && it.id !== undefined && it.id !== "") {
      [[found]] = await pool.query("SELECT id, name FROM menu_items WHERE id = ? AND availability <> 'hidden'", [Number(it.id)]);
    }
    if (!found && it && typeof it.name === "string" && it.name) {
      [[found]] = await pool.query("SELECT id, name FROM menu_items WHERE name = ? AND availability <> 'hidden' LIMIT 1", [it.name]);
    }
    if (found) merged.set(found.id, { id: found.id, name: found.name, qty: Math.min(5, (merged.get(found.id)?.qty || 0) + qty) });
  }
  if (merged.size === 0) return res.status(400).json({ error: "These items are not on the menu any more" });

  const [[count]] = await pool.query("SELECT COUNT(*) AS n FROM recurring_orders WHERE user_id = ?", [req.user.id]);
  if (Number(count.n) >= MAX_PLANS) return res.status(409).json({ error: `You can keep up to ${MAX_PLANS} weekly orders — delete one first` });

  const [result] = await pool.query(
    "INSERT INTO recurring_orders (user_id, items, days, at_time) VALUES (?, ?, ?, ?)",
    [req.user.id, JSON.stringify([...merged.values()]), days.join(","), time]);
  const [[row]] = await pool.query("SELECT * FROM recurring_orders WHERE id = ?", [result.insertId]);
  res.status(201).json(shape(row));
}));

// PATCH /api/recurring/:id — { active: true|false } pause / resume
router.patch("/:id", catchAsync(async (req, res) => {
  const [result] = await pool.query("UPDATE recurring_orders SET active = ? WHERE id = ? AND user_id = ?",
    [req.body.active === false ? 0 : 1, Number(req.params.id), req.user.id]);
  if (!result.affectedRows) {
    const [[exists]] = await pool.query("SELECT id FROM recurring_orders WHERE id = ? AND user_id = ?", [Number(req.params.id), req.user.id]);
    if (!exists) return res.status(404).json({ error: "Weekly order not found" });
  }
  res.json({ ok: true });
}));

// DELETE /api/recurring/:id
router.delete("/:id", catchAsync(async (req, res) => {
  const [result] = await pool.query("DELETE FROM recurring_orders WHERE id = ? AND user_id = ?", [Number(req.params.id), req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Weekly order not found" });
  res.json({ ok: true });
}));

// POST /api/recurring/:id/done — added to the cart or skipped: hide today's reminder
router.post("/:id/done", catchAsync(async (req, res) => {
  const [result] = await pool.query("UPDATE recurring_orders SET last_done = ? WHERE id = ? AND user_id = ?",
    [todayStr(), Number(req.params.id), req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Weekly order not found" });
  res.json({ ok: true });
}));

module.exports = router;
