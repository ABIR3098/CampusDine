const test = require("node:test");
const assert = require("node:assert/strict");
const { noticeScope } = require("../src/hall/noticeScope");

test("a member of a university gets that id twice, one for each placeholder", () => {
  const s = noticeScope(5);
  assert.deepEqual(s.params, [5, 5]);
  assert.equal((s.sql.match(/\?/g) || []).length, s.params.length);
});

test("campus-wide notices (no university) are always allowed by the condition", () => {
  assert.match(noticeScope(5).sql, /university_id IS NULL/);
});

test("a member with no university gets null, so every notice matches", () => {
  assert.deepEqual(noticeScope(null).params, [null, null]);
  assert.deepEqual(noticeScope(undefined).params, [null, null]);
  assert.deepEqual(noticeScope(0).params, [null, null]);
});
