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
