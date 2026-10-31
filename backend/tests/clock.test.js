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

test("addDays rolls over the month", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
});

test("addDays handles leap day and negative numbers", () => {
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("localParts gives the Dhaka wall clock", () => {
  const p = localParts(new Date("2026-10-31T03:17:00Z"), "Asia/Dhaka");
  assert.deepEqual(p, { dateKey: "2026-10-31", dow: 6, minutes: 557 });
});

test("localParts moves to the next local day after midnight", () => {
  const p = localParts(new Date("2026-10-31T18:30:00Z"), "Asia/Dhaka");
  assert.deepEqual(p, { dateKey: "2026-11-01", dow: 0, minutes: 30 });
});
