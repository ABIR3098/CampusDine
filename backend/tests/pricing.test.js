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
