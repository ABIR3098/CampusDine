// CampusDine Controller: emergencyController
const EmergencyBroadcastService = require("../services/emergencyBroadcastService");

const emergencyController = {
  getStatus: (req, res) => {
    return res.json(EmergencyBroadcastService.getStatus());
  },

  updateEmergencyMode: (req, res) => {
    try {
      const { mode, headline, instructions, severity } = req.body;
      const adminId = req.user ? req.user.id : "admin";

      const updated = EmergencyBroadcastService.setEmergencyState({
        mode,
        headline,
        instructions,
        severity,
        adminId
      });

      return res.json({
        success: true,
        message: `Emergency status updated to ${mode}`,
        emergencyState: updated
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
};

module.exports = emergencyController;
