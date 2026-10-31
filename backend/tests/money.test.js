const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_DAILY_TOPUP_LIMIT, dailyTopupLimit, checkDailyTopup } = require("../src/utils/money");

test("dailyTopupLimit uses the default when the variable is missing or invalid", () => {
  assert.equal(dailyTopupLimit({}), DEFAULT_DAILY_TOPUP_LIMIT);
  assert.equal(dailyTopupLimit({ WALLET_TOPUP_DAILY_LIMIT: "abc" }), DEFAULT_DAILY_TOPUP_LIMIT);
  assert.equal(dailyTopupLimit({ WALLET_TOPUP_DAILY_LIMIT: "0" }), DEFAULT_DAILY_TOPUP_LIMIT);
  assert.equal(dailyTopupLimit({ WALLET_TOPUP_DAILY_LIMIT: "-5" }), DEFAULT_DAILY_TOPUP_LIMIT);
});

test("dailyTopupLimit reads a valid value from the environment", () => {
  assert.equal(dailyTopupLimit({ WALLET_TOPUP_DAILY_LIMIT: "5000" }), 5000);
});

test("a top-up inside the limit is allowed and the rest is reported", () => {
  const r = checkDailyTopup({ toppedUpToday: 5000, amount: 10000, limit: 20000 });
  assert.deepEqual(r, { ok: true, remaining: 15000 });
});

test("a top-up that reaches the limit exactly is allowed", () => {
  assert.equal(checkDailyTopup({ toppedUpToday: 10000, amount: 10000, limit: 20000 }).ok, true);
});

test("a top-up that goes over the limit is refused", () => {
  const r = checkDailyTopup({ toppedUpToday: 15000, amount: 10000, limit: 20000 });
  assert.deepEqual(r, { ok: false, remaining: 5000 });
});

test("nothing is left once the limit is used, and remaining never goes negative", () => {
  assert.deepEqual(checkDailyTopup({ toppedUpToday: 25000, amount: 1, limit: 20000 }), { ok: false, remaining: 0 });
});

test("paisa are counted exactly", () => {
  assert.equal(checkDailyTopup({ toppedUpToday: 19999.99, amount: 0.01, limit: 20000 }).ok, true);
  assert.equal(checkDailyTopup({ toppedUpToday: 19999.99, amount: 0.02, limit: 20000 }).ok, false);
});
