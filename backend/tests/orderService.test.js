const test = require("node:test");
const assert = require("node:assert/strict");
const OrderService = require("../src/services/orderService");

test("OrderService.calculateOrderTotals sums item totals correctly", () => {
  const items = [
    { name: "Chicken Biryani", price: 150, qty: 2 },
    { name: "Borhani", price: 30, qty: 1 }
  ];
  const result = OrderService.calculateOrderTotals(items);
  assert.equal(result.subtotal, 330);
  assert.equal(result.discount, 0);
  assert.equal(result.total, 330);
});

test("OrderService.calculateOrderTotals applies percentage coupon correctly", () => {
  const items = [{ name: "Khichuri", price: 100, qty: 2 }];
  const coupon = { discountType: "PERCENTAGE", discountValue: 10 };
  const result = OrderService.calculateOrderTotals(items, coupon);
  assert.equal(result.subtotal, 200);
  assert.equal(result.discount, 20);
  assert.equal(result.total, 180);
});

test("OrderService.calculateOrderTotals applies fixed discount coupon", () => {
  const items = [{ name: "Egg Noodles", price: 80, qty: 1 }];
  const coupon = { discountType: "FIXED", discountValue: 15 };
  const result = OrderService.calculateOrderTotals(items, coupon);
  assert.equal(result.discount, 15);
  assert.equal(result.total, 65);
});

test("OrderService.calculateOrderTotals applies BYOB eco discount (-5 Tk)", () => {
  const items = [{ name: "Meal Box", price: 120, qty: 1 }];
  const result = OrderService.calculateOrderTotals(items, null, true);
  assert.equal(result.ecoDiscount, 5);
  assert.equal(result.total, 115);
});

test("OrderService.calculateOrderTotals never returns negative total", () => {
  const items = [{ name: "Chai", price: 10, qty: 1 }];
  const coupon = { discountType: "FIXED", discountValue: 50 };
  const result = OrderService.calculateOrderTotals(items, coupon, true);
  assert.equal(result.total, 0);
});
