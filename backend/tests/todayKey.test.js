const test = require("node:test");
const assert = require("node:assert/strict");
const { todayKey } = require("../src/utils/clock");

test("todayKey uses the canteen date, not the UTC date (Dhaka is ahead of UTC)", () => {
  const t = new Date("2026-10-30T20:00:00Z"); // 02:00 on the 31st in Dhaka
  assert.equal(t.toISOString().slice(0, 10), "2026-10-30");
  assert.equal(todayKey(t, "Asia/Dhaka"), "2026-10-31");
});

test("todayKey in a timezone behind UTC gives the earlier date", () => {
  const t = new Date("2026-10-31T02:00:00Z"); // still the 30th in New York
  assert.equal(todayKey(t, "America/New_York"), "2026-10-30");
});

test("todayKey in UTC matches the ISO date", () => {
  const t = new Date("2026-03-05T12:00:00Z");
  assert.equal(todayKey(t, "UTC"), "2026-03-05");
});

test("todayKey crosses a month boundary correctly", () => {
  assert.equal(todayKey(new Date("2026-10-31T19:00:00Z"), "Asia/Dhaka"), "2026-11-01");
});

test("todayKey with no arguments returns a YYYY-MM-DD string", () => {
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
});
