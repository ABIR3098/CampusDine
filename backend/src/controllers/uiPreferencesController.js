// CampusDine Controller: uiPreferencesController
const UIPreferencesService = require("../services/uiPreferencesService");

const uiPreferencesController = {
  getPreferences: (req, res) => {
    const userId = req.user ? req.user.id : "guest";
    const preferences = UIPreferencesService.getPreferences(userId);
    return res.json({ success: true, preferences });
  },

  updatePreferences: (req, res) => {
    const userId = req.user ? req.user.id : "guest";
    try {
      const updated = UIPreferencesService.updatePreferences(userId, req.body || {});
      return res.json({ success: true, preferences: updated });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  },

  resetPreferences: (req, res) => {
    const userId = req.user ? req.user.id : "guest";
    const reset = UIPreferencesService.resetPreferences(userId);
    return res.json({ success: true, preferences: reset });
  }
};

module.exports = uiPreferencesController;
