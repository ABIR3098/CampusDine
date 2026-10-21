// One place that decides what an order costs — used by placing an order (orders.js), the cart preview
// (/api/pricing/quote) and /api/coupon/validate, so the cart can never show a different price than the server charges.
//
// Order of discounts (each step works on what is left from the one before):
//   1. Combo deals      — a complete set of a combo's items costs the combo price instead
//   2. Happy hour       — % / ৳ off the units that were NOT already used up by a combo
//   3. Coupon           — existing coupon rules, applied to the amount after 1 + 2
//   4. Loyalty reward   — points → ৳ off, or one free unit of an item
const { localParts, toMinutes } = require("./utils/clock");
const loyalty = require("./loyalty");

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// ─────────────────────────── Happy hours ───────────────────────────

function parseDays(value) {
  if (!value) return [];
  return String(value).split(",").map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

async function loadHappyHours(db, { onlyActive = false } = {}) {
  const [rows] = await db.query(`SELECT * FROM happy_hours ${onlyActive ? "WHERE is_active = 1" : ""} ORDER BY start_time, id`);
  if (rows.length === 0) return [];
  const [items] = await db.query(
    `SELECT happy_hour_id, item_id FROM happy_hour_items WHERE happy_hour_id IN (${rows.map(() => "?").join(",")})`,
    rows.map((r) => r.id)
  );
  return rows.map((r) => ({
    ...r,
    days: parseDays(r.days),
    itemIds: items.filter((i) => i.happy_hour_id === r.id).map((i) => i.item_id),
  }));
}

// Is this happy hour running at `when` (canteen local time)? Handles windows that run past midnight.
function isHappyHourActive(hh, when = new Date()) {
  if (!hh.is_active) return false;
  const start = toMinutes(hh.start_time);
  const end = toMinutes(hh.end_time);
  if (start === null || end === null || start === end) return false;
  const { dow, minutes } = localParts(when);
  const dayOk = (d) => hh.days.length === 0 || hh.days.includes(d);
  if (start < end) return dayOk(dow) && minutes >= start && minutes < end;
  return (dayOk(dow) && minutes >= start) || (dayOk((dow + 6) % 7) && minutes < end);
}

function happyHourCovers(hh, line) {
  if (hh.itemIds.length > 0) return hh.itemIds.includes(line.id);
  if (hh.category) return hh.category === line.category;
  return true;
}

// ─────────────────────────── Combos ───────────────────────────

async function loadCombos(db, { onlyActive = false } = {}) {
  const [rows] = await db.query(`SELECT * FROM combo_deals ${onlyActive ? "WHERE is_active = 1" : ""} ORDER BY id`);
  if (rows.length === 0) return [];
  const [items] = await db.query(
    `SELECT ci.combo_id, ci.item_id, ci.qty, m.name, m.name_bn, m.price, m.category, m.stock, m.availability, m.image
     FROM combo_deal_items ci JOIN menu_items m ON m.id = ci.item_id
     WHERE ci.combo_id IN (${rows.map(() => "?").join(",")}) ORDER BY ci.id`,
    rows.map((r) => r.id)
  );
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.combo_id === r.id) }));
}

// ─────────────────────────── Step 1 + 2: promotions on the cart ───────────────────────────
// snapshot: [{ id, name, price, qty, category }]  →  lines with per-line discounts + totals
async function priceCart(db, snapshot, when = new Date()) {
  const lines = snapshot.map((l) => ({
    id: l.id, name: l.name, category: l.category, price: Number(l.price), qty: l.qty,
    gross: r2(Number(l.price) * l.qty),
    comboUnits: 0, comboDiscount: 0, hhDiscount: 0, hhId: null, hhName: null,
  }));
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const remaining = new Map(lines.map((l) => [l.id, l.qty]));

  // 1. Combos — biggest saving per set first; a unit can only be claimed by one combo
  const appliedCombos = [];
  const candidates = [];
  for (const combo of await loadCombos(db, { onlyActive: true })) {
    if (combo.items.length === 0 || !combo.items.every((i) => lineById.has(i.item_id))) continue;
    const fullPerSet = combo.items.reduce((s, i) => s + lineById.get(i.item_id).price * i.qty, 0);
    const savingPerSet = r2(fullPerSet - Number(combo.price));
    if (savingPerSet > 0) candidates.push({ combo, fullPerSet, savingPerSet });
  }
  candidates.sort((a, b) => b.savingPerSet - a.savingPerSet || a.combo.id - b.combo.id);

  for (const { combo, fullPerSet, savingPerSet } of candidates) {
    const sets = Math.min(...combo.items.map((i) => Math.floor(remaining.get(i.item_id) / i.qty)));
    if (!(sets > 0)) continue;
    const total = r2(savingPerSet * sets);
    let given = 0;
    combo.items.forEach((i, idx) => {
      const line = lineById.get(i.item_id);
      const share = idx === combo.items.length - 1
        ? r2(total - given) // last item takes the rounding remainder so the parts add up exactly
        : r2(total * ((line.price * i.qty) / fullPerSet));
      given = r2(given + share);
      line.comboDiscount = r2(line.comboDiscount + share);
      line.comboUnits += i.qty * sets;
      remaining.set(i.item_id, remaining.get(i.item_id) - i.qty * sets);
    });
    appliedCombos.push({ id: combo.id, name: combo.name, name_bn: combo.name_bn, sets, price: Number(combo.price), discount: total });
  }

  // 2. Happy hour — best single offer per line, only on units not already in a combo
  const active = (await loadHappyHours(db, { onlyActive: true })).filter((hh) => isHappyHourActive(hh, when));
  const happyTotals = new Map();
  for (const line of lines) {
    const units = line.qty - line.comboUnits;
    if (units <= 0) continue;
    let best = null;
    for (const hh of active) {
      if (!happyHourCovers(hh, line)) continue;
      const off = hh.discount_type === "PERCENTAGE"
        ? Math.round(line.price * units * (Number(hh.discount_value) / 100))
        : Math.min(line.price, Number(hh.discount_value)) * units;
      const capped = Math.min(r2(off), r2(line.price * units));
      if (!best || capped > best.off) best = { hh, off: capped };
    }
    if (best && best.off > 0) {
      line.hhDiscount = best.off;
      line.hhId = best.hh.id;
      line.hhName = best.hh.name;
      const t = happyTotals.get(best.hh.id) || { id: best.hh.id, name: best.hh.name, name_bn: best.hh.name_bn, discount: 0 };
      t.discount = r2(t.discount + best.off);
      happyTotals.set(best.hh.id, t);
    }
  }

  for (const line of lines) line.net = r2(line.gross - line.comboDiscount - line.hhDiscount);
  const subtotal = r2(lines.reduce((s, l) => s + l.gross, 0));
  const comboDiscount = r2(lines.reduce((s, l) => s + l.comboDiscount, 0));
  const happyHourDiscount = r2(lines.reduce((s, l) => s + l.hhDiscount, 0));
  const appliedHappyHours = [...happyTotals.values()];
  const promoLabel = [
    ...appliedCombos.map((c) => `Combo: ${c.name}${c.sets > 1 ? ` ×${c.sets}` : ""}`),
    ...appliedHappyHours.map((h) => `Happy Hour: ${h.name}`),
  ].join(" · ").slice(0, 255) || null;

  return {
    lines, subtotal, comboDiscount, happyHourDiscount,
    promoDiscount: r2(comboDiscount + happyHourDiscount),
    promoTotal: r2(subtotal - comboDiscount - happyHourDiscount),
    appliedCombos, appliedHappyHours, promoLabel,
  };
}

// ─────────────────────────── Step 3: coupon (same rules as before) ───────────────────────────
async function applyCoupon(db, { userId, couponId, couponCode, lines, promoTotal, lock }) {
  const code = String(couponCode || "").trim().toUpperCase();
  const [couponRows] = await db.query(
    `SELECT id, code, discount_type, discount_value, min_order_amount, max_discount,
            usage_limit, used_count, expiry_date, is_active, applies_to_all_items
     FROM coupons WHERE ${couponId ? "id = ?" : "code = ?"}${lock ? " FOR UPDATE" : ""}`,
    couponId ? [couponId] : [code]
  );
  if (couponRows.length === 0) throw { status: 404, message: "Coupon not found" };
  const coupon = couponRows[0];
  if (code && coupon.code !== code) throw { status: 400, message: "Coupon code does not match" };
  if (!coupon.is_active) throw { status: 400, message: "This coupon is no longer active" };
  if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) throw { status: 400, message: "This coupon has expired" };
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) throw { status: 400, message: "This coupon usage limit has been reached" };
  // The minimum is checked against what the customer would pay after combos / happy hour
  if (promoTotal < Number(coupon.min_order_amount || 0)) {
    throw { status: 400, message: `Minimum order amount required: ৳${coupon.min_order_amount || 0}` };
  }
  const [userUsage] = await db.query("SELECT id FROM coupon_usage WHERE user_id = ? AND coupon_id = ?", [userId, coupon.id]);
  if (userUsage.length > 0) throw { status: 400, message: "You have already used this coupon" };

  let eligibleItemIds = [];
  let eligible = promoTotal;
  if (!coupon.applies_to_all_items) {
    const [rows] = await db.query("SELECT item_id FROM coupon_items WHERE coupon_id = ?", [coupon.id]);
    eligibleItemIds = rows.map((r) => Number(r.item_id));
    const set = new Set(eligibleItemIds);
    eligible = r2(lines.reduce((s, l) => (set.has(Number(l.id)) ? s + l.net : s), 0));
    if (eligible <= 0) throw { status: 400, message: "This coupon is valid only for selected menu items" };
  }

  let discount = coupon.discount_type === "PERCENTAGE"
    ? Math.round(eligible * (Number(coupon.discount_value) / 100))
    : Math.min(Number(coupon.discount_value), eligible);
  if (coupon.max_discount && discount > Number(coupon.max_discount)) discount = Number(coupon.max_discount);
  discount = Math.min(discount, eligible);
  return { coupon, discount: r2(discount), eligibleItemIds };
}

// ─────────────────────────── Step 4: loyalty reward ───────────────────────────
async function applyReward(db, { userId, rewardId, lines, remaining, lock }) {
  const [[reward]] = await db.query("SELECT * FROM loyalty_rewards WHERE id = ?", [rewardId]);
  if (!reward || !reward.is_active) throw { status: 404, message: "That reward is not available" };
  const account = await loyalty.getAccount(db, userId, { lock });
  if (account.points < reward.points_cost) {
    throw { status: 409, message: `You need ${reward.points_cost - account.points} more points for this reward` };
  }
  if (remaining <= 0) throw { status: 400, message: "Your order is already free — keep the points for next time" };

  let discount;
  if (reward.type === "DISCOUNT") {
    discount = Math.min(Number(reward.discount_value), remaining);
  } else {
    const line = lines.find((l) => Number(l.id) === Number(reward.item_id));
    if (!line) {
      const [[item]] = await db.query("SELECT name FROM menu_items WHERE id = ?", [reward.item_id]);
      throw { status: 400, message: `Add ${item ? item.name : "the reward item"} to your cart to use this reward` };
    }
    discount = Math.min(r2(line.net / line.qty), remaining); // one unit, at the price you are actually paying for it
  }
  return { reward, discount: r2(discount), balance: account.points };
}

// ─────────────────────────── Everything together ───────────────────────────
async function priceOrder(db, { userId, snapshot, couponId, couponCode, rewardId, when = new Date(), lock = false }) {
  const promo = await priceCart(db, snapshot, when);

  let coupon = null;
  let couponDiscount = 0;
  let couponEligibleItemIds = [];
  if (couponId || couponCode) {
    const result = await applyCoupon(db, { userId, couponId, couponCode, lines: promo.lines, promoTotal: promo.promoTotal, lock });
    coupon = result.coupon;
    couponDiscount = result.discount;
    couponEligibleItemIds = result.eligibleItemIds;
  }

  let reward = null;
  let rewardDiscount = 0;
  const afterCoupon = r2(promo.promoTotal - couponDiscount);
  if (rewardId) {
    const result = await applyReward(db, { userId, rewardId, lines: promo.lines, remaining: afterCoupon, lock });
    reward = result.reward;
    rewardDiscount = result.discount;
  }

  const total = Math.max(0, r2(afterCoupon - rewardDiscount));
  const settings = await loyalty.getSettings(db);
  return {
    ...promo,
    coupon, couponDiscount, couponEligibleItemIds,
    reward, rewardDiscount,
    total,
    totalSavings: r2(promo.subtotal - total),
    pointsEarnable: Math.floor(total / settings.earnPer),
  };
}

// The JSON the cart screen gets (never leaks internal DB rows)
function quoteResponse(p) {
  return {
    subtotal: p.subtotal,
    happyHourDiscount: p.happyHourDiscount,
    comboDiscount: p.comboDiscount,
    promoDiscount: p.promoDiscount,
    couponDiscount: p.couponDiscount,
    rewardDiscount: p.rewardDiscount,
    total: p.total,
    totalSavings: p.totalSavings,
    pointsEarnable: p.pointsEarnable,
    pointsToSpend: p.reward ? Number(p.reward.points_cost) : 0,
    appliedCombos: p.appliedCombos,
    appliedHappyHours: p.appliedHappyHours,
    coupon: p.coupon ? { id: p.coupon.id, code: p.coupon.code, discountType: p.coupon.discount_type, discountValue: p.coupon.discount_value } : null,
    reward: p.reward ? { id: p.reward.id, name: p.reward.name, name_bn: p.reward.name_bn, type: p.reward.type, pointsCost: p.reward.points_cost } : null,
    lines: p.lines.map((l) => ({
      id: l.id, name: l.name, qty: l.qty, price: l.price, gross: l.gross,
      comboDiscount: l.comboDiscount, hhDiscount: l.hhDiscount, net: l.net, hhName: l.hhName,
    })),
  };
}

module.exports = {
  r2, loadHappyHours, loadCombos, isHappyHourActive, happyHourCovers,
  priceCart, priceOrder, quoteResponse,
};
