const test = require("node:test");
const assert = require("node:assert/strict");
const RevenueAnalyticsService = require("../src/services/revenueAnalyticsService");

test("RevenueAnalyticsService.computeSummary calculates total revenue and average correctly", () => {
  const orders = [
    { id: 1, total_amount: 350, status: "completed" },
    { id: 2, total_amount: 150, status: "delivered" },
    { id: 3, total_amount: 500, status: "cancelled" }
  ];

  const summary = RevenueAnalyticsService.computeSummary(orders);
  assert.equal(summary.totalOrders, 3);
  assert.equal(summary.completedCount, 2);
  assert.equal(summary.cancelledCount, 1);
  assert.equal(summary.totalRevenue, 500); // 350 + 150
  assert.equal(summary.averageOrderValue, 250); // 500 / 2
});

test("RevenueAnalyticsService.computeSummary handles empty order list", () => {
  const summary = RevenueAnalyticsService.computeSummary([]);
  assert.equal(summary.totalRevenue, 0);
  assert.equal(summary.averageOrderValue, 0);
});

test("RevenueAnalyticsService.rankTopItems sorts items by popularity", () => {
  const items = [
    { name: "Kacchi Biryani", quantity: 5 },
    { name: "Chicken Khichuri", quantity: 3 },
    { name: "Kacchi Biryani", quantity: 4 },
    { name: "Borhani", quantity: 8 }
  ];

  const ranked = RevenueAnalyticsService.rankTopItems(items, 2);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].name, "Kacchi Biryani");
  assert.equal(ranked[0].quantitySold, 9);
  assert.equal(ranked[1].name, "Borhani");
  assert.equal(ranked[1].quantitySold, 8);
});
