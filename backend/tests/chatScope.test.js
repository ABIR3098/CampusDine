const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const chat = require("../src/routes/chat");
const { scopeOf, SCOPE_ROLE, isInboxOwner } = chat._test;

const req = (role, { query = {}, body = {} } = {}) => ({ user: { id: 1, role }, query, body });

test("canteen admin always works in the canteen inbox", () => {
  assert.equal(scopeOf(req("admin", { query: { scope: "hall" } })), "canteen");
});

test("hall admin always works in the hall inbox", () => {
  assert.equal(scopeOf(req("hall_admin")), "hall");
  assert.equal(scopeOf(req("hall_admin", { query: { scope: "canteen" } })), "hall");
});

test("a student chooses the inbox, canteen is the default", () => {
  assert.equal(scopeOf(req("student")), "canteen");
  assert.equal(scopeOf(req("student", { query: { scope: "hall" } })), "hall");
  assert.equal(scopeOf(req("student", { body: { scope: "hall" } })), "hall");
  assert.equal(scopeOf(req("student", { query: { scope: "nonsense" } })), "canteen");
});

test("teachers can use the hall chat, canteen staff cannot", () => {
  assert.equal(scopeOf(req("teacher", { query: { scope: "hall" } })), "hall");
  assert.equal(scopeOf(req("staff", { query: { scope: "hall" } })), "canteen");
});

test("each inbox is answered by its own admin role", () => {
  assert.equal(SCOPE_ROLE.canteen, "admin");
  assert.equal(SCOPE_ROLE.hall, "hall_admin");
  assert.equal(isInboxOwner({ role: "admin" }), true);
  assert.equal(isInboxOwner({ role: "hall_admin" }), true);
  assert.equal(isInboxOwner({ role: "student" }), false);
});
