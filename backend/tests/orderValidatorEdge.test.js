const test = require("node:test");
const assert = require("node:assert/strict");
const { validateOrderPayload } = require("../src/validators/orderValidator");

// Runs the validator once and reports what happened: "next", or [status, message].
function run(body) {
  let outcome = null;
  const res = {
    status(code) { this.code = code; return this; },
    json(payload) { outcome = [this.code, payload.error]; },
  };
  validateOrderPayload({ body }, res, () => { outcome = "next"; });
  return outcome;
}

const good = { name: "Tehari", price: 120, qty: 2 };

test("a normal order passes", () => {
  assert.equal(run({ items: [good], paymentMethod: "wallet" }), "next");
});

test("a missing body does not crash", () => {
  let outcome = null;
  const res = { status(c) { this.code = c; return this; }, json(p) { outcome = [this.code, p.error]; } };
  validateOrderPayload({}, res, () => { outcome = "next"; });
  assert.equal(outcome[0], 400);
});

test("a text price (NaN) is rejected", () => {
  const out = run({ items: [{ ...good, price: "abc" }] });
  assert.equal(out[0], 400);
  assert.match(out[1], /invalid price/);
});

test("an Infinity price is rejected", () => {
  assert.equal(run({ items: [{ ...good, price: Infinity }] })[0], 400);
  assert.equal(run({ items: [{ ...good, price: "Infinity" }] })[0], 400);
});

test("an empty-string price is rejected", () => {
  assert.equal(run({ items: [{ ...good, price: "" }] })[0], 400);
});

test("a negative price is still rejected", () => {
  assert.equal(run({ items: [{ ...good, price: -1 }] })[0], 400);
});

test("a price of zero is allowed (free item)", () => {
  assert.equal(run({ items: [{ ...good, price: 0 }] }), "next");
});

test("a null item gives a 400, not a crash", () => {
  const out = run({ items: [null] });
  assert.equal(out[0], 400);
  assert.match(out[1], /index 0/);
});

test("a non-object item gives a 400", () => {
  assert.equal(run({ items: ["Tehari"] })[0], 400);
  assert.equal(run({ items: [42] })[0], 400);
});

test("a blank name is rejected", () => {
  assert.equal(run({ items: [{ ...good, name: "   " }] })[0], 400);
});

test("a name that is not text is rejected", () => {
  assert.equal(run({ items: [{ ...good, name: 5 }] })[0], 400);
});

test("a decimal quantity is rejected", () => {
  assert.equal(run({ items: [{ ...good, qty: 1.5 }] })[0], 400);
});

test("a zero or negative quantity is rejected", () => {
  assert.equal(run({ items: [{ ...good, qty: 0 }] })[0], 400);
  assert.equal(run({ items: [{ ...good, qty: -2 }] })[0], 400);
});

test("a quantity above the per-item limit is rejected", () => {
  const out = run({ items: [{ ...good, qty: 21 }] });
  assert.equal(out[0], 400);
  assert.match(out[1], /at most 20/);
});

test("the per-item limit itself is allowed", () => {
  assert.equal(run({ items: [{ ...good, qty: 20 }] }), "next");
});

test("more than 15 different items is rejected", () => {
  const items = Array.from({ length: 16 }, (_, i) => ({ ...good, name: `Item ${i}` }));
  const out = run({ items });
  assert.equal(out[0], 400);
  assert.match(out[1], /at most 15/);
});

test("exactly 15 different items is allowed", () => {
  const items = Array.from({ length: 15 }, (_, i) => ({ ...good, name: `Item ${i}` }));
  assert.equal(run({ items }), "next");
});

test("an empty or non-array items value is rejected", () => {
  assert.equal(run({ items: [] })[0], 400);
  assert.equal(run({ items: "Tehari" })[0], 400);
  assert.equal(run({})[0], 400);
});

test("payment methods are checked", () => {
  for (const ok of ["wallet", "cash", "bkash", "nagad"]) assert.equal(run({ items: [good], paymentMethod: ok }), "next");
  assert.equal(run({ items: [good], paymentMethod: "cheque" })[0], 400);
  assert.equal(run({ items: [good] }), "next"); // no method given is allowed here
});
