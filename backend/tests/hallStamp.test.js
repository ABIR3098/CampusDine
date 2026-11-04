process.env.CANTEEN_TZ = "Asia/Dhaka"; // the second test uses Dhaka wall-clock time
const test = require("node:test");
const assert = require("node:assert/strict");
const { localStamp } = require("../src/hall/util");

test("localStamp writes YYYY-MM-DD HH:MM:SS", () => {
  assert.match(localStamp(new Date()), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test("localStamp moves a late UTC evening to the next day in Dhaka", () => {
  assert.equal(localStamp(new Date("2026-10-31T18:30:00Z")), "2026-11-01 00:30:00");
});
