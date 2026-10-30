const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, isDateKey, addDays, isLocked, localStamp } = require("../util");
const { parseRsvpStatus } = require("../feastRsvp");

const router = express.Router();

const shape = (r) => ({ id: r.id, date: r.d, slot: r.slot, title: r.title, items: r.items, extraPrice: r.extra_price });
const SELECT = "SELECT id, DATE_FORMAT(the_date, '%Y-%m-%d') AS d, slot, title, items, extra_price FROM hall_feasts";

// GET /api/hall/feasts?from=&to=   (default: today and the next 60 days)
router.get("/feasts", catchAsync(async (req, res) => {
  const now = nowParts();
  const from = req.query.from || now.dateKey;
  const to = req.query.to || addDays(from, 60);
  if (!isDateKey(from) || !isDateKey(to) || to < from) return res.status(400).json({ error: "from / to must be dates like 2026-10-22" });
  const [rows] = await pool.query(`${SELECT} WHERE the_date >= ? AND the_date <= ? AND (? IS NULL OR university_id=?) ORDER BY the_date, FIELD(slot, 'breakfast', 'lunch', 'dinner')`, [from, to, req.user.universityId || null, req.user.universityId || null]);
  res.json(rows.map(shape));
}));

// the slot must still be open — once a meal is locked its price can't change under people
async function assertOpen(date, slot, universityId = null) {
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
  try { await assertOpen(date, slot, req.user.universityId); } catch (e) { return res.status(e.status).json({ error: e.message }); }

  const [existing] = await pool.query('SELECT id FROM hall_feasts WHERE the_date=? AND slot=? AND university_id <=> ? LIMIT 1',[date,slot,req.user.universityId||null]);
  if (existing.length) await pool.query('UPDATE hall_feasts SET title=?,items=?,extra_price=? WHERE id=?',[t,it,extra,existing[0].id]);
  else await pool.query('INSERT INTO hall_feasts (the_date,slot,title,items,extra_price,university_id) VALUES (?,?,?,?,?,?)',[date,slot,t,it,extra,req.user.universityId||null]);
  const [[row]] = await pool.query(`${SELECT} WHERE the_date = ? AND slot = ? AND (? IS NULL OR university_id=?)`, [date, slot, req.user.universityId || null, req.user.universityId || null]);
  res.status(201).json(shape(row));
}));

// DELETE /api/hall/feasts/:id (admin)
router.delete("/feasts/:id", requireRole("admin"), catchAsync(async (req, res) => {
  const [[row]] = await pool.query(`${SELECT} WHERE id = ? AND (? IS NULL OR university_id=?)`, [Number(req.params.id), req.user.universityId || null, req.user.universityId || null]);
  if (!row) return res.status(404).json({ error: "Feast not found" });
  try { await assertOpen(row.d, row.slot); } catch (e) { return res.status(e.status).json({ error: e.message }); }
  await pool.query("DELETE FROM hall_feasts WHERE id = ? AND (? IS NULL OR university_id=?)", [row.id, req.user.universityId || null, req.user.universityId || null]);
  res.json({ ok: true });
}));

// RSVP stays open until the meal's own cut-off, the same moment its price gets fixed
async function assertRsvpOpen(feast) {
  const [[slotRow]] = await pool.query("SELECT * FROM hall_slots WHERE slot = ?", [feast.slot]);
  if (isLocked(slotRow, feast.d)) throw { status: 409, message: `RSVP for ${slotRow.label} on ${feast.d} is closed because the meal has already locked` };
}

// one feast of the member's own university (null when it does not exist)
async function getFeast(id, universityId = null) {
  const [[row]] = await pool.query(`${SELECT} WHERE id = ? AND (? IS NULL OR university_id=?)`, [Number(id), universityId, universityId]);
  return row || null;
}

// POST /api/hall/feasts/:id/rsvp   body: { status: "going" | "not_going" }   (any Hall member)
router.post("/feasts/:id/rsvp", catchAsync(async (req, res) => {
  const status = parseRsvpStatus((req.body || {}).status);
  if (!status) return res.status(400).json({ error: "status must be going or not_going" });
  const feast = await getFeast(req.params.id, req.user.universityId || null);
  if (!feast) return res.status(404).json({ error: "Feast not found" });
  try { await assertRsvpOpen(feast); } catch (e) { if (!e.status) throw e; return res.status(e.status).json({ error: e.message }); }
  await pool.query(
    "INSERT INTO hall_feast_rsvps (feast_id, user_id, status, updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = VALUES(updated_at)",
    [feast.id, req.user.id, status, localStamp()]);
  res.json({ feastId: feast.id, status });
}));

module.exports = router;
