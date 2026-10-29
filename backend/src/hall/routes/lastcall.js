const express = require("express");
const crypto = require("crypto");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, localStamp } = require("../util");

const router = express.Router();
const admin = requireRole("admin");
const memberOnly = requireRole("student", "teacher");
const MAX_PER_PERSON = 2;   // plates one person can take from one last call
const MAX_PLATES = 500;
const MEMBER = "(u.role = 'teacher' OR (u.role = 'student' AND u.account_type = 'hall')) AND (? IS NULL OR u.university_id = ?)";
const taka = (n) => "৳" + Math.round(Number(n) * 100) / 100;
const money = (n) => Math.round(Number(n || 0) * 100) / 100;
const sameUni = (a, b) => (a == null ? null : Number(a)) === (b == null ? null : Number(b));

// a short code that is easy to read out at the counter (no 0/O/1/I)
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function newCode() {
  let s = "LC-";
  for (let i = 0; i < 6; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

// tells every hall member about a new last call (saved as notifications + pushed live; no emails, so a big hall isn't flooded)
async function broadcast(universityId, title, body, kind) {
  const uni = universityId || null;
  const [ids] = await pool.query(`SELECT u.id FROM users u WHERE ${MEMBER}`, [uni, uni]);
  if (!ids.length) return 0;
  await pool.query(`INSERT INTO hall_notifications (user_id, title, body, kind) SELECT u.id, ?, ?, ? FROM users u WHERE ${MEMBER}`, [title, body, kind, uni, uni]);
  const io = global.__campusdineHallIO;
  if (io) for (const x of ids) io.to(`user:${x.id}`).emit("hall:notification", { title, body, kind, createdAt: new Date().toISOString() });
  return ids.length;
}

// ---------------------------------------------------------------- members

// GET /api/hall/lastcall → { today, maxPerPerson, items: [{ id, date, slot, label, plates, remaining, price, normalPrice, note, open, mine: [{ id, code, status, price, at }] }] }
// Today's last calls, newest first. `open` is false once the admin closed it (your plates stay visible).
router.get("/lastcall", memberOnly, catchAsync(async (req, res) => {
  const now = nowParts();
  const uni = req.user.universityId || null;
  const [rows] = await pool.query(
    `SELECT l.id, DATE_FORMAT(l.the_date, '%Y-%m-%d') AS date, l.slot, l.plates, l.price, l.note, l.status,
            (SELECT COUNT(*) FROM hall_lastcall_claims c WHERE c.lastcall_id = l.id AND c.status <> 'cancelled') AS taken
     FROM hall_lastcalls l WHERE l.the_date = ? AND (? IS NULL OR l.university_id = ?) ORDER BY l.id DESC`, [now.dateKey, uni, uni]);
  const [slotRows] = await pool.query("SELECT slot, label, price FROM hall_slots");
  const ids = rows.map((r) => r.id);
  const [mine] = ids.length
    ? await pool.query("SELECT id, lastcall_id, code, price, status, DATE_FORMAT(created_at, '%H:%i') AS at FROM hall_lastcall_claims WHERE user_id = ? AND lastcall_id IN (?) ORDER BY id", [req.user.id, ids])
    : [[]];
  res.json({
    today: now.dateKey, maxPerPerson: MAX_PER_PERSON,
    items: rows.map((r) => {
      const slot = slotRows.find((s) => s.slot === r.slot) || {};
      return {
        id: r.id, date: r.date, slot: r.slot, label: slot.label || r.slot, plates: r.plates, remaining: Math.max(0, r.plates - Number(r.taken)),
        price: money(r.price), normalPrice: money(slot.price), note: r.note || "", open: r.status === "open",
        mine: mine.filter((m) => m.lastcall_id === r.id).map((m) => ({ id: m.id, code: m.code, status: m.status, price: money(m.price), at: m.at })),
      };
    }),
  });
}));

// POST /api/hall/lastcall/:id/claim → { code, price, balance }   takes the price from the wallet, all or nothing
router.post("/lastcall/:id/claim", memberOnly, catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid last call" });
  const now = nowParts();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[lc]] = await conn.query("SELECT *, DATE_FORMAT(the_date, '%Y-%m-%d') AS d FROM hall_lastcalls WHERE id = ? FOR UPDATE", [id]);
    if (!lc || !sameUni(lc.university_id, req.user.universityId)) { await conn.rollback(); return res.status(404).json({ error: "Last call not found" }); }
    if (lc.status !== "open" || lc.d !== now.dateKey) { await conn.rollback(); return res.status(409).json({ error: "This last call has ended" }); }
    const [[cnt]] = await conn.query("SELECT COUNT(*) AS n, COALESCE(SUM(user_id = ?), 0) AS mine FROM hall_lastcall_claims WHERE lastcall_id = ? AND status <> 'cancelled'", [req.user.id, id]);
    if (Number(cnt.n) >= lc.plates) { await conn.rollback(); return res.status(409).json({ error: "All plates are taken" }); }
    if (Number(cnt.mine) >= MAX_PER_PERSON) { await conn.rollback(); return res.status(409).json({ error: `You can take at most ${MAX_PER_PERSON} plates from one last call` }); }
    const [[user]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [req.user.id]);
    const price = Number(lc.price);
    const balance = Number(user.wallet_balance);
    if (balance < price) { await conn.rollback(); return res.status(400).json({ error: `Your wallet has ${taka(balance)}. Add at least ${taka(price - balance)} to take this plate.` }); }

    let code = newCode();
    for (let i = 0; i < 5; i++) {
      const [[dup]] = await conn.query("SELECT COUNT(*) AS n FROM hall_lastcall_claims WHERE code = ?", [code]);
      if (!Number(dup.n)) break;
      code = newCode();
    }
    const [[slot]] = await conn.query("SELECT label FROM hall_slots WHERE slot = ?", [lc.slot]);
    await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [price, req.user.id]);
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [req.user.id, `Last-call plate (${slot ? slot.label : lc.slot} ${lc.d})`, -price]);
    await conn.query("INSERT INTO hall_lastcall_claims (lastcall_id, user_id, code, price, status, created_at) VALUES (?, ?, ?, ?, 'claimed', ?)", [id, req.user.id, code, price, localStamp()]);
    await conn.commit();
    res.status(201).json({ code, price: money(price), balance: money(balance - price) });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// ---------------------------------------------------------------- admin

// GET /api/hall/lastcall/manage → { today, items: [{ id, date, slot, label, plates, price, note, status, taken, served, claims: [{ id, code, name, externalId, status, price, at }] }] }
// today's and the last 7 days' last calls, newest first
router.get("/lastcall/manage", admin, catchAsync(async (req, res) => {
  const uni = req.user.universityId || null;
  const now = nowParts();
  const [rows] = await pool.query(
    `SELECT l.id, DATE_FORMAT(l.the_date, '%Y-%m-%d') AS date, l.slot, l.plates, l.price, l.note, l.status FROM hall_lastcalls l
     WHERE l.the_date >= DATE_SUB(?, INTERVAL 7 DAY) AND (? IS NULL OR l.university_id = ?) ORDER BY l.the_date DESC, l.id DESC`, [now.dateKey, uni, uni]);
  const [slotRows] = await pool.query("SELECT slot, label FROM hall_slots");
  const ids = rows.map((r) => r.id);
  const [claims] = ids.length
    ? await pool.query(
      `SELECT c.id, c.lastcall_id, c.code, c.status, c.price, DATE_FORMAT(c.created_at, '%H:%i') AS at, u.name, u.external_id AS externalId
       FROM hall_lastcall_claims c JOIN users u ON u.id = c.user_id WHERE c.lastcall_id IN (?) ORDER BY c.id`, [ids])
    : [[]];
  res.json({
    today: now.dateKey,
    items: rows.map((r) => {
      const mine = claims.filter((c) => c.lastcall_id === r.id);
      return {
        id: r.id, date: r.date, slot: r.slot, label: (slotRows.find((s) => s.slot === r.slot) || {}).label || r.slot, plates: r.plates, price: money(r.price), note: r.note || "", status: r.status,
        taken: mine.filter((c) => c.status !== "cancelled").length, served: mine.filter((c) => c.status === "served").length,
        claims: mine.map((c) => ({ id: c.id, code: c.code, name: c.name, externalId: c.externalId, status: c.status, price: money(c.price), at: c.at })),
      };
    }),
  });
}));

// POST /api/hall/lastcall   body: { slot, plates, price, note?, notify? (default true) }   → puts up today's leftover plates
router.post("/lastcall", admin, catchAsync(async (req, res) => {
  const b = req.body || {};
  const plates = Number(b.plates), price = Number(b.price);
  const note = String(b.note || "").trim().slice(0, 160);
  const uni = req.user.universityId || null;
  const now = nowParts();
  if (!SLOTS.includes(b.slot)) return res.status(400).json({ error: "Pick a meal" });
  if (!Number.isInteger(plates) || plates < 1 || plates > MAX_PLATES) return res.status(400).json({ error: `Plates must be a whole number from 1 to ${MAX_PLATES}` });
  if (!Number.isFinite(price) || price < 0 || price > 10000) return res.status(400).json({ error: "Price must be 0 or more" });
  const [[open]] = await pool.query("SELECT COUNT(*) AS n FROM hall_lastcalls WHERE the_date = ? AND slot = ? AND status = 'open' AND university_id <=> ?", [now.dateKey, b.slot, uni]);
  if (Number(open.n)) return res.status(409).json({ error: "There is already an open last call for this meal. Close it first." });
  const [[slot]] = await pool.query("SELECT label, price FROM hall_slots WHERE slot = ?", [b.slot]);
  const [r] = await pool.query(
    "INSERT INTO hall_lastcalls (the_date, slot, plates, price, note, status, created_by, university_id, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)",
    [now.dateKey, b.slot, plates, money(price), note || null, req.user.id, uni, localStamp()]);
  let notified = 0;
  if (b.notify !== false) {
    notified = await broadcast(uni, "🍱 Last call",
      `${plates} leftover ${slot.label} plate${plates === 1 ? "" : "s"} at ${taka(price)} (normally ${taka(slot.price)}). First come, first served — open Hall → Last call.`, "lastcall");
  }
  res.status(201).json({ id: r.insertId, notified });
}));

// PATCH /api/hall/lastcall/:id/close   → no more claims (plates already claimed stay valid)
router.patch("/lastcall/:id/close", admin, catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid last call" });
  const uni = req.user.universityId || null;
  const [r] = await pool.query("UPDATE hall_lastcalls SET status = 'closed' WHERE id = ? AND status = 'open' AND (? IS NULL OR university_id = ?)", [id, uni, uni]);
  if (!r.affectedRows) return res.status(404).json({ error: "No open last call with that id" });
  res.json({ closed: id });
}));

// POST /api/hall/lastcall/serve   body: { code }   → the student shows the code at the counter
router.post("/lastcall/serve", admin, catchAsync(async (req, res) => {
  const code = String((req.body || {}).code || "").trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "Enter the code" });
  const uni = req.user.universityId || null;
  const [[c]] = await pool.query(
    `SELECT c.id, c.status, c.price, u.name, u.external_id AS externalId, l.slot FROM hall_lastcall_claims c
     JOIN hall_lastcalls l ON l.id = c.lastcall_id JOIN users u ON u.id = c.user_id WHERE c.code = ? AND (? IS NULL OR l.university_id = ?)`, [code, uni, uni]);
  if (!c) return res.status(404).json({ error: "No plate with that code" });
  if (c.status === "served") return res.status(409).json({ error: `Already served to ${c.name}` });
  if (c.status === "cancelled") return res.status(409).json({ error: "That plate was cancelled and refunded" });
  await pool.query("UPDATE hall_lastcall_claims SET status = 'served', served_at = ? WHERE id = ? AND status = 'claimed'", [localStamp(), c.id]);
  res.json({ id: c.id, name: c.name, externalId: c.externalId, slot: c.slot, price: money(c.price) });
}));

// POST /api/hall/lastcall/claims/:id/cancel   → cancels a plate that was not collected and gives the money back to the wallet
router.post("/lastcall/claims/:id/cancel", admin, catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
  const uni = req.user.universityId || null;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[c]] = await conn.query(
      `SELECT c.id, c.user_id, c.status, c.price, l.university_id FROM hall_lastcall_claims c JOIN hall_lastcalls l ON l.id = c.lastcall_id WHERE c.id = ? FOR UPDATE`, [id]);
    if (!c || !sameUni(c.university_id, uni) && uni != null) { await conn.rollback(); return res.status(404).json({ error: "Plate not found" }); }
    if (c.status !== "claimed") { await conn.rollback(); return res.status(409).json({ error: c.status === "served" ? "Already served, can't cancel" : "Already cancelled" }); }
    await conn.query("UPDATE hall_lastcall_claims SET status = 'cancelled' WHERE id = ?", [id]);
    await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [c.price, c.user_id]);
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [c.user_id, "Last-call plate refund", Number(c.price)]);
    await conn.commit();
    res.json({ cancelled: id, refunded: money(c.price) });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

module.exports = router;
