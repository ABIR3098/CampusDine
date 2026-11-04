// Pure rules of the teacher <-> rider chat.
const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../src/teacherRiderChat/rules");

test("a message is trimmed and kept", () => {
  assert.deepEqual(rules.cleanMessage("  salam, I am at the gate \n"), { text: "salam, I am at the gate" });
});

test("an empty or blank message is refused", () => {
  assert.ok(rules.cleanMessage("").error);
  assert.ok(rules.cleanMessage("   \n ").error);
  assert.ok(rules.cleanMessage(null).error);
  assert.ok(rules.cleanMessage(undefined).error);
});

test("the length limit is 2000 characters", () => {
  assert.equal(rules.cleanMessage("a".repeat(2000)).text.length, 2000);
  assert.match(rules.cleanMessage("a".repeat(2001)).error, /2000/);
});

test("only a teacher and a rider can talk to each other", () => {
  assert.equal(rules.canChat("teacher", "rider"), true);
  assert.equal(rules.canChat("rider", "teacher"), true);
  for (const [a, b] of [["teacher", "teacher"], ["rider", "rider"], ["student", "rider"], ["teacher", "admin"], ["admin", "rider"], ["staff", "teacher"]]) {
    assert.equal(rules.canChat(a, b), false, a + " -> " + b);
  }
  assert.equal(rules.peerRoleOf("teacher"), "rider");
  assert.equal(rules.peerRoleOf("rider"), "teacher");
  assert.equal(rules.peerRoleOf("student"), null);
});

test("a thread is stored as teacher + rider whoever writes", () => {
  assert.deepEqual(rules.pairOf({ id: 1, role: "teacher" }, { id: 2, role: "rider" }), { teacherId: 1, riderId: 2 });
  assert.deepEqual(rules.pairOf({ id: 2, role: "rider" }, { id: 1, role: "teacher" }), { teacherId: 1, riderId: 2 });
  assert.equal(rules.pairOf({ id: 3, role: "student" }, { id: 2, role: "rider" }), null);
  assert.equal(rules.pairOf({ id: 1, role: "teacher" }, { id: 5, role: "teacher" }), null);
  assert.equal(rules.pairOf(null, { id: 2, role: "rider" }), null);
});

test("ids must be positive whole numbers", () => {
  assert.equal(rules.parseId("12"), 12);
  for (const bad of ["0", "-3", "1.5", "abc", "", null, undefined]) assert.equal(rules.parseId(bad), null, String(bad));
});

test("the list preview is one short line", () => {
  assert.equal(rules.previewOf("two\n\nlines   here", false), "two lines here");
  assert.equal(rules.previewOf("x".repeat(200), false).length, 80);
  assert.equal(rules.previewOf("secret", true), "Message deleted");
  assert.equal(rules.previewOf(null, false), "");
});
