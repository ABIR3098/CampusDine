const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPayload, parseCode, sign } = require("../src/utils/tokenQr");

test("sign is 12 uppercase hex characters and stable", () => {
  assert.match(sign("C-105"), /^[0-9A-F]{12}$/);
  assert.equal(sign("C-105"), sign("C-105"));
});

test("a built payload parses back as valid", () => {
  const payload = buildPayload("C-105");
  assert.ok(payload.startsWith("CD1|C-105|"));
  assert.deepEqual(parseCode(payload), { token: "C-105", signed: true, valid: true });
});

test("a tampered signature is invalid", () => {
  const bad = "CD1|C-105|000000000000";
  assert.equal(parseCode(bad).valid, false);
});

test("a different token with an old signature is invalid", () => {
  const sig = sign("C-105");
  assert.equal(parseCode(`CD1|C-999|${sig}`).valid, false);
});
