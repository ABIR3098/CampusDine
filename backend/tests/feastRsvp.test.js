const test = require("node:test");
const assert = require("node:assert/strict");
const { RSVP_STATUSES, parseRsvpStatus, hasSeat } = require("../src/hall/feastRsvp");

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

test("no capacity means no limit", () => {
  assert.equal(hasSeat(null, 9999), true);
  assert.equal(hasSeat(undefined, 9999), true);
});

test("there is a seat while going is below capacity", () => {
  assert.equal(hasSeat(10, 0), true);
  assert.equal(hasSeat(10, 9), true);
});

test("no seat once going reaches capacity", () => {
  assert.equal(hasSeat(10, 10), false);
  assert.equal(hasSeat(10, 11), false);
});

test("someone who is already going keeps their seat", () => {
  assert.equal(hasSeat(10, 10, true), true);
});

test("a capacity of 0 never has a seat", () => {
  assert.equal(hasSeat(0, 0), false);
});
