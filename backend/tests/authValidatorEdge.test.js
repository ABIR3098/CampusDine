const test = require("node:test");
const assert = require("node:assert/strict");
const { validateLoginPayload, validateRegisterPayload } = require("../src/validators/authValidator");

function run(fn, body) {
  let outcome = null;
  const res = {
    status(code) { this.code = code; return this; },
    json(payload) { outcome = [this.code, payload.error]; },
  };
  fn({ body }, res, () => { outcome = "next"; });
  return outcome;
}
const register = (body) => run(validateRegisterPayload, body);
const login = (body) => run(validateLoginPayload, body);
const good = { name: "Rafi", externalId: "2107001", password: "secret1", email: "rafi@example.com" };

test("a normal registration passes", () => {
  assert.equal(register(good), "next");
});

test("email is optional", () => {
  assert.equal(register({ ...good, email: undefined }), "next");
  assert.equal(register({ ...good, email: "" }), "next");
});

test("a number as the name gives a 400, not a crash", () => {
  const out = register({ ...good, name: 123 });
  assert.equal(out[0], 400);
  assert.match(out[1], /Full name/);
});

test("an object as the campus ID gives a 400, not a crash", () => {
  const out = register({ ...good, externalId: {} });
  assert.equal(out[0], 400);
  assert.match(out[1], /Campus ID/);
});

test("a numeric campus ID must be sent as text", () => {
  assert.equal(register({ ...good, externalId: 2107001 })[0], 400);
});

test("a blank name or campus ID is rejected", () => {
  assert.equal(register({ ...good, name: "   " })[0], 400);
  assert.equal(register({ ...good, externalId: "  " })[0], 400);
});

test("a numeric password no longer skips the length check", () => {
  assert.equal(register({ ...good, password: 12 })[0], 400);
  assert.equal(register({ ...good, password: 12345678 })[0], 400);
});

test("a password shorter than 6 characters is rejected", () => {
  assert.equal(register({ ...good, password: "12345" })[0], 400);
  assert.equal(register({ ...good, password: "123456" }), "next");
});

test("an email that is an array or object is rejected", () => {
  assert.equal(register({ ...good, email: ["a@b.co"] })[0], 400);
  assert.equal(register({ ...good, email: { a: 1 } })[0], 400);
});

test("badly formed emails are rejected", () => {
  for (const email of ["plain", "a@b", "a b@c.de", "@c.de"]) {
    assert.equal(register({ ...good, email })[0], 400, email);
  }
});

test("login: a non-text ID or password is rejected", () => {
  assert.equal(login({ externalId: 12, password: "secret1" })[0], 400);
  assert.equal(login({ externalId: "x", password: 123456 })[0], 400);
  assert.equal(login({ externalId: "   ", password: "secret1" })[0], 400);
});

test("login: a good payload passes", () => {
  assert.equal(login({ externalId: "2107001", password: "secret1" }), "next");
});
