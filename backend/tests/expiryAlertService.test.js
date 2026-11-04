const test = require("node:test");
const assert = require("node:assert/strict");
const ExpiryAlertService = require("../src/services/expiryAlertService");

test("ExpiryAlertService.evaluateBatches categorizes expired and near-expiry items accurately", () => {
  const refDate = new Date("2026-11-01T12:00:00Z");
  const sampleBatches = [
    { id: "B1", name: "Fresh Milk", expiryDate: "2026-10-31T12:00:00Z", quantity: 10, unit: "L" }, // Expired
    { id: "B2", name: "Chicken Breast", expiryDate: "2026-11-03T12:00:00Z", quantity: 25, unit: "kg" }, // 2 days -> Critical
    { id: "B3", name: "Cheddar Cheese", expiryDate: "2026-11-06T12:00:00Z", quantity: 5, unit: "kg" }, // 5 days -> Warning
    { id: "B4", name: "Basmati Rice", expiryDate: "2026-12-01T12:00:00Z", quantity: 100, unit: "kg" } // 30 days -> Fresh
  ];

  const result = ExpiryAlertService.evaluateBatches(sampleBatches, refDate);

  assert.equal(result.totalItems, 4);
  assert.equal(result.expiredCount, 1);
  assert.equal(result.criticalCount, 1);
  assert.equal(result.warningCount, 1);
  assert.equal(result.freshCount, 1);
  assert.equal(result.requiresImmediateAction, true);
  assert.equal(result.details.expired[0].name, "Fresh Milk");
  assert.equal(result.details.critical[0].name, "Chicken Breast");
});

test("ExpiryAlertService.evaluateBatches handles empty batch list gracefully", () => {
  const result = ExpiryAlertService.evaluateBatches([]);
  assert.equal(result.totalItems, 0);
  assert.equal(result.requiresImmediateAction, false);
});
