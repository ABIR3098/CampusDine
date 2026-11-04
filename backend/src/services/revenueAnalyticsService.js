// CampusDine Service: RevenueAnalyticsService
// Aggregates sales metrics, peak dining distributions, and top selling items

class RevenueAnalyticsService {
  /**
   * Computes financial overview from a list of completed orders
   * @param {Array<Object>} orders
   * @returns {Object} overview metrics
   */
  static computeSummary(orders = []) {
    if (!Array.isArray(orders) || orders.length === 0) {
      return {
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        completedCount: 0,
        cancelledCount: 0
      };
    }

    let totalRevenue = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    orders.forEach(order => {
      const status = (order.status || "").toLowerCase();
      if (status === "cancelled") {
        cancelledCount += 1;
        return;
      }

      const total = Number(order.total_amount || order.total || 0);
      totalRevenue += total;
      completedCount += 1;
    });

    const averageOrderValue = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;

    return {
      totalRevenue,
      totalOrders: orders.length,
      averageOrderValue,
      completedCount,
      cancelledCount
    };
  }

  /**
   * Segregates orders by campus meal times
   * @param {Array<Object>} orders
   * @returns {Object} hourly distribution counts
   */
  static computeMealTimeBreakdown(orders = []) {
    const distribution = {
      breakfast: 0, // 07:00 - 10:59
      lunch: 0,     // 11:00 - 15:59
      snacks: 0,    // 16:00 - 18:59
      dinner: 0,    // 19:00 - 22:59
      nightOwl: 0   // 23:00 - 06:59
    };

    orders.forEach(order => {
      const date = order.created_at ? new Date(order.created_at) : new Date();
      const hour = date.getHours();

      if (hour >= 7 && hour < 11) distribution.breakfast += 1;
      else if (hour >= 11 && hour < 16) distribution.lunch += 1;
      else if (hour >= 16 && hour < 19) distribution.snacks += 1;
      else if (hour >= 19 && hour < 23) distribution.dinner += 1;
      else distribution.nightOwl += 1;
    });

    return distribution;
  }

  /**
   * Identifies top N sold food items across orders
   * @param {Array<Object>} orderItems
   * @param {number} [limit=5]
   * @returns {Array<Object>} ranked items
   */
  static rankTopItems(orderItems = [], limit = 5) {
    const frequency = {};

    orderItems.forEach(item => {
      const name = item.item_name || item.name || "Unknown Item";
      const qty = Number(item.quantity || 1);
      frequency[name] = (frequency[name] || 0) + qty;
    });

    return Object.entries(frequency)
      .map(([name, quantitySold]) => ({ name, quantitySold }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, limit);
  }
}

module.exports = RevenueAnalyticsService;
