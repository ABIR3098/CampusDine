const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPayload, parseCode, sign } = require("../src/utils/tokenQr");

test("sign is 12 uppercase hex characters and stable", () => {
  assert.match(sign("C-105"), /^[0-9A-F]{12}$/);
  assert.equal(sign("C-105"), sign("C-105"));
});
