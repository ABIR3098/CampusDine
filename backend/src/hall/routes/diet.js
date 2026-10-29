const express = require("express");
const pool = require("../../db");
const catchAsync = require("../../utils/catchAsync");
const { requireRole } = require("../../middleware/auth");
const { SLOTS, nowParts, isDateKey, addDays, isLocked, localStamp } = require("../util");
const { loadStates } = require("../states");
const { TAGS, KEYS, LABEL, VEGETARIAN_AVOID, tagsOf, parseList, matchesFor } = require("../dietTags");

const router = express.Router();
const memberOnly = requireRole("student", "teacher");
const admin = requireRole("admin");
const MEMBER = "(u.role = 'teacher' OR (u.role = 'student' AND u.account_type = 'hall')) AND (? IS NULL OR u.university_id = ?)";
const dowOf = (dateKey) => new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0 = Sunday, same as hall_menu.dow
const catalog = TAGS.map(({ key, label }) => ({ key, label }));

async function myDiet(userId) {
  const [[row]] = await pool.query("SELECT avoid, allergies, note FROM hall_diet WHERE user_id = ?", [userId]);
  return { avoid: parseList(row && row.avoid), allergies: parseList(row && row.allergies), note: (row && row.note) || "" };
}

// GET /api/hall/diet/mine → { avoid: [key], allergies: [key], note, tags: [{ key, label }], vegetarian: [key] }
router.get("/diet/mine", memberOnly, catchAsync(async (req, res) => {
  res.json({ ...(await myDiet(req.user.id)), tags: catalog, vegetarian: VEGETARIAN_AVOID });
}));

// PUT /api/hall/diet/mine   body: { avoid: [key], allergies: [key], note? }   (a tag in both lists counts as an allergy)
router.put("/diet/mine", memberOnly, catchAsync(async (req, res) => {
  const b = req.body || {};
  for (const field of ["avoid", "allergies"]) {
    if (b[field] !== undefined && (!Array.isArray(b[field]) || b[field].some((k) => !KEYS.includes(k)))) {
      return res.status(400).json({ error: `${field} must be a list of: ${KEYS.join(", ")}` });
    }
  }
  const allergies = parseList(b.allergies);
  const avoid = parseList(b.avoid).filter((k) => !allergies.includes(k));
  const note = String(b.note || "").trim().slice(0, 160);
  if (!avoid.length && !allergies.length && !note) {
    await pool.query("DELETE FROM hall_diet WHERE user_id = ?", [req.user.id]);
  } else {
    await pool.query(
      "INSERT INTO hall_diet (user_id, avoid, allergies, note, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE avoid = VALUES(avoid), allergies = VALUES(allergies), note = VALUES(note), updated_at = VALUES(updated_at)",
      [req.user.id, avoid.join(","), allergies.join(","), note || null, localStamp()]);
  }
  res.json({ avoid, allergies, note });
}));

// GET /api/hall/diet/menu → { today: 0-6, menu: [{ dow, slot, label, items, tags: [key] }] }   the whole week's menu with tags
router.get("/diet/menu", memberOnly, catchAsync(async (req, res) => {
  const [rows] = await pool.query("SELECT dow, slot, items FROM hall_menu ORDER BY dow");
  const [slotRows] = await pool.query("SELECT slot, label FROM hall_slots");
  res.json({
    today: nowParts().dow,
    menu: rows.filter((r) => SLOTS.includes(r.slot)).map((r) => ({
      dow: r.dow, slot: r.slot, label: (slotRows.find((s) => s.slot === r.slot) || {}).label || r.slot, items: r.items, tags: tagsOf(r.items),
    })),
  });
}));

// GET /api/hall/diet/warnings?days=3 → { warnings: [{ date, slot, label, items, level, matches: [{ key, label, level }], canChange }] }
// Only meals that are ON for you (a meal you turned OFF can't hurt you). canChange = the meal has not closed yet.
router.get("/diet/warnings", memberOnly, catchAsync(async (req, res) => {
  const days = Math.min(7, Math.max(1, parseInt(req.query.days, 10) || 3));
  const now = nowParts();
  const diet = await myDiet(req.user.id);
  if (!diet.avoid.length && !diet.allergies.length) return res.json({ warnings: [] });
  const [menuRows] = await pool.query("SELECT dow, slot, items FROM hall_menu");
  const [slotRows] = await pool.query("SELECT * FROM hall_slots");
  const states = await loadStates(pool, req.user.id, now.dateKey, addDays(now.dateKey, days - 1));
  const warnings = [];
  for (const day of states) {
    for (const slot of SLOTS) {
      const slotRow = slotRows.find((s) => s.slot === slot);
      const menu = menuRows.find((m) => m.dow === dowOf(day.date) && m.slot === slot);
      if (!slotRow || !menu || day.slots[slot].status !== "on") continue;
      const matches = matchesFor(tagsOf(menu.items), diet);
      if (!matches.length) continue;
      warnings.push({
        date: day.date, slot, label: slotRow.label, items: menu.items, matches,
        level: matches.some((m) => m.level === "allergy") ? "allergy" : "avoid",
        canChange: !isLocked(slotRow, day.date, now),
      });
    }
  }
  res.json({ warnings });
}));

// GET /api/hall/diet/summary?date=YYYY-MM-DD   (admin; default tomorrow)
// → { date, today, slots: [{ slot, label, items, tags: [{ key, label }], allergy: [{ name, externalId, matches: [label], note }], avoidCount }],
//     people: n, byTag: [{ key, label, avoid, allergy }] }
router.get("/diet/summary", admin, catchAsync(async (req, res) => {
  const now = nowParts();
  const date = req.query.date || addDays(now.dateKey, 1);
  if (!isDateKey(date)) return res.status(400).json({ error: "date must look like 2026-10-22" });
  const uni = req.user.universityId || null;
  const [rows] = await pool.query(
    `SELECT d.user_id AS id, d.avoid, d.allergies, d.note, u.name, u.external_id AS externalId FROM hall_diet d JOIN users u ON u.id = d.user_id
     WHERE ${MEMBER} ORDER BY u.name`, [uni, uni]);
  const people = rows.map((r) => ({ id: r.id, name: r.name, externalId: r.externalId, note: r.note || "", avoid: parseList(r.avoid), allergies: parseList(r.allergies) }));
  const [menuRows] = await pool.query("SELECT slot, items FROM hall_menu WHERE dow = ?", [dowOf(date)]);
  const [slotRows] = await pool.query("SELECT slot, label FROM hall_slots");
  const statusOf = new Map();
  for (const p of people) statusOf.set(p.id, (await loadStates(pool, p.id, date, date))[0].slots);

  const slots = SLOTS.map((slot) => {
    const items = (menuRows.find((m) => m.slot === slot) || {}).items || "";
    const tags = tagsOf(items);
    const on = people.filter((p) => statusOf.get(p.id)[slot].status === "on");
    const allergy = [], avoid = [];
    for (const p of on) {
      const hit = matchesFor(tags, p);
      if (hit.some((h) => h.level === "allergy")) allergy.push({ name: p.name, externalId: p.externalId, matches: hit.filter((h) => h.level === "allergy").map((h) => h.label), note: p.note });
      else if (hit.length) avoid.push(p);
    }
    return {
      slot, label: (slotRows.find((s) => s.slot === slot) || {}).label || slot, items, tags: tags.map((k) => ({ key: k, label: LABEL[k] })),
      allergy, avoidCount: avoid.length,
    };
  });
  res.json({
    date, today: now.dateKey, slots, people: people.length,
    byTag: TAGS.map((t) => ({ key: t.key, label: t.label, avoid: people.filter((p) => p.avoid.includes(t.key)).length, allergy: people.filter((p) => p.allergies.includes(t.key)).length })),
  });
}));

module.exports = router;
