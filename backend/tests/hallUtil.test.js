const test = require("node:test");
const assert = require("node:assert");
const { isDateKey, cutoffOf, isLocked } = require("../src/hall/util");

test("isDateKey accepts real dates only", () => {
  assert.strictEqual(isDateKey("2026-10-31"), true);
  assert.strictEqual(isDateKey("2026-02-30"), false);
  assert.strictEqual(isDateKey("31-10-2026"), false);
  assert.strictEqual(isDateKey(""), false);
  assert.strictEqual(isDateKey(null), false);
});

test("cutoffOf: same-day and day-before cutoffs", () => {
  const dinner = { cutoff_time: "15:00:00", cutoff_days_before: 0 };
  const breakfast = { cutoff_time: "21:00", cutoff_days_before: 1 };
  assert.deepStrictEqual(cutoffOf(dinner, "2026-10-22"), { dateKey: "2026-10-22", minutes: 900 });
  assert.deepStrictEqual(cutoffOf(breakfast, "2026-10-22"), { dateKey: "2026-10-21", minutes: 1260 });
});

test("isLocked flips exactly at the cutoff minute", () => {
  const dinner = { cutoff_time: "15:00", cutoff_days_before: 0 };
  assert.strictEqual(isLocked(dinner, "2026-10-22", { dateKey: "2026-10-22", minutes: 899 }), false);
  assert.strictEqual(isLocked(dinner, "2026-10-22", { dateKey: "2026-10-22", minutes: 900 }), true);
});

test("isLocked: earlier day is open, later day is locked", () => {
  const lunch = { cutoff_time: "10:00", cutoff_days_before: 0 };
  assert.strictEqual(isLocked(lunch, "2026-10-22", { dateKey: "2026-10-21", minutes: 1400 }), false);
  assert.strictEqual(isLocked(lunch, "2026-10-22", { dateKey: "2026-10-23", minutes: 0 }), true);
});

test("isDateKey accepts a real date", () => {
  assert.equal(isDateKey("2026-10-31"), true);
});

test("isDateKey rejects dates that do not exist", () => {
  assert.equal(isDateKey("2026-02-30"), false);
  assert.equal(isDateKey("2026-13-01"), false);
});

test("isDateKey rejects wrong formats and empty input", () => {
  for (const bad of ["2026-1-5", "31-10-2026", "abcd-ef-gh", "", null, undefined]) assert.equal(isDateKey(bad), false);
});

test("addDays crosses the year end", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("cutoffOf for a same-day cut-off", () => {
  assert.deepEqual(cutoffOf(dinner, "2026-10-22"), { dateKey: "2026-10-22", minutes: 900 });
});

test("cutoffOf for a cut-off the evening before", () => {
  assert.deepEqual(cutoffOf(breakfast, "2026-10-22"), { dateKey: "2026-10-21", minutes: 1260 });
});

test("isLocked is false one minute before the cut-off and true at it", () => {
  assert.equal(isLocked(dinner, "2026-10-22", { dateKey: "2026-10-22", minutes: 899 }), false);
  assert.equal(isLocked(dinner, "2026-10-22", { dateKey: "2026-10-22", minutes: 900 }), true);
});
