const test = require("node:test");
const assert = require("node:assert/strict");
const KDSService = require("../src/services/kdsService");

test("KDSService.calculateElapsedMinutes measures elapsed minutes properly", () => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const elapsed = KDSService.calculateElapsedMinutes(tenMinutesAgo);
  assert.equal(elapsed, 10);
});

test("KDSService.calculateElapsedMinutes handles empty timestamp safely", () => {
  assert.equal(KDSService.calculateElapsedMinutes(null), 0);
  assert.equal(KDSService.calculateElapsedMinutes(undefined), 0);
});

test("KDSService.getUrgencyLevel returns normal for under 12 min", () => {
  const urgency = KDSService.getUrgencyLevel(8);
  assert.equal(urgency.level, "normal");
  assert.equal(urgency.color, "emerald");
});

test("KDSService.getUrgencyLevel returns warning for 12 to 19 min", () => {
  const urgency = KDSService.getUrgencyLevel(15);
  assert.equal(urgency.level, "warning");
  assert.equal(urgency.color, "amber");
});

test("KDSService.getUrgencyLevel returns critical for 20+ min", () => {
  const urgency = KDSService.getUrgencyLevel(25);
  assert.equal(urgency.level, "critical");
  assert.equal(urgency.color, "rose");
});

test("KDSService.groupItemsByStation categorizes food items correctly", () => {
  const items = [
    { name: "Cold Brew Coffee", qty: 1 },
    { name: "Egg Toast", qty: 2 },
    { name: "French Fries", qty: 1 },
    { name: "Chicken Biryani", qty: 1 }
  ];
  const stations = KDSService.groupItemsByStation(items);
  assert.equal(stations.beverages.length, 1);
  assert.equal(stations.grill.length, 1);
  assert.equal(stations.fryer.length, 1);
  assert.equal(stations.general.length, 1);
});
