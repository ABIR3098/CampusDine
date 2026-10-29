const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCartLimits, MAX_QTY_PER_ITEM, MAX_CART_LINES } = require("../src/utils/orderRules");

test("a normal cart passes", () => {
  assert.equal(validateCartLimits([{ id: 1, qty: 2 }, { id: 2, qty: 1 }]), null);
});

test("quantity at the limit passes, one above fails", () => {
  assert.equal(validateCartLimits([{ id: 1, qty: MAX_QTY_PER_ITEM }]), null);
  assert.match(validateCartLimits([{ id: 1, qty: MAX_QTY_PER_ITEM + 1 }]), /at most/);
});

test("too many different items fails", () => {
  const many = Array.from({ length: MAX_CART_LINES + 1 }, (_, i) => ({ id: i + 1, qty: 1 }));
  assert.match(validateCartLimits(many), /different items/);
  assert.equal(validateCartLimits(many.slice(0, MAX_CART_LINES)), null);
});

test("estimateReadyAt adds the queue minutes to the start time", () => {
  const { estimateReadyAt } = require("../src/utils/orderRules");
  const from = new Date("2026-01-01T10:00:00.000Z");
  assert.equal(estimateReadyAt(12, from), "2026-01-01T10:12:00.000Z");
  assert.equal(estimateReadyAt(0, from), "2026-01-01T10:00:00.000Z");
});

test("buildOrderStats averages only real orders and handles no orders", () => {
  const { buildOrderStats } = require("../src/utils/orderRules");
  assert.deepEqual(buildOrderStats({ orders: "4", spent: "1000", cancelled: "1", monthSpent: "250" }, { name: "Tehari", qty: "6" }), {
    orders: 4, cancelled: 1, spent: 1000, monthSpent: 250, averageOrder: 250, favouriteItem: { name: "Tehari", qty: 6 },
  });
  const empty = buildOrderStats({ orders: null, spent: null }, null);
  assert.equal(empty.orders, 0);
  assert.equal(empty.averageOrder, 0);
  assert.equal(empty.favouriteItem, null);
});

test("parseListParams: defaults mean 'everything'", () => {
  const { parseListParams } = require("../src/utils/orderRules");
  assert.deepEqual(parseListParams({}), { status: null, limit: null, offset: null });
});

test("parseListParams: reads status case-insensitively, limit and offset", () => {
  const { parseListParams } = require("../src/utils/orderRules");
  assert.deepEqual(parseListParams({ status: "ready", limit: "20", offset: "40" }), { status: "Ready", limit: 20, offset: 40 });
});

test("parseListParams: rejects bad values", () => {
  const { parseListParams } = require("../src/utils/orderRules");
  for (const q of [{ status: "done" }, { limit: "0" }, { limit: "101" }, { limit: "abc" }, { offset: "-1" }, { offset: "1.5" }]) {
    assert.ok(parseListParams(q).error, JSON.stringify(q));
  }
});

test("parseAdminFilters: empty query means no filters", () => {
  const { parseAdminFilters } = require("../src/utils/orderRules");
  assert.deepEqual(parseAdminFilters({}), { status: null, q: null, from: null, to: null });
});

test("parseAdminFilters: reads every filter", () => {
  const { parseAdminFilters } = require("../src/utils/orderRules");
  assert.deepEqual(
    parseAdminFilters({ status: "cooking", q: " C-105 ", from: "2026-10-01", to: "2026-10-31" }),
    { status: "Cooking", q: "C-105", from: "2026-10-01", to: "2026-10-31" }
  );
});

test("parseAdminFilters: rejects bad dates and reversed ranges", () => {
  const { parseAdminFilters } = require("../src/utils/orderRules");
  assert.ok(parseAdminFilters({ from: "31-10-2026" }).error);
  assert.ok(parseAdminFilters({ to: "2026-13-40" }).error);
  assert.ok(parseAdminFilters({ from: "2026-11-01", to: "2026-10-01" }).error);
  assert.ok(parseAdminFilters({ status: "nope" }).error);
});

test("cleanCancelReason trims, limits and nulls empty input", () => {
  const { cleanCancelReason } = require("../src/utils/orderRules");
  assert.equal(cleanCancelReason("  ordered by mistake "), "ordered by mistake");
  assert.equal(cleanCancelReason("x".repeat(300)).length, 100);
  assert.equal(cleanCancelReason("   "), null);
  assert.equal(cleanCancelReason(undefined), null);
  assert.equal(cleanCancelReason(42), null);
});
