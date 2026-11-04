// CampusDine Controller: Kitchen Display System (KDS) Live Operations
const pool = require("../db");

const KDSController = {
  // Get live kitchen order queue
  async getLiveKitchenQueue(req, res) {
    try {
      const [orders] = await pool.query(
        "SELECT o.id, o.token, o.status, o.created_at, o.pickup_time, o.note, o.total " +
        "FROM orders o " +
        "WHERE o.status IN ('Received', 'Cooking') " +
        "ORDER BY o.id ASC"
      );

      // Fetch items for these orders
      for (const order of orders) {
        const [items] = await pool.query(
          "SELECT name, qty, price FROM order_items WHERE order_id = ?",
          [order.id]
        );
        order.items = items;
      }

      return res.json(orders);
    } catch (error) {
      console.error("KDSController.getLiveKitchenQueue error:", error);
      return res.status(500).json({ error: "Failed to retrieve kitchen display queue" });
    }
  },

  // Mark order ready and notify customer
  async markOrderReady(req, res) {
    try {
      const { id } = req.params;
      const [result] = await pool.query(
        "UPDATE orders SET status = 'Ready' WHERE id = ? AND status IN ('Received', 'Cooking')",
        [id]
      );
      if (!result.affectedRows) {
        return res.status(404).json({ error: "Order not found or already ready/cancelled" });
      }
      return res.json({ id, status: "Ready", message: "Order marked ready for pickup" });
    } catch (error) {
      console.error("KDSController.markOrderReady error:", error);
      return res.status(500).json({ error: "Failed to update order status" });
    }
  }
};

module.exports = KDSController;
