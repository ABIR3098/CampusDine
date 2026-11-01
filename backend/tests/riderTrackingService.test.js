const test = require("node:test");
const assert = require("node:assert/strict");
const RiderTrackingService = require("../src/services/riderTrackingService");

test("RiderTrackingService.calculateDistanceMeters computes reasonable campus distance", () => {
  const dist = RiderTrackingService.calculateDistanceMeters(23.8382, 90.3582, 23.8420, 90.3620);
  assert.ok(dist > 500 && dist < 1000, `Expected distance between 500m and 1000m, got ${dist}`);
});

test("RiderTrackingService.calculateDistanceMeters returns 0 for identical points", () => {
  const dist = RiderTrackingService.calculateDistanceMeters(23.8382, 90.3582, 23.8382, 90.3582);
  assert.equal(dist, 0);
});

test("RiderTrackingService.calculateETA returns minimum 1 minute with buffer", () => {
  const eta = RiderTrackingService.calculateETA(300);
  assert.ok(eta.estimatedMinutes >= 1);
  assert.equal(typeof eta.text, "string");
  assert.match(eta.text, /mins/);
});

test("RiderTrackingService.interpolatePosition returns accurate start at 0%", () => {
  const pos = RiderTrackingService.interpolatePosition("canteen", "hall_boys", 0);
  assert.equal(pos.currentLat, RiderTrackingService.CAMPUS_WAYPOINTS.canteen.lat);
  assert.equal(pos.currentLng, RiderTrackingService.CAMPUS_WAYPOINTS.canteen.lng);
});

test("RiderTrackingService.interpolatePosition returns accurate midpoint at 50%", () => {
  const pos = RiderTrackingService.interpolatePosition("canteen", "hall_boys", 50);
  const midLat = (RiderTrackingService.CAMPUS_WAYPOINTS.canteen.lat + RiderTrackingService.CAMPUS_WAYPOINTS.hall_boys.lat) / 2;
  assert.equal(pos.currentLat, Number(midLat.toFixed(6)));
  assert.equal(pos.progress, 50);
});
