// CampusDine Controller: Campus Rider & Delivery Dispatch
const pool = require("../db");

const RiderController = {
  // Get orders assigned to active rider
  async getAssignedOrders(req, res) {
    try {
      const riderId = req.user.id;
      const [orders] = await pool.query(
        "SELECT id, token, status, total_amount, pickup_time, note FROM orders WHERE rider_id = ? AND status IN ('Assigned', 'Picked Up')",
        [riderId]
      ).catch(() => [[]]);

      return res.json(orders);
    } catch (error) {
      console.error("RiderController.getAssignedOrders error:", error);
      return res.status(500).json({ error: "Failed to retrieve rider assignments" });
    }
  },

  // Auto-assign pending orders to available riders
  async assignPendingOrders(req, res) {
    try {
      const [riders] = await pool.query("SELECT id FROM users WHERE role = 'rider' LIMIT 5").catch(() => [[]]);
      if (riders.length === 0) {
        return res.json({ count: 0, message: "No active campus riders available" });
      }

      const [pending] = await pool.query("SELECT id FROM orders WHERE status = 'Ready' AND rider_id IS NULL LIMIT 5").catch(() => [[]]);
      let assignedCount = 0;

      for (let i = 0; i < pending.length; i++) {
        const rider = riders[i % riders.length];
        await pool.query("UPDATE orders SET rider_id = ?, status = 'Assigned' WHERE id = ?", [rider.id, pending[i].id]).catch(() => {});
        assignedCount++;
      }

      return res.json({ count: assignedCount, message: assignedCount + " order(s) assigned to campus riders" });
    } catch (error) {
      console.error("RiderController.assignPendingOrders error:", error);
      return res.status(500).json({ error: "Failed to assign orders" });
    }
  }
};

module.exports = RiderController;
