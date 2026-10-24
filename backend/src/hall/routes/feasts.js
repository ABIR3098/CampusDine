const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, isDateKey, addDays, isLocked } = require("../util");

const router = express.Router();

const shape = (r) => ({ id: r.id, date: r.d, slot: r.slot, title: r.title, items: r.items, extraPrice: r.extra_price });
const SELECT = "SELECT id, DATE_FORMAT(the_date, '%Y-%m-%d') AS d, slot, title, items, extra_price FROM hall_feasts";

// GET /api/hall/feasts?from=&to=   (default: today and the next 60 days)
router.get("/feasts", catchAsync(async (req, res) => {
  const now = nowParts();
  const from = req.query.from || now.dateKey;
  const to = req.query.to || addDays(from, 60);
  if (!isDateKey(from) || !isDateKey(to) || to < from) return res.status(400).json({ error: "from / to must be dates like 2026-10-22" });
  const [rows] = await pool.query(`${SELECT} WHERE the_date >= ? AND the_date <= ? ORDER BY the_date, FIELD(slot, 'breakfast', 'lunch', 'dinner')`, [from, to]);
  res.json(rows.map(shape));
}));

// the slot must still be open — once a meal is locked its price can't change under people
async function assertOpen(date, slot) {
  const [[slotRow]] = await pool.query("SELECT * FROM hall_slots WHERE slot = ?", [slot]);
  if (isLocked(slotRow, date)) throw { status: 409, message: `${slotRow.label} on ${date} is already closed — a feast can't be added, changed or removed now` };
}

// POST /api/hall/feasts (admin) body: { date, slot, title, items, extraPrice } — adds, or replaces the feast of that date + meal
router.post("/feasts", requireRole("admin"), catchAsync(async (req, res) => {
  const { date, slot, title, items, extraPrice } = req.body || {};
  if (!isDateKey(date)) return res.status(400).json({ error: "Date must look like 2026-10-24" });
  if (!SLOTS.includes(slot)) return res.status(400).json({ error: "Choose breakfast, lunch or dinner" });
  const t = String(title || "").trim(), it = String(items || "").trim();
  if (!t || t.length > 80) return res.status(400).json({ error: "Give the feast a name (up to 80 characters)" });
  if (!it || it.length > 255) return res.status(400).json({ error: "Write what is served (up to 255 characters)" });
  const extra = Number(extraPrice || 0);
  if (!(extra >= 0 && extra <= 10000)) return res.status(400).json({ error: "Extra price must be between 0 and 10000" });
  try { await assertOpen(date, slot); } catch (e) { return res.status(e.status).json({ error: e.message }); }

  await pool.query(
    `INSERT INTO hall_feasts (the_date, slot, title, items, extra_price) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), items = VALUES(items), extra_price = VALUES(extra_price)`,
    [date, slot, t, it, extra]
  );
  const [[row]] = await pool.query(`${SELECT} WHERE the_date = ? AND slot = ?`, [date, slot]);
  res.status(201).json(shape(row));
}));

// DELETE /api/hall/feasts/:id (admin)
router.delete("/feasts/:id", requireRole("admin"), catchAsync(async (req, res) => {
  const [[row]] = await pool.query(`${SELECT} WHERE id = ?`, [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: "Feast not found" });
  try { await assertOpen(row.d, row.slot); } catch (e) { return res.status(e.status).json({ error: e.message }); }
  await pool.query("DELETE FROM hall_feasts WHERE id = ?", [row.id]);
  res.json({ ok: true });
}));

module.exports = router;
