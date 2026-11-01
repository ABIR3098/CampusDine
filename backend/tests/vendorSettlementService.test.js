const test = require("node:test");
const assert = require("node:assert/strict");
const VendorSettlementService = require("../src/services/vendorSettlementService");

test("VendorSettlementService.reconcileVendorOrders calculates commission, withholding and net payout", () => {
  const sampleOrders = [
    { id: 1, total_amount: 1000, status: "completed" },
    { id: 2, total_amount: 2000, status: "delivered" },
    { id: 3, total_amount: 500, status: "cancelled" }
  ];

  const stmt = VendorSettlementService.reconcileVendorOrders("canteen-central", sampleOrders);

  assert.equal(stmt.vendorName, "Central Canteen");
  assert.equal(stmt.completedOrders, 2);
  assert.equal(stmt.financials.grossSales, 3000); // 1000 + 2000
  assert.equal(stmt.financials.commissionAmount, 150); // 5% of 3000
  assert.equal(stmt.financials.taxDeducted, 60); // 2% of 3000
  assert.equal(stmt.financials.netPayout, 2790); // 3000 - 150 - 60
  assert.equal(stmt.status, "CALCULATED");
});

test("VendorSettlementService.reconcileVendorOrders throws on unknown vendor ID", () => {
  assert.throws(() => {
    VendorSettlementService.reconcileVendorOrders("non-existent-vendor", []);
  }, /Unknown vendor ID/);
});

test("VendorSettlementService.disbursePayout transitions to DISBURSED state", () => {
  const stmt = {
    settlementId: "SETTL-101",
    status: "CALCULATED",
    financials: { netPayout: 5000 }
  };

  const disbursed = VendorSettlementService.disbursePayout(stmt, "TRX-REF-789");
  assert.equal(disbursed.status, "DISBURSED");
  assert.equal(disbursed.disbursementReference, "TRX-REF-789");
  assert.ok(disbursed.disbursedAt);
});
