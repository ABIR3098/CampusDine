// CampusDine Controller: Hall Dining Info & Maintenance
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

      // Real table is hall_requests (created in src/hall/extraSchema.js).
      // It has no category/photo columns, so category is kept in the description.
      const cat = String(category || "other").slice(0, 40);
      const fullDescription = "[" + cat + "] " + String(description || "");
      const [result] = await pool.query(
        "INSERT INTO hall_requests (user_id, type, title, description, location, status) VALUES (?, 'maintenance', ?, ?, ?, 'submitted')",
        [userId, String(title).slice(0, 180), fullDescription, String(location || "Assigned Room").slice(0, 180)]
      );

      return res.status(201).json({ id: result.insertId, message: "Maintenance request submitted successfully" });
    } catch (error) {
      console.error("HallController.submitMaintenance error:", error);
      return res.status(500).json({ error: "Failed to submit maintenance request" });
    }
  },
};

module.exports = HallController;
