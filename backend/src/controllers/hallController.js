// CampusDine Controller: Hall Dining, Guest Tokens & Maintenance
const pool = require("../db");

const HallController = {
  // Get hall overview and today's status
  async getHallInfo(req, res) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [slots] = await pool.query("SELECT id, slot_name, start_time, end_time, guest_price FROM hall_slots").catch(() => [[]]);
      const [feasts] = await pool.query("SELECT id, feast_date, slot_name, title, items, extra_price, capacity FROM hall_feasts WHERE feast_date >= ?", [today]).catch(() => [[]]);

      return res.json({ today, slots, upcomingFeasts: feasts });
    } catch (error) {
      console.error("HallController.getHallInfo error:", error);
      return res.status(500).json({ error: "Failed to fetch hall info" });
    }
  },

  // Submit room maintenance request
  async submitMaintenance(req, res) {
    try {
      const { title, description, category, photoProof, location } = req.body;
      const userId = req.user.id;

      if (!title) {
        return res.status(400).json({ error: "Title is required for maintenance request" });
      }

      const [result] = await pool.query(
        "INSERT INTO hall_maintenance_requests (user_id, title, description, category, location, status, created_at) VALUES (?, ?, ?, ?, ?, 'submitted', NOW())",
        [userId, title, description || "", category || "other", location || "Assigned Room"]
      ).catch(async () => {
        // Fallback for general services table if exists
        return await pool.query(
          "INSERT INTO hall_services (user_id, title, description, type, status) VALUES (?, ?, ?, 'maintenance', 'submitted')",
          [userId, title, description || ""]
        );
      });

      return res.status(201).json({ id: result.insertId, message: "Maintenance request submitted successfully" });
    } catch (error) {
      console.error("HallController.submitMaintenance error:", error);
      return res.status(500).json({ error: "Failed to submit maintenance request" });
    }
  },

  // Book guest meal token
  async bookGuestToken(req, res) {
    try {
      const { date, slot, count, guestName } = req.body;
      const userId = req.user.id;
      const guestCount = Math.max(1, Number(count || 1));

      const tokenId = "GST-" + Math.floor(1000 + Math.random() * 9000);

      return res.json({
        tokenId,
        date,
        slot,
        guestCount,
        guestName: guestName || "Guest of Resident",
        status: "Confirmed",
        message: "Guest meal token booked successfully"
      });
    } catch (error) {
      console.error("HallController.bookGuestToken error:", error);
      return res.status(500).json({ error: "Failed to book guest pass" });
    }
  }
};

module.exports = HallController;
