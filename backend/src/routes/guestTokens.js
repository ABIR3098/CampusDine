// CampusDine Route: Hall Guest Meal Tokens & Passes
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const HallController = require("../controllers/hallController");

// Book guest meal token
router.post("/book", verifyToken, HallController.bookGuestToken);

// Get guest pass info
router.get("/info", verifyToken, HallController.getHallInfo);

module.exports = router;
