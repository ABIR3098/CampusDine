// CampusDine Route: Kitchen Display System (KDS) API
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const roleGuard = require("../middleware/roleGuard");
const KDSController = require("../controllers/kdsController");

// Get active kitchen queue (Admin & Staff)
router.get("/queue", auth, roleGuard("admin", "staff"), KDSController.getLiveKitchenQueue);

// Mark order ready
router.patch("/orders/:id/ready", auth, roleGuard("admin", "staff"), KDSController.markOrderReady);

module.exports = router;
