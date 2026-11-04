const test = require("node:test");
const assert = require("node:assert/strict");
const { validateOrderPayload } = require("../src/validators/orderValidator");

test("validateOrderPayload rejects empty items list", () => {
  let status = null;
  const req = { body: { items: [] } };
  const res = {
    status(s) { status = s; return this; },
    json() {}
  };
  let nextCalled = false;
  validateOrderPayload(req, res, () => { nextCalled = true; });

  assert.equal(status, 400);
  assert.equal(nextCalled, false);
});

test("validateOrderPayload rejects item with negative price", () => {
  let status = null;
  const req = { body: { items: [{ name: "Burger", price: -10 }] } };
  const res = {
    status(s) { status = s; return this; },
    json() {}
  };
  let nextCalled = false;
  validateOrderPayload(req, res, () => { nextCalled = true; });

  assert.equal(status, 400);
  assert.equal(nextCalled, false);
});

test("validateOrderPayload allows valid items list and valid payment method", () => {
  const req = { body: { items: [{ name: "Burger", price: 150, qty: 1 }], paymentMethod: "wallet" } };
  let nextCalled = false;
  validateOrderPayload(req, {}, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
});
