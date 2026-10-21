// Loyalty points + streak, combo deals, happy hours — customer and admin endpoints.
//   POST /api/pricing/quote          cart preview (combos → happy hour → coupon → reward), same maths as placing the order
//   GET  /api/loyalty/me             points, streak, rewards, ledger
//   GET  /api/offers                 what's running (combos, happy hours, rewards)
//   /api/offers/admin/...            admin CRUD;  GET/PUT /api/loyalty/settings
const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const { toMinutes } = require("../utils/clock");
const { resolvePickupTime } = require("../utils/pickup");
const pricing = require("../pricing");
const loyalty = require("../loyalty");

const fail = (status, message) => { throw { status, message }; };
const str = (v, max) => String(v ?? "").trim().slice(0, max);

// ───────────────────────── cart quote ─────────────────────────
const pricingRouter = express.Router();

pricingRouter.post("/quote", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const { items, couponCode } = req.body || {};
  const rewardId = Number(req.body.rewardId) > 0 ? Number(req.body.rewardId) : null;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array is required" });
  const wanted = items.map((i) => ({ id: Number(i && i.id), qty: Number(i && i.qty) }));
  if (wanted.some((i) => !Number.isInteger(i.id) || i.id <= 0 || !Number.isInteger(i.qty) || i.qty <= 0)) {
    return res.status(400).json({ error: "Each item must have a valid ID and positive quantity" });
  }
  let pickupTime = null;
  try { pickupTime = resolvePickupTime(req.body.pickupTime); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

  const ids = [...new Set(wanted.map((i) => i.id))];
  const [rows] = await pool.query(`SELECT id, name, price, category FROM menu_items WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
  const merged = new Map();
  for (const w of wanted) merged.set(w.id, (merged.get(w.id) || 0) + w.qty);
  const snapshot = [];
  for (const [id, qty] of merged) {
    const m = rows.find((r) => r.id === id);
    if (!m) return res.status(404).json({ error: `Menu item ${id} not found` });
    snapshot.push({ id: m.id, name: m.name, price: m.price, qty, category: m.category });
  }

  // A bad coupon or reward must not hide the rest of the quote: price without it and say why it was dropped.
  const base = { userId: req.user.id, snapshot, when: pickupTime || new Date() };
  const price = (c, r) => pricing.priceOrder(pool, { ...base, couponCode: c, rewardId: r });
  let coupon = couponCode || null, reward = rewardId;
  let couponError = null, rewardError = null, priced;
  try {
    priced = await price(coupon, reward);
  } catch (e) {
    if (!e.status) throw e;
    if (coupon) { try { await price(coupon, null); } catch (ce) { if (!ce.status) throw ce; couponError = ce.message; coupon = null; } }
    if (reward) { try { await price(coupon, reward); } catch (re) { if (!re.status) throw re; rewardError = re.message; reward = null; } }
    priced = await price(coupon, reward);
  }
  const out = pricing.quoteResponse(priced);
  out.couponError = couponError;
  out.rewardError = rewardError;
  res.json(out);
}));

// ───────────────────────── loyalty ─────────────────────────
const loyaltyRouter = express.Router();

loyaltyRouter.get("/me", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  res.json(await loyalty.summaryFor(pool, req.user.id));
}));

loyaltyRouter.get("/settings", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  res.json(await loyalty.getSettings(pool));
}));

loyaltyRouter.put("/settings", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const next = {};
  const rules = { earnPer: [1, "Taka per point"], streakDays: [2, "Streak length"], streakBonus: [0, "Streak bonus"] };
  for (const [key, [min, label]] of Object.entries(rules)) {
    if (req.body[key] === undefined) continue;
    const v = Number(req.body[key]);
    if (!Number.isInteger(v) || v < min || v > 100000) return res.status(400).json({ error: `${label} must be a whole number ≥ ${min}` });
    next[key] = v;
  }
  await loyalty.saveSettings(pool, next);
  res.json(await loyalty.getSettings(pool));
}));

// ───────────────────────── offers ─────────────────────────
const offersRouter = express.Router();

async function allRewards() {
  const [rows] = await pool.query(
    `SELECT r.*, m.name AS item_name FROM loyalty_rewards r LEFT JOIN menu_items m ON m.id = r.item_id ORDER BY r.points_cost, r.id`
  );
  return rows;
}

function describeCombo(c) {
  const full = c.items.reduce((s, i) => s + Number(i.price) * i.qty, 0);
  return { ...c, fullPrice: pricing.r2(full), saving: pricing.r2(full - Number(c.price)) };
}

// What a customer sees: active combos, happy hours (with "running now"), rewards
offersRouter.get("/", verifyToken, catchAsync(async (req, res) => {
  const combos = (await pricing.loadCombos(pool, { onlyActive: true })).map(describeCombo);
  const hhs = (await pricing.loadHappyHours(pool, { onlyActive: true })).map((h) => ({ ...h, activeNow: pricing.isHappyHourActive(h) }));
  const rewards = (await allRewards()).filter((r) => r.is_active);
  res.json({ combos, happyHours: hhs, rewards });
}));

const admin = [verifyToken, requireRole("admin")];

offersRouter.get("/admin", ...admin, catchAsync(async (req, res) => {
  const combos = (await pricing.loadCombos(pool)).map(describeCombo);
  const hhs = (await pricing.loadHappyHours(pool)).map((h) => ({ ...h, activeNow: pricing.isHappyHourActive(h) }));
  res.json({ combos, happyHours: hhs, rewards: await allRewards(), settings: await loyalty.getSettings(pool) });
}));

async function transact(res, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    res.json(out);
  } catch (err) {
    await conn.rollback();
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Request failed" });
  } finally { conn.release(); }
}

async function existingItemIds(conn, ids) {
  if (ids.length === 0) return [];
  const [rows] = await conn.query(`SELECT id FROM menu_items WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
  return rows.map((r) => r.id);
}

// ── combos ──
function parseCombo(b) {
  const name = str(b.name, 100);
  const price = Number(b.price);
  if (!name) fail(400, "Combo name is required");
  if (!(price > 0)) fail(400, "Combo price must be more than 0");
  const merged = new Map();
  for (const i of Array.isArray(b.items) ? b.items : []) {
    const id = Number(i.itemId ?? i.id), qty = Number(i.qty ?? 1);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(qty) || qty <= 0 || qty > 20) fail(400, "Each combo item needs a valid item and quantity");
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  if (merged.size < 2) fail(400, "A combo needs at least two different items");
  return { name, name_bn: str(b.name_bn, 100) || null, description: str(b.description, 255) || null, price, active: b.isActive === false ? 0 : 1, items: [...merged] };
}

async function saveComboItems(conn, comboId, items) {
  const found = new Set(await existingItemIds(conn, items.map(([id]) => id)));
  for (const [id] of items) if (!found.has(id)) fail(404, `Menu item ${id} not found`);
  await conn.query("DELETE FROM combo_deal_items WHERE combo_id = ?", [comboId]);
  for (const [id, qty] of items) await conn.query("INSERT INTO combo_deal_items (combo_id, item_id, qty) VALUES (?, ?, ?)", [comboId, id, qty]);
}

offersRouter.post("/admin/combos", ...admin, (req, res) => transact(res, async (conn) => {
  const c = parseCombo(req.body || {});
  const [r] = await conn.query("INSERT INTO combo_deals (name, name_bn, description, price, is_active) VALUES (?, ?, ?, ?, ?)", [c.name, c.name_bn, c.description, c.price, c.active]);
  await saveComboItems(conn, r.insertId, c.items);
  return { id: r.insertId };
}));

offersRouter.put("/admin/combos/:id", ...admin, (req, res) => transact(res, async (conn) => {
  const c = parseCombo(req.body || {});
  const [r] = await conn.query("UPDATE combo_deals SET name = ?, name_bn = ?, description = ?, price = ?, is_active = ? WHERE id = ?", [c.name, c.name_bn, c.description, c.price, c.active, req.params.id]);
  if (r.affectedRows === 0) fail(404, "Combo not found");
  await saveComboItems(conn, Number(req.params.id), c.items);
  return { id: Number(req.params.id) };
}));

// ── happy hours ──
function parseHappyHour(b) {
  const name = str(b.name, 100);
  if (!name) fail(400, "Happy hour name is required");
  const start = toMinutes(b.startTime), end = toMinutes(b.endTime);
  if (start === null || end === null) fail(400, "Start and end time must be HH:MM");
  if (start === end) fail(400, "Start and end time can't be the same");
  const discountType = b.discountType === "FIXED" ? "FIXED" : "PERCENTAGE";
  const value = Number(b.discountValue);
  if (!(value > 0)) fail(400, "Discount must be more than 0");
  if (discountType === "PERCENTAGE" && value > 100) fail(400, "Percentage can't be more than 100");
  const days = [...new Set((Array.isArray(b.days) ? b.days : []).map(Number))];
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) fail(400, "Days must be 0 (Sunday) to 6 (Saturday)");
  const itemIds = [...new Set((Array.isArray(b.itemIds) ? b.itemIds : []).map(Number))];
  if (itemIds.some((i) => !Number.isInteger(i) || i <= 0)) fail(400, "Invalid item in list");
  const category = ["heavy", "snacks", "drinks"].includes(b.category) ? b.category : null;
  const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
  return {
    name, name_bn: str(b.name_bn, 100) || null, start: hm(start), end: hm(end), days: days.sort().join(",") || null,
    category, discountType, value, active: b.isActive === false ? 0 : 1, itemIds,
  };
}

async function saveHhItems(conn, id, itemIds) {
  const found = new Set(await existingItemIds(conn, itemIds));
  for (const i of itemIds) if (!found.has(i)) fail(404, `Menu item ${i} not found`);
  await conn.query("DELETE FROM happy_hour_items WHERE happy_hour_id = ?", [id]);
  for (const i of itemIds) await conn.query("INSERT INTO happy_hour_items (happy_hour_id, item_id) VALUES (?, ?)", [id, i]);
}

offersRouter.post("/admin/happy-hours", ...admin, (req, res) => transact(res, async (conn) => {
  const h = parseHappyHour(req.body || {});
  const [r] = await conn.query(
    "INSERT INTO happy_hours (name, name_bn, start_time, end_time, days, category, discount_type, discount_value, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [h.name, h.name_bn, h.start, h.end, h.days, h.category, h.discountType, h.value, h.active]);
  await saveHhItems(conn, r.insertId, h.itemIds);
  return { id: r.insertId };
}));

offersRouter.put("/admin/happy-hours/:id", ...admin, (req, res) => transact(res, async (conn) => {
  const h = parseHappyHour(req.body || {});
  const [r] = await conn.query(
    "UPDATE happy_hours SET name = ?, name_bn = ?, start_time = ?, end_time = ?, days = ?, category = ?, discount_type = ?, discount_value = ?, is_active = ? WHERE id = ?",
    [h.name, h.name_bn, h.start, h.end, h.days, h.category, h.discountType, h.value, h.active, req.params.id]);
  if (r.affectedRows === 0) fail(404, "Happy hour not found");
  await saveHhItems(conn, Number(req.params.id), h.itemIds);
  return { id: Number(req.params.id) };
}));

// ── rewards ──
function parseReward(b) {
  const name = str(b.name, 100);
  const cost = Number(b.pointsCost);
  if (!name) fail(400, "Reward name is required");
  if (!Number.isInteger(cost) || cost <= 0) fail(400, "Points cost must be a whole number above 0");
  const type = b.type === "FREE_ITEM" ? "FREE_ITEM" : "DISCOUNT";
  let discount = null, itemId = null;
  if (type === "DISCOUNT") {
    discount = Number(b.discountValue);
    if (!(discount > 0)) fail(400, "Discount amount must be more than 0");
  } else {
    itemId = Number(b.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) fail(400, "Choose the free item");
  }
  return { name, name_bn: str(b.name_bn, 100) || null, type, cost, discount, itemId, active: b.isActive === false ? 0 : 1 };
}

offersRouter.post("/admin/rewards", ...admin, (req, res) => transact(res, async (conn) => {
  const r = parseReward(req.body || {});
  if (r.itemId && (await existingItemIds(conn, [r.itemId])).length === 0) fail(404, "Menu item not found");
  const [out] = await conn.query(
    "INSERT INTO loyalty_rewards (name, name_bn, type, points_cost, discount_value, item_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [r.name, r.name_bn, r.type, r.cost, r.discount, r.itemId, r.active]);
  return { id: out.insertId };
}));

offersRouter.put("/admin/rewards/:id", ...admin, (req, res) => transact(res, async (conn) => {
  const r = parseReward(req.body || {});
  if (r.itemId && (await existingItemIds(conn, [r.itemId])).length === 0) fail(404, "Menu item not found");
  const [out] = await conn.query(
    "UPDATE loyalty_rewards SET name = ?, name_bn = ?, type = ?, points_cost = ?, discount_value = ?, item_id = ?, is_active = ? WHERE id = ?",
    [r.name, r.name_bn, r.type, r.cost, r.discount, r.itemId, r.active, req.params.id]);
  if (out.affectedRows === 0) fail(404, "Reward not found");
  return { id: Number(req.params.id) };
}));

// ── delete (combo | happy-hours | rewards) ──
const TABLES = { combos: "combo_deals", "happy-hours": "happy_hours", rewards: "loyalty_rewards" };
offersRouter.delete("/admin/:kind/:id", ...admin, catchAsync(async (req, res) => {
  const table = TABLES[req.params.kind];
  if (!table) return res.status(404).json({ error: "Unknown offer type" });
  const [r] = await pool.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
  if (r.affectedRows === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
}));

module.exports = { pricingRouter, loyaltyRouter, offersRouter };
