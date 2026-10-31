const test = require("node:test");
const assert = require("node:assert/strict");
const { r2, hasMoneyPrecision } = require("../src/utils/money");

test("r2 removes float noise from subtraction", () => {
  assert.notEqual(0.3 - 0.1, 0.2); // the problem we guard against
  assert.equal(r2(0.3 - 0.1), 0.2);
  assert.equal(r2(100.1 - 0.1), 100);
  assert.equal(r2(60.3 - 0.1), 60.2);
});

test("r2 accepts numbers and numeric text", () => {
  assert.equal(r2("12.345"), 12.35);
  assert.equal(r2(5), 5);
  assert.equal(r2("100.00"), 100);
});

test("hasMoneyPrecision allows up to two decimals", () => {
  for (const ok of [1, 10, 10.5, 10.55, 0.01, 2000]) assert.equal(hasMoneyPrecision(ok), true, String(ok));
});

test("hasMoneyPrecision rejects more than two decimals", () => {
  for (const bad of [10.555, 0.001, 1.0001]) assert.equal(hasMoneyPrecision(bad), false, String(bad));
});
