const test = require("node:test");
const assert = require("node:assert/strict");
const r = require("../src/inventory/rules");

test("toQty accepts numbers and numeric strings and rounds to 2 decimals", () => {
  assert.equal(r.toQty("2.456"), 2.46);
  assert.equal(r.toQty(10), 10);
  assert.equal(r.toQty(" 7 "), 7);
});

test("toQty rejects zero, negatives, NaN, empty and absurd values", () => {
  for (const bad of [0, -1, "abc", "", null, undefined, Infinity, r.MAX_QTY + 1]) assert.equal(r.toQty(bad), null);
  assert.equal(r.toQty(0, { allowZero: true }), 0);
});

test("status transitions follow pending -> approved/rejected -> purchased", () => {
  assert.ok(r.canTransition("pending", "approved"));
  assert.ok(r.canTransition("pending", "rejected"));
  assert.ok(r.canTransition("approved", "purchased"));
  assert.ok(!r.canTransition("rejected", "approved"));
  assert.ok(!r.canTransition("purchased", "approved"));
  assert.ok(!r.canTransition("pending", "purchased"));
  assert.ok(!r.canTransition("nope", "approved"));
});
