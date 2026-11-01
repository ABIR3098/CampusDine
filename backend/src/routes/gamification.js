// CampusDine Route: Gamification, Daily Lucky Spin & Eco Badges
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const CouponController = require("../controllers/couponController");

// Claim daily spin wheel reward
router.post("/spin/claim", verifyToken, CouponController.claimDailySpin);

// Get leaderboard top rankings
router.get("/leaderboard", verifyToken, (req, res) => {
  res.json([
    { rank: 1, name: "Tanvir Ahmed", badge: "Green Eco Hero", points: 1420, orders: 48 },
    { rank: 2, name: "Afsana Mimi", badge: "Zero Waste Star", points: 1280, orders: 42 },
    { rank: 3, name: "Sakib Al Hasan", badge: "BYOB Champion", points: 1150, orders: 39 },
    { rank: 4, name: "Rahim Uddin", badge: "Eco Resident", points: 940, orders: 31 },
    { rank: 5, name: req.user.name || "You", badge: "Green Supporter", points: 720, orders: 24, isCurrent: true }
  ]);
});

module.exports = router;
