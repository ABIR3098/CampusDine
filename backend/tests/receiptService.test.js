const test = require("node:test");
const assert = require("node:assert/strict");
const ReceiptService = require("../src/services/receiptService");

test("ReceiptService.generateReceiptSignature returns deterministic 12-char hex string", () => {
  const sig1 = ReceiptService.generateReceiptSignature("T-1234", 150, "2026-11-01T10:00:00Z");
  const sig2 = ReceiptService.generateReceiptSignature("T-1234", 150, "2026-11-01T10:00:00Z");
  assert.equal(sig1.length, 12);
  assert.equal(sig1, sig2);
});

test("ReceiptService.generateReceiptSignature changes when total amount changes", () => {
  const sig1 = ReceiptService.generateReceiptSignature("T-1234", 150, "2026-11-01T10:00:00Z");
  const sig2 = ReceiptService.generateReceiptSignature("T-1234", 180, "2026-11-01T10:00:00Z");
  assert.notEqual(sig1, sig2);
});

test("ReceiptService.formatThermalAscii formats receipt containing token and total", () => {
  const order = {
    token: "T-8899",
    total: 210,
    created_at: new Date().toISOString(),
    items: [{ name: "Beef Burger", qty: 1, price: 180 }, { name: "Coke", qty: 1, price: 30 }]
  };
  const slip = ReceiptService.formatThermalAscii(order);
  assert.match(slip, /CAMPUSDINE EXPRESS/);
  assert.match(slip, /TOKEN: T-8899/);
  assert.match(slip, /TOTAL PAID: Tk 210/);
});
