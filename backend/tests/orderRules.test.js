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

test("tip options and statuses are fixed lists", () => {
  const { TIP_OPTIONS, STATUSES, ALL_STATUSES } = require("../src/utils/orderRules");
  assert.deepEqual(TIP_OPTIONS, [0, 5, 10, 20]);
  assert.deepEqual(STATUSES, ["Received", "Cooking", "Ready"]);
  assert.equal(ALL_STATUSES[ALL_STATUSES.length - 1], "Cancelled");
});

test("validateCartLimits explains the too-many-lines error", () => {
  const items = Array.from({ length: 16 }, (_, i) => ({ id: i, qty: 1 }));
  assert.equal(validateCartLimits(items), "An order can have at most 15 different items");
});

test("validateCartLimits explains the too-many-of-one-item error", () => {
  assert.equal(validateCartLimits([{ id: 1, qty: 21 }]), "You can order at most 20 of one item");
});

test("parseListParams accepts the largest page size", () => {
  const { parseListParams } = require("../src/utils/orderRules");
  assert.equal(parseListParams({ limit: "100" }).limit, 100);
});

test("parseListParams rejects a page size that is too big or zero", () => {
  const { parseListParams } = require("../src/utils/orderRules");
  assert.ok(parseListParams({ limit: "101" }).error);
  assert.ok(parseListParams({ limit: "0" }).error);
});

test("parseListParams rejects a negative offset", () => {
  const { parseListParams } = require("../src/utils/orderRules");
  assert.equal(parseListParams({ offset: "-1" }).error, "offset must be 0 or more");
});

test("parseListParams names the allowed statuses on error", () => {
  const { parseListParams } = require("../src/utils/orderRules");
  assert.match(parseListParams({ status: "Burnt" }).error, /^status must be one of Received, Cooking, Ready, Cancelled/);
});

test("parseAdminFilters trims the search text and caps it at 40 characters", () => {
  const { parseAdminFilters } = require("../src/utils/orderRules");
  assert.equal(parseAdminFilters({ q: "  C-105  " }).q, "C-105");
  assert.equal(parseAdminFilters({ q: "x".repeat(60) }).q.length, 40);
  assert.equal(parseAdminFilters({ q: "   " }).q, null);
});

test("cleanCancelReason ignores values that are not text", () => {
  const { cleanCancelReason } = require("../src/utils/orderRules");
  assert.equal(cleanCancelReason(42), null);
  assert.equal(cleanCancelReason(undefined), null);
});

test("cleanCancelReason keeps at most 100 characters", () => {
  const { cleanCancelReason } = require("../src/utils/orderRules");
  assert.equal(cleanCancelReason("a".repeat(150)).length, 100);
});

test("buildOrderStats converts the favourite quantity to a number", () => {
  const { buildOrderStats } = require("../src/utils/orderRules");
  const s = buildOrderStats({ orders: 2, spent: 300 }, { name: "Tehari", qty: "3" });
  assert.deepEqual(s.favouriteItem, { name: "Tehari", qty: 3 });
  assert.equal(s.averageOrder, 150);
});

test("estimateReadyAt with zero minutes is the start time", () => {
  const { estimateReadyAt } = require("../src/utils/orderRules");
  const start = new Date("2026-10-31T10:00:00Z");
  assert.equal(estimateReadyAt(0, start), start.toISOString());
});
