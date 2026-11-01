// CampusDine Route: Hall Room Maintenance Tickets API
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const HallController = require("../controllers/hallController");

// Submit room repair request with photo proof
router.post("/requests", auth, HallController.submitMaintenance);

module.exports = router;
