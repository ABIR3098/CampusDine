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

test("staff request validation", () => {
  assert.ok(r.validateStaffRequest({}).error);
  assert.ok(r.validateStaffRequest({ itemId: 1, currentQty: -1, requiredQty: 5 }).error);
  assert.ok(r.validateStaffRequest({ itemId: 1, currentQty: 1, requiredQty: 0 }).error);
  const ok = r.validateStaffRequest({ itemId: "3", currentQty: "0", requiredQty: "25", requestType: "report", note: "  low   rice " });
  assert.deepEqual(ok.value, { itemId: 3, requestType: "report", currentQty: 0, requiredQty: 25, note: "low rice" });
  assert.equal(r.validateStaffRequest({ itemId: 1, currentQty: 1, requiredQty: 2, requestType: "weird" }).value.requestType, "request");
});
