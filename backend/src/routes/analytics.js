// CampusDine Route: Analytics API
const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const analyticsController = require("../controllers/analyticsController");

router.get("/overview", verifyToken, requireRole("admin", "staff"), analyticsController.getOverview);

module.exports = router;
