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

test("rejecting needs a reason, approving does not", () => {
  assert.ok(r.validateDecision({ decision: "rejected" }).error);
  assert.ok(r.validateDecision({ decision: "maybe" }).error);
  assert.equal(r.validateDecision({ decision: "approved" }).value.reply, "");
  assert.equal(r.validateDecision({ decision: "rejected", reply: "Budget used up" }).value.decision, "rejected");
});

test("purchase validation computes total and needs an item or request", () => {
  assert.ok(r.validatePurchase({ quantity: 5 }).error);
  assert.ok(r.validatePurchase({ itemId: 1, quantity: 0 }).error);
  const p = r.validatePurchase({ itemId: 1, quantity: "10", unitCost: "62.5", supplier: " Karim Store " });
  assert.equal(p.value.totalCost, 625);
  assert.equal(p.value.supplier, "Karim Store");
  assert.equal(r.validatePurchase({ requestId: 4, quantity: 2 }).value.totalCost, null);
});

test("stock adjustment needs a reason; new items need a valid unit", () => {
  assert.ok(r.validateAdjustment({ newStock: 5 }).error);
  assert.equal(r.validateAdjustment({ newStock: 5, note: "Recount" }).value.newStock, 5);
  assert.ok(r.validateNewItem({ name: "Salt", unit: "bucket" }).error);
  assert.equal(r.validateNewItem({ name: "Salt", unit: "kg" }).value.currentStock, 0);
});

test("stockLevel labels out, low and ok", () => {
  assert.equal(r.stockLevel(0, 5), "out");
  assert.equal(r.stockLevel(4, 5), "low");
  assert.equal(r.stockLevel(5, 5), "low");
  assert.equal(r.stockLevel(20, 5), "ok");
  assert.equal(r.stockLevel(20, 0), "ok");
});

test("quantities typed with a unit or Bengali digits are understood", () => {
  assert.equal(r.toQty("35kg"), 35);
  assert.equal(r.toQty("5 kg"), 5);
  assert.equal(r.toQty("1,200 kg"), 1200);
  assert.equal(r.toQty("৩৫"), 35);
  assert.equal(r.toQty("2.5litre"), 2.5);
  assert.equal(r.toQty("kg"), null);
  assert.equal(r.toQty("-5kg"), null);
  assert.equal(r.validateStaffRequest({ itemId: 1, currentQty: "35kg", requiredQty: "5kg" }).value.currentQty, 35);
});

