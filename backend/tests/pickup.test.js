const test = require("node:test");
const assert = require("node:assert/strict");
const { resolvePickupTime, PICKUP_MIN_LEAD_MINUTES, PICKUP_MAX_LEAD_HOURS } = require("../src/utils/pickup");

const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const minutesFromNow = (m) => hhmm(new Date(Date.now() + m * 60000));

test("no pickup time means ASAP (null)", () => {
  assert.equal(resolvePickupTime(undefined), null);
  assert.equal(resolvePickupTime(""), null);
});

test("rejects values that are not HH:MM", () => {
  for (const bad of ["25:00", "12:60", "9:30", "noon", "12-30"]) {
    assert.throws(() => resolvePickupTime(bad), { status: 400 });
  }
});

test("rejects a time that is too soon", () => {
  assert.throws(() => resolvePickupTime(minutesFromNow(PICKUP_MIN_LEAD_MINUTES - 5)), { status: 400 });
});

test("rejects a time that is too far away", () => {
  assert.throws(() => resolvePickupTime(minutesFromNow(PICKUP_MAX_LEAD_HOURS * 60 + 30)), { status: 400 });
});

test("accepts a time inside the window and returns a Date", () => {
  const d = resolvePickupTime(minutesFromNow(60));
  assert.ok(d instanceof Date);
  const diff = (d.getTime() - Date.now()) / 60000;
  assert.ok(diff > 50 && diff < 70, `unexpected lead time ${diff}`);
});
