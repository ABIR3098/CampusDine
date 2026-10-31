const test = require("node:test");
const assert = require("node:assert/strict");
const { toMinutes, dayDiff, addDays, localParts } = require("../src/utils/clock");

test("toMinutes reads HH:MM", () => {
  assert.equal(toMinutes("08:30"), 510);
  assert.equal(toMinutes("00:00"), 0);
});
