const test = require("node:test");
const assert = require("node:assert/strict");
const { RSVP_STATUSES, parseRsvpStatus } = require("../src/hall/feastRsvp");

test("the two valid answers are going and not_going", () => {
  assert.deepEqual(RSVP_STATUSES, ["going", "not_going"]);
});

test("accepts going and not_going", () => {
  assert.equal(parseRsvpStatus("going"), "going");
  assert.equal(parseRsvpStatus("not_going"), "not_going");
});

test("ignores letter case and spaces around the word", () => {
  assert.equal(parseRsvpStatus("  GOING "), "going");
  assert.equal(parseRsvpStatus("Not_Going"), "not_going");
});

test("anything else is null", () => {
  for (const bad of ["maybe", "", "not going", "yes", null, undefined, 1, {}]) {
    assert.equal(parseRsvpStatus(bad), null);
  }
});
