const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const chat = require("../src/routes/chat");
const { scopeOf, SCOPE_ROLE, isInboxOwner } = chat._test;

const req = (role, { query = {}, body = {} } = {}) => ({ user: { id: 1, role }, query, body });

test("canteen admin always works in the canteen inbox", () => {
  assert.equal(scopeOf(req("admin")), "canteen");
  assert.equal(chat._test.inboxScope(req("admin", { query: { scope: "hall" } })), "canteen");
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

test("the canteen admin is a member of the hall inbox only when it asks for scope=hall", () => {
  const { memberMode, inboxMode, inboxScope } = chat._test;
  // inside a restaurant: the canteen admin answers the canteen inbox
  assert.equal(memberMode(req("admin")), false);
  assert.equal(inboxMode(req("admin")), true);
  assert.equal(scopeOf(req("admin")), "canteen");
  // inside the Hall: the canteen admin writes to the Hall Admin like a student
  const inHall = req("admin", { query: { scope: "hall" } });
  assert.equal(memberMode(inHall), true);
  assert.equal(inboxMode(inHall), false);
  assert.equal(scopeOf(inHall), "hall");
  // but the inbox routes never trust the parameter, so the canteen admin cannot read the hall inbox
  assert.equal(inboxScope(inHall), "canteen");
});

test("the hall admin is never a member and always answers the hall inbox", () => {
  const { memberMode, inboxMode, inboxScope } = chat._test;
  const r = req("hall_admin", { query: { scope: "canteen" } });
  assert.equal(memberMode(r), false);
  assert.equal(inboxMode(r), true);
  assert.equal(inboxScope(r), "hall");
  assert.equal(scopeOf(r), "hall");
});

test("a rider is a member of the canteen inbox and never of the hall inbox", () => {
  const { memberMode, inboxMode, inboxScope } = chat._test;
  for (const query of [{}, { scope: "hall" }, { scope: "canteen" }]) {
    const r = req("rider", { query });
    assert.equal(scopeOf(r), "canteen");
    assert.equal(memberMode(r), true);
    assert.equal(inboxMode(r), false);
  }
  assert.equal(scopeOf(req("rider", { body: { scope: "hall" } })), "canteen");
  assert.equal(isInboxOwner({ role: "rider" }), false);
  assert.equal(inboxScope(req("rider")), "canteen");
});
