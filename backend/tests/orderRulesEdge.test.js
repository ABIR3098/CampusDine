const test = require("node:test");
const assert = require("node:assert");
const {
  validateCartLimits, parseListParams, parseAdminFilters, TIP_OPTIONS,
  MAX_CART_LINES, MAX_QTY_PER_ITEM,
} = require("../src/utils/orderRules");

test("a cart of exactly 15 lines with 20 of each item passes", () => {
  const items = Array.from({ length: MAX_CART_LINES }, (_, i) => ({ id: i, qty: String(MAX_QTY_PER_ITEM) }));
  assert.strictEqual(validateCartLimits(items), null);
});

test("tip options are 0, 5, 10 and 20", () => {
  assert.deepStrictEqual(TIP_OPTIONS, [0, 5, 10, 20]);
});

test("parseListParams: limit boundaries", () => {
  assert.strictEqual(parseListParams({ limit: "100" }).limit, 100);
  for (const bad of ["0", "101", "1.5", "abc"]) assert.ok(parseListParams({ limit: bad }).error, `limit ${bad}`);
});

test("parseListParams: offset 0 is allowed, negative is not", () => {
  assert.strictEqual(parseListParams({ offset: "0" }).offset, 0);
  assert.ok(parseListParams({ offset: "-1" }).error);
});

test("parseAdminFilters: same-day range is fine", () => {
  const r = parseAdminFilters({ from: "2026-10-05", to: "2026-10-05" });
  assert.strictEqual(r.error, undefined);
  assert.strictEqual(r.from, "2026-10-05");
});

test("parseAdminFilters: search text is trimmed and cut to 40 characters", () => {
  assert.strictEqual(parseAdminFilters({ q: "  " + "a".repeat(60) }).q.length, 40);
});

test("parseAdminFilters rejects impossible calendar dates", () => {
  assert.ok(parseAdminFilters({ from: "2026-02-30" }).error);
  assert.ok(parseAdminFilters({ to: "2026-13-01" }).error);
  assert.ok(parseAdminFilters({ from: "2026-04-31" }).error);
});
