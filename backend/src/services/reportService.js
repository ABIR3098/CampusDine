// CampusDine Service: Sales Analytics & Canteen Financial Reporting
const pool = require("../db");

const ReportService = {
  // Aggregate daily revenue and order counts
  async getDailySalesReport(date = new Date().toISOString().slice(0, 10)) {
    try {
      const [rows] = await pool.query(
        "SELECT COUNT(*) as totalOrders, COALESCE(SUM(total_amount), 0) as totalRevenue, " +
        "SUM(CASE WHEN payment_method = 'wallet' THEN total_amount ELSE 0 END) as walletRevenue, " +
        "SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END) as cashRevenue " +
        "FROM orders WHERE DATE(created_at) = ? AND status != 'Cancelled'",
        [date]
      );
      return rows[0] || { totalOrders: 0, totalRevenue: 0, walletRevenue: 0, cashRevenue: 0 };
    } catch (e) {
      console.error("ReportService.getDailySalesReport error:", e);
      return { totalOrders: 0, totalRevenue: 0, walletRevenue: 0, cashRevenue: 0 };
    }
  },

  // Calculate top selling dishes of the week
  async getTopSellingItems(limit = 5) {
    try {
      const [rows] = await pool.query(
        "SELECT item_name as name, SUM(quantity) as totalQty, SUM(quantity * price) as revenue " +
        "FROM order_items " +
        "GROUP BY item_name " +
        "ORDER BY totalQty DESC LIMIT ?",
        [limit]
      );
      return rows;
    } catch (e) {
      console.error("ReportService.getTopSellingItems error:", e);
      return [];
    }
  }
};

module.exports = ReportService;
