const test = require("node:test");
const assert = require("node:assert/strict");
const { toMinutes, dayDiff, addDays, localParts } = require("../src/utils/clock");

test("toMinutes reads HH:MM", () => {
  assert.equal(toMinutes("08:30"), 510);
  assert.equal(toMinutes("00:00"), 0);
});

test("toMinutes accepts seconds and ignores them", () => {
  assert.equal(toMinutes("23:59:59"), 1439);
});

test("toMinutes rejects invalid values", () => {
  for (const bad of ["24:00", "9:30", "12:60", "", null, undefined, "abc"]) assert.equal(toMinutes(bad), null);
});

test("dayDiff counts whole days in both directions", () => {
  assert.equal(dayDiff("2026-10-30", "2026-10-31"), 1);
  assert.equal(dayDiff("2026-10-31", "2026-10-30"), -1);
  assert.equal(dayDiff("2026-10-31", "2026-10-31"), 0);
});
