const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, localStamp } = require("../util");
const { loadStates } = require("../states");

const router = express.Router();
const people = requireRole("student", "teacher");

// how many people are still waiting ahead of `serial`, and which serial is being served now
async function queueInfo(db, date, slot, serial) {
  const [[r]] = await db.query(
    `SELECT MIN(serial) AS nowServing, SUM(serial < ?) AS ahead FROM hall_tokens WHERE the_date = ? AND slot = ? AND status = 'waiting'`,
    [serial, date, slot]);
  return { nowServing: r.nowServing, ahead: Number(r.ahead || 0) };
}

// GET /api/hall/token → today's tokens of the person: [{ slot, serial, plates, status, nowServing, ahead }]
router.get("/token", people, catchAsync(async (req, res) => {
  const date = nowParts().dateKey;
  const [rows] = await pool.query(
    "SELECT slot, serial, plates, status FROM hall_tokens WHERE the_date = ? AND user_id = ? ORDER BY FIELD(slot, 'breakfast', 'lunch', 'dinner')", [date, req.user.id]);
  const out = [];
  for (const r of rows) out.push({ ...r, ...(r.status === "waiting" ? await queueInfo(pool, date, r.slot, r.serial) : { nowServing: null, ahead: 0 }) });
  res.json({ date, tokens: out });
}));

// POST /api/hall/token  body: { slot } — take a token for today's meal (needs the meal ON, or guest plates)
router.post("/token", people, catchAsync(async (req, res) => {
  const slot = (req.body || {}).slot;
  if (!SLOTS.includes(slot)) return res.status(400).json({ error: "Choose breakfast, lunch or dinner" });
  const date = nowParts().dateKey;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[mine]] = await conn.query("SELECT serial FROM hall_tokens WHERE the_date = ? AND slot = ? AND user_id = ?", [date, slot, req.user.id]);
    if (mine) { await conn.rollback(); return res.status(409).json({ error: `You already have token #${mine.serial} for this meal` }); }

    const [day] = await loadStates(conn, req.user.id, date, date);
    const [[g]] = await conn.query("SELECT COALESCE(SUM(guest_count), 0) AS n FROM hall_guests WHERE user_id = ? AND the_date = ? AND slot = ?", [req.user.id, date, slot]);
    const plates = (day.slots[slot].status === "on" ? 1 : 0) + Number(g.n);
    if (plates === 0) { await conn.rollback(); return res.status(400).json({ error: "This meal is OFF for you and you have no guests — no token needed" }); }

    const [[m]] = await conn.query("SELECT COALESCE(MAX(serial), 0) AS s FROM hall_tokens WHERE the_date = ? AND slot = ? FOR UPDATE", [date, slot]);
    const serial = m.s + 1;
    await conn.query("INSERT INTO hall_tokens (the_date, slot, user_id, serial, plates, created_at) VALUES (?, ?, ?, ?, ?, ?)", [date, slot, req.user.id, serial, plates, localStamp()]);
    await conn.commit();
    res.status(201).json({ slot, serial, plates, status: "waiting", ...(await queueInfo(pool, date, slot, serial)) });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// GET /api/hall/queue?slot=lunch (admin) → today's queue for that meal
router.get("/queue", requireRole("admin"), catchAsync(async (req, res) => {
  const slot = req.query.slot;
  if (!SLOTS.includes(slot)) return res.status(400).json({ error: "Choose breakfast, lunch or dinner" });
  const date = nowParts().dateKey;
  const [rows] = await pool.query(
    `SELECT t.serial, t.plates, t.status, u.name, u.external_id AS externalId, u.role
     FROM hall_tokens t JOIN users u ON u.id = t.user_id WHERE t.the_date = ? AND t.slot = ? ORDER BY t.serial`, [date, slot]);
  const waiting = rows.filter((r) => r.status === "waiting");
  res.json({
    date, slot,
    nowServing: waiting.length ? waiting[0].serial : null,
    waiting, waitingPlates: waiting.reduce((a, r) => a + r.plates, 0),
    served: rows.filter((r) => r.status === "served").length,
  });
}));

// POST /api/hall/queue/serve (admin) body: { slot, serial } — mark a token as served
router.post("/queue/serve", requireRole("admin"), catchAsync(async (req, res) => {
  const { slot, serial } = req.body || {};
  if (!SLOTS.includes(slot) || !Number.isInteger(Number(serial))) return res.status(400).json({ error: "slot and serial are required" });
  const date = nowParts().dateKey;
  const [[t]] = await pool.query("SELECT status FROM hall_tokens WHERE the_date = ? AND slot = ? AND serial = ?", [date, slot, Number(serial)]);
  if (!t) return res.status(404).json({ error: `No token #${serial} today for this meal` });
  if (t.status === "served") return res.status(409).json({ error: `Token #${serial} is already served` });
  await pool.query("UPDATE hall_tokens SET status = 'served', served_at = ? WHERE the_date = ? AND slot = ? AND serial = ?", [localStamp(), date, slot, Number(serial)]);
  res.json({ ok: true, serial: Number(serial) });
}));

module.exports = router;
