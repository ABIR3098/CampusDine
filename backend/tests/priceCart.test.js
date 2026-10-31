process.env.CANTEEN_TZ = "Asia/Dhaka";
const test = require("node:test");
const assert = require("node:assert/strict");
const { priceCart } = require("../src/pricing");

// A tiny fake database: priceCart only reads combos and happy hours.
function fakeDb({ combos = [], comboItems = [], happy = [], happyItems = [] } = {}) {
  return {
    async query(sql) {
      if (sql.includes("FROM combo_deals")) return [combos];
      if (sql.includes("FROM combo_deal_items")) return [comboItems];
      if (sql.includes("FROM happy_hours")) return [happy];
      if (sql.includes("FROM happy_hour_items")) return [happyItems];
      throw new Error("unexpected query: " + sql);
    },
  };
}

const item = (id, price, qty, category = "heavy") => ({ id, name: `Item ${id}`, price, qty, category });
// 2026-10-31T09:00:00Z is 15:00 in Dhaka, a Saturday.
const WHEN = new Date("2026-10-31T09:00:00Z");

test("a cart with no promotions pays the full price", async () => {
  const r = await priceCart(fakeDb(), [item(1, 60, 2), item(2, 10, 3)], WHEN);
  assert.equal(r.subtotal, 150);
  assert.equal(r.promoDiscount, 0);
  assert.equal(r.promoTotal, 150);
  assert.equal(r.promoLabel, null);
});

test("a complete combo costs the combo price", async () => {
  const db = fakeDb({
    combos: [{ id: 1, name: "Lunch set", name_bn: null, price: 80 }],
    comboItems: [
      { combo_id: 1, item_id: 1, qty: 1, price: 60 },
      { combo_id: 1, item_id: 2, qty: 1, price: 40 },
    ],
  });
  const r = await priceCart(db, [item(1, 60, 1), item(2, 40, 1)], WHEN);
  assert.equal(r.comboDiscount, 20);
  assert.equal(r.promoTotal, 80);
  assert.equal(r.lines.reduce((s, l) => s + l.comboDiscount, 0), 20);
  assert.match(r.promoLabel, /Combo: Lunch set/);
});

test("two full sets get double the saving, and leftover units pay full price", async () => {
  const db = fakeDb({
    combos: [{ id: 1, name: "Lunch set", name_bn: null, price: 80 }],
    comboItems: [
      { combo_id: 1, item_id: 1, qty: 1, price: 60 },
      { combo_id: 1, item_id: 2, qty: 1, price: 40 },
    ],
  });
  const r = await priceCart(db, [item(1, 60, 3), item(2, 40, 2)], WHEN);
  assert.equal(r.appliedCombos[0].sets, 2);
  assert.equal(r.comboDiscount, 40);
  assert.equal(r.promoTotal, 3 * 60 + 2 * 40 - 40);
});

test("an incomplete combo gives no discount", async () => {
  const db = fakeDb({
    combos: [{ id: 1, name: "Lunch set", name_bn: null, price: 80 }],
    comboItems: [
      { combo_id: 1, item_id: 1, qty: 1, price: 60 },
      { combo_id: 1, item_id: 2, qty: 1, price: 40 },
    ],
  });
  const r = await priceCart(db, [item(1, 60, 1)], WHEN);
  assert.equal(r.comboDiscount, 0);
});

test("a combo that costs more than its parts is ignored", async () => {
  const db = fakeDb({
    combos: [{ id: 1, name: "Bad deal", name_bn: null, price: 150 }],
    comboItems: [
      { combo_id: 1, item_id: 1, qty: 1, price: 60 },
      { combo_id: 1, item_id: 2, qty: 1, price: 40 },
    ],
  });
  const r = await priceCart(db, [item(1, 60, 1), item(2, 40, 1)], WHEN);
  assert.equal(r.comboDiscount, 0);
});

const happyHour = (over = {}) => ({
  id: 5, name: "Tea time", name_bn: null, is_active: 1, start_time: "14:00", end_time: "16:00",
  days: "", category: null, discount_type: "PERCENTAGE", discount_value: 10, ...over,
});

test("a percentage happy hour takes that share off the covered lines", async () => {
  const r = await priceCart(fakeDb({ happy: [happyHour()] }), [item(1, 50, 2)], WHEN);
  assert.equal(r.happyHourDiscount, 10);
  assert.equal(r.promoTotal, 90);
  assert.match(r.promoLabel, /Happy Hour: Tea time/);
});

test("a fixed happy hour discount is capped at the item price", async () => {
  const hh = happyHour({ discount_type: "FIXED", discount_value: 500 });
  const r = await priceCart(fakeDb({ happy: [hh] }), [item(1, 30, 2)], WHEN);
  assert.equal(r.happyHourDiscount, 60);
  assert.equal(r.promoTotal, 0);
});

test("a happy hour outside its window does nothing", async () => {
  const late = new Date("2026-10-31T14:00:00Z"); // 20:00 in Dhaka
  const r = await priceCart(fakeDb({ happy: [happyHour()] }), [item(1, 50, 2)], late);
  assert.equal(r.happyHourDiscount, 0);
});

test("happy hour only covers its own category", async () => {
  const hh = happyHour({ category: "drinks" });
  const r = await priceCart(fakeDb({ happy: [hh] }), [item(1, 50, 1, "heavy"), item(2, 20, 1, "drinks")], WHEN);
  assert.equal(r.lines.find((l) => l.id === 1).hhDiscount, 0);
  assert.equal(r.lines.find((l) => l.id === 2).hhDiscount, 2);
});

test("units already used by a combo do not get a happy hour discount", async () => {
  const db = fakeDb({
    combos: [{ id: 1, name: "Pair", name_bn: null, price: 70 }],
    comboItems: [{ combo_id: 1, item_id: 1, qty: 2, price: 50 }],
    happy: [happyHour({ discount_value: 10 })],
  });
  // 3 units: 2 are in the combo, only the third can get the 10% off (5)
  const r = await priceCart(db, [item(1, 50, 3)], WHEN);
  assert.equal(r.comboDiscount, 30);
  assert.equal(r.happyHourDiscount, 5);
  assert.equal(r.promoTotal, 150 - 30 - 5);
});

test("the best of two happy hours is used, not both", async () => {
  const hhs = [happyHour({ id: 1, discount_value: 10 }), happyHour({ id: 2, name: "Big", discount_value: 20 })];
  const r = await priceCart(fakeDb({ happy: hhs }), [item(1, 100, 1)], WHEN);
  assert.equal(r.happyHourDiscount, 20);
  assert.equal(r.appliedHappyHours.length, 1);
});
