// CampusDine Route: User UI Preferences API
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const uiPreferencesController = require("../controllers/uiPreferencesController");

router.get("/", verifyToken, uiPreferencesController.getPreferences);
router.put("/", verifyToken, uiPreferencesController.updatePreferences);
router.post("/reset", verifyToken, uiPreferencesController.resetPreferences);

module.exports = router;
