const test = require("node:test");
const assert = require("node:assert/strict");
const PurchaseOrderService = require("../src/services/purchaseOrderService");

test("PurchaseOrderService.createPurchaseOrder calculates subtotal, tax and grandTotal", () => {
  const po = PurchaseOrderService.createPurchaseOrder({
    supplierName: "Dhaka Fresh Farms",
    supplierContact: "01700000000",
    items: [
      { itemName: "Eggs (Grade A)", unit: "crate", quantity: 10, unitPrice: 320 },
      { itemName: "Onions", unit: "kg", quantity: 20, unitPrice: 80 }
    ]
  });

  assert.match(po.poNumber, /^PO-\d+-\d+$/);
  assert.equal(po.supplierName, "Dhaka Fresh Farms");
  assert.equal(po.items.length, 2);
  assert.equal(po.pricing.subtotal, 4800); // 3200 + 1600
  assert.equal(po.pricing.tax, 240); // 5% of 4800
  assert.equal(po.pricing.deliveryFee, 150); // <= 5000 so 150 fee
  assert.equal(po.pricing.grandTotal, 5190);
  assert.equal(po.status, "DRAFT");
});

test("PurchaseOrderService.transitionStatus follows valid state progression", () => {
  let status = "DRAFT";
  status = PurchaseOrderService.transitionStatus(status, "SUBMITTED");
  assert.equal(status, "SUBMITTED");

  status = PurchaseOrderService.transitionStatus(status, "APPROVED");
  assert.equal(status, "APPROVED");

  status = PurchaseOrderService.transitionStatus(status, "RECEIVED");
  assert.equal(status, "RECEIVED");

  assert.throws(() => {
    PurchaseOrderService.transitionStatus("RECEIVED", "CANCELLED");
  }, /Cannot transition purchase order from RECEIVED to CANCELLED/);
});

test("PurchaseOrderService.createPurchaseOrder throws if supplier is missing", () => {
  assert.throws(() => {
    PurchaseOrderService.createPurchaseOrder({ supplierName: "", items: [{ itemName: "Rice", unitPrice: 100 }] });
  }, /Supplier name is required/);
});
