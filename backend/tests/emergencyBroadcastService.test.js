const test = require("node:test");
const assert = require("node:assert/strict");
const EmergencyBroadcastService = require("../src/services/emergencyBroadcastService");

test("EmergencyBroadcastService.getStatus returns default normal state", () => {
  const status = EmergencyBroadcastService.getStatus();
  assert.equal(typeof status.mode, "string");
  assert.equal(typeof status.isActive, "boolean");
});

test("EmergencyBroadcastService.setEmergencyState updates mode and active flag", () => {
  const updated = EmergencyBroadcastService.setEmergencyState({
    mode: "SEVERE_WEATHER",
    headline: "Heavy Monsoon Inundation Alert",
    instructions: "Outdoor deliveries suspended. Canteen dining hall open.",
    severity: "WARNING",
    adminId: "ADMIN-01"
  });

  assert.equal(updated.mode, "SEVERE_WEATHER");
  assert.equal(updated.isActive, true);
  assert.equal(updated.severity, "WARNING");
  assert.equal(EmergencyBroadcastService.isDeliveryAllowed(), false);

  // Restore to normal
  EmergencyBroadcastService.setEmergencyState({ mode: "NORMAL" });
  assert.equal(EmergencyBroadcastService.isDeliveryAllowed(), true);
});

test("EmergencyBroadcastService.setEmergencyState throws on unknown mode", () => {
  assert.throws(() => {
    EmergencyBroadcastService.setEmergencyState({ mode: "ALIEN_INVASION" });
  }, /Invalid emergency mode/);
});
