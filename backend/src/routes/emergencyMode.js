// CampusDine Route: Emergency Operations & Campus Alert API
const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const emergencyController = require("../controllers/emergencyController");

router.get("/status", emergencyController.getStatus);
router.post("/set-mode", verifyToken, requireRole("admin"), emergencyController.updateEmergencyMode);

module.exports = router;
