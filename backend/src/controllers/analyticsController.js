// CampusDine Controller: analyticsController
const RevenueAnalyticsService = require("../services/revenueAnalyticsService");

const analyticsController = {
  getOverview: (req, res) => {
    // Mock sample dataset representing today's canteen transactions
    const mockOrders = [
      { id: 101, total_amount: 220, status: "completed", created_at: "2026-11-01T12:30:00Z" },
      { id: 102, total_amount: 180, status: "completed", created_at: "2026-11-01T13:15:00Z" },
      { id: 103, total_amount: 320, status: "completed", created_at: "2026-11-01T14:00:00Z" },
      { id: 104, total_amount: 90, status: "completed", created_at: "2026-11-01T17:20:00Z" },
      { id: 105, total_amount: 450, status: "cancelled", created_at: "2026-11-01T18:00:00Z" },
      { id: 106, total_amount: 280, status: "completed", created_at: "2026-11-01T20:10:00Z" }
    ];

    const mockItems = [
      { name: "Chicken Biryani", quantity: 42 },
      { name: "Egg Khichuri", quantity: 38 },
      { name: "Singara & Tea Combo", quantity: 75 },
      { name: "Beef Tehari", quantity: 29 },
      { name: "Lacchi", quantity: 51 }
    ];

    const summary = RevenueAnalyticsService.computeSummary(mockOrders);
    const mealBreakdown = RevenueAnalyticsService.computeMealTimeBreakdown(mockOrders);
    const topItems = RevenueAnalyticsService.rankTopItems(mockItems, 5);

    return res.json({
      summary,
      mealBreakdown,
      topItems
    });
  }
};

module.exports = analyticsController;
