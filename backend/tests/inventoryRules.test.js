const test = require("node:test");
const assert = require("node:assert/strict");
const r = require("../src/inventory/rules");

test("toQty accepts numbers and numeric strings and rounds to 2 decimals", () => {
  assert.equal(r.toQty("2.456"), 2.46);
  assert.equal(r.toQty(10), 10);
  assert.equal(r.toQty(" 7 "), 7);
});
