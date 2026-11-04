const test = require("node:test");
const assert = require("node:assert/strict");
const { publicRiderLocation } = require("../src/utils/riderLocation");

const row = { riderId: 7, name: "Rafi", external_id: "rider7", latitude: "23.8103", longitude: "90.4125", accuracy_m: "12", active: 1, updated_at: "2026-11-01T10:00:00Z" };

test("a rider who is sharing shows the position as numbers", () => {
  const r = publicRiderLocation(row);
  assert.equal(r.active, true);
  assert.equal(r.latitude, 23.8103);
  assert.equal(r.longitude, 90.4125);
  assert.equal(r.accuracy_m, 12);
  assert.equal(r.updated_at, row.updated_at);
});

test("a rider who stopped sharing shows no position and no time", () => {
  const r = publicRiderLocation({ ...row, active: 0 });
  assert.deepEqual([r.active, r.latitude, r.longitude, r.accuracy_m, r.updated_at], [false, null, null, null, null]);
  assert.equal(r.name, "Rafi");
});

test("a rider who never shared a position has nothing to show", () => {
  const r = publicRiderLocation({ riderId: 8, name: "Nila", external_id: "rider8", latitude: null, longitude: null, accuracy_m: null, active: null, updated_at: null });
  assert.equal(r.active, false);
  assert.equal(r.latitude, null);
});
