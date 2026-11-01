const test = require("node:test");
const assert = require("node:assert/strict");
const { validateLoginPayload, validateRegisterPayload } = require("../src/validators/authValidator");

test("validateLoginPayload rejects missing ID", () => {
  let status = null;
  const req = { body: { externalId: "", password: "password123" } };
  const res = {
    status(s) { status = s; return this; },
    json() {}
  };
  let nextCalled = false;
  validateLoginPayload(req, res, () => { nextCalled = true; });

  assert.equal(status, 400);
  assert.equal(nextCalled, false);
});

test("validateLoginPayload rejects short password", () => {
  let status = null;
  const req = { body: { externalId: "student1", password: "12" } };
  const res = {
    status(s) { status = s; return this; },
    json() {}
  };
  let nextCalled = false;
  validateLoginPayload(req, res, () => { nextCalled = true; });

  assert.equal(status, 400);
  assert.equal(nextCalled, false);
});

test("validateLoginPayload passes valid credentials", () => {
  const req = { body: { externalId: "student1", password: "password123" } };
  let nextCalled = false;
  validateLoginPayload(req, {}, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
});

test("validateRegisterPayload rejects invalid email format", () => {
  let status = null;
  const req = { body: { name: "Abir", externalId: "student2", password: "secretpass123", email: "not-an-email" } };
  const res = {
    status(s) { status = s; return this; },
    json() {}
  };
  let nextCalled = false;
  validateRegisterPayload(req, res, () => { nextCalled = true; });

  assert.equal(status, 400);
  assert.equal(nextCalled, false);
});
