process.env.CANTEEN_TZ = "Asia/Dhaka"; // the tests below use Dhaka wall-clock times
const test = require("node:test");
const assert = require("node:assert/strict");
const { r2, isHappyHourActive, happyHourCovers } = require("../src/pricing");

const hh = (over = {}) => ({ is_active: 1, start_time: "14:00", end_time: "16:00", days: [], itemIds: [], category: null, ...over });
// Dhaka is UTC+6, so 09:00Z is 15:00 in Dhaka. 2026-10-31 is a Saturday (dow 6).
const at = (iso) => new Date(iso);

test("r2 rounds to two decimals", () => {
  assert.equal(r2(10.126), 10.13);
  assert.equal(r2("5"), 5);
  assert.equal(r2(0.1 + 0.2), 0.3);
});

test("happy hour is active inside its window", () => {
  assert.equal(isHappyHourActive(hh(), at("2026-10-31T09:00:00Z")), true);
});

test("happy hour window start is inclusive and end is exclusive", () => {
  assert.equal(isHappyHourActive(hh(), at("2026-10-31T08:00:00Z")), true);
  assert.equal(isHappyHourActive(hh(), at("2026-10-31T10:00:00Z")), false);
  assert.equal(isHappyHourActive(hh(), at("2026-10-31T07:59:00Z")), false);
});

test("an inactive happy hour never runs", () => {
  assert.equal(isHappyHourActive(hh({ is_active: 0 }), at("2026-10-31T09:00:00Z")), false);
});

test("happy hour respects the allowed weekdays", () => {
  assert.equal(isHappyHourActive(hh({ days: [0] }), at("2026-10-31T09:00:00Z")), false);
  assert.equal(isHappyHourActive(hh({ days: [6] }), at("2026-10-31T09:00:00Z")), true);
});

test("an overnight window runs before and after midnight", () => {
  const night = hh({ start_time: "22:00", end_time: "02:00" });
  assert.equal(isHappyHourActive(night, at("2026-10-31T17:00:00Z")), true); // 23:00 Dhaka
  assert.equal(isHappyHourActive(night, at("2026-10-31T19:00:00Z")), true); // 01:00 Dhaka next day
  assert.equal(isHappyHourActive(night, at("2026-10-31T21:00:00Z")), false); // 03:00 Dhaka
});

test("an overnight window belongs to the day it started on", () => {
  const satNight = hh({ start_time: "22:00", end_time: "02:00", days: [6] });
  assert.equal(isHappyHourActive(satNight, at("2026-10-31T19:00:00Z")), true); // Sunday 01:00, started Saturday
});

test("equal or invalid start and end times never run", () => {
  assert.equal(isHappyHourActive(hh({ start_time: "14:00", end_time: "14:00" }), at("2026-10-31T08:00:00Z")), false);
  assert.equal(isHappyHourActive(hh({ start_time: "bad" }), at("2026-10-31T09:00:00Z")), false);
});

test("happyHourCovers checks listed items first, then category, else everything", () => {
  const line = { id: 7, category: "drinks" };
  assert.equal(happyHourCovers(hh({ itemIds: [7] }), line), true);
  assert.equal(happyHourCovers(hh({ itemIds: [8] }), line), false);
  assert.equal(happyHourCovers(hh({ category: "drinks" }), line), true);
  assert.equal(happyHourCovers(hh({ category: "heavy" }), line), false);
  assert.equal(happyHourCovers(hh(), line), true);
});
