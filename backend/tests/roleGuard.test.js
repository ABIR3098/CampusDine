const test = require("node:test");
const assert = require("node:assert/strict");
const roleGuard = require("../src/middleware/roleGuard");

test("roleGuard blocks unauthenticated requests with 401", () => {
  const guard = roleGuard("admin");
  let status = null;
  let json = null;
  const req = {};
  const res = {
    status(s) { status = s; return this; },
    json(j) { json = j; }
  };
  let nextCalled = false;
  guard(req, res, () => { nextCalled = true; });

  assert.equal(status, 401);
  assert.equal(nextCalled, false);
});

test("roleGuard blocks users without required role with 403", () => {
  const guard = roleGuard("admin", "staff");
  let status = null;
  const req = { user: { role: "student" } };
  const res = {
    status(s) { status = s; return this; },
    json() {}
  };
  let nextCalled = false;
  guard(req, res, () => { nextCalled = true; });

  assert.equal(status, 403);
  assert.equal(nextCalled, false);
});

test("roleGuard passes requests with matching role", () => {
  const guard = roleGuard("admin", "staff");
  const req = { user: { role: "admin" } };
  let nextCalled = false;
  guard(req, {}, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
});
