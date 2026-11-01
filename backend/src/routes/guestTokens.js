// CampusDine Route: Hall Guest Meal Tokens & Passes
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const HallController = require("../controllers/hallController");

// Book guest meal token
router.post("/book", auth, HallController.bookGuestToken);

// Get guest pass info
router.get("/info", auth, HallController.getHallInfo);

module.exports = router;
