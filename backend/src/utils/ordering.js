// Shared by normal orders, group orders and treats: stock locking, last-hour deal pricing, slot reservation.
const { nowMinutes, todayStr, toMin } = require("./dates");
const { slotList, loadCounts, isPast } = require("./slots");
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const LOW_STOCK = 10;

// Last-hour surplus deal: only for TODAY's meals, in the final N minutes before closing.
function surplusActive(S, mealDate) {
  if (!S.surplus_enabled || mealDate !== todayStr()) return false;
  const close = toMin(S.close_time), now = nowMinutes();
  return now >= close - S.surplus_minutes && now < close;
}
const dealPrice = (price, S) => round2(Number(price) * (1 - S.surplus_percent / 100));

// Adds surplus_price / surplus_active to menu rows (display only; the order re-computes it).
function decorateMenu(rows, S) {
  const active = surplusActive(S, todayStr());
  return rows.map((m) => ({ ...m, surplus_active: active && Boolean(m.surplus_eligible) && m.stock > 0, surplus_price: active && m.surplus_eligible && m.stock > 0 ? dealPrice(m.price, S) : null }));
}

// quantities: Map(menuItemId -> qty). Locks rows, validates stock, returns priced snapshot lines.
async function lockAndPrice(conn, quantities, mealDate, S) {
  const ids = [...quantities.keys()].sort((a, b) => a - b); // stable lock order avoids deadlocks
  const [rows] = await conn.query(`SELECT * FROM menu_items WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id FOR UPDATE`, ids);
  const deal = surplusActive(S, mealDate);
  const snapshot = [], lowNow = [];
  let total = 0, savings = 0, hasIftar = false;
  for (const id of ids) {
    const qty = quantities.get(id);
    const m = rows.find((r) => r.id === id);
    if (!m || !m.is_active || (m.iftar_only && !S.ramadan_mode)) throw { status: 404, message: `Menu item ${id} is not available` };
    if (m.stock < qty) throw { status: 409, message: `${m.name}: only ${m.stock} left` };
    if (m.iftar_only) hasIftar = true;
    const unit = deal && m.surplus_eligible ? dealPrice(m.price, S) : Number(m.price);
    total += unit * qty;
    savings += (Number(m.price) - unit) * qty;
    snapshot.push({ id: m.id, name: m.name, price: unit, original_price: unit < Number(m.price) ? Number(m.price) : null, qty });
    await conn.query("UPDATE menu_items SET stock = stock - ? WHERE id = ?", [qty, id]);
    const after = m.stock - qty;
    if ((m.stock > LOW_STOCK && after <= LOW_STOCK) || after === 0) lowNow.push({ id: m.id, name: m.name, stock: after });
  }
  return { snapshot, total: round2(total), savings: round2(savings), lowNow, hasIftar };
}

// Validates + reserves a pickup slot. Serialised with a row lock so two people can't take the last place.
async function reserveSlot(conn, mealDate, slot, S, { hasIftar = false } = {}) {
  if (!slot) { if (hasIftar) throw { status: 400, message: "Iftar items need an iftar pickup slot" }; return null; }
  await conn.query("SELECT v FROM app_settings WHERE k = 'slot_lock' FOR UPDATE");
  const def = slotList(mealDate, S).find((s) => s.time === slot);
  if (!def) throw { status: 400, message: "That pickup time is not available on this date" };
  if (hasIftar && def.kind !== "iftar") throw { status: 400, message: "Iftar items can only be picked up in an iftar slot" };
  if (isPast(mealDate, slot)) throw { status: 409, message: "That pickup time has already passed" };
  const counts = await loadCounts(conn, mealDate);
  if ((counts.get(slot) || 0) >= def.capacity) throw { status: 409, message: `The ${slot} slot is full — please pick another time` };
  return slot;
}

module.exports = { round2, LOW_STOCK, surplusActive, dealPrice, decorateMenu, lockAndPrice, reserveSlot };
