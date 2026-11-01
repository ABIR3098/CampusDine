// CampusDine Route: Food Waste Challenge & Green Campus API
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");

// In-memory campus-wide stats for sustainability pledge
let campusWasteStats = {
  totalMealsCleaned: 1420,
  foodSavedKg: 284.5,
  carbonOffsetKg: 711.2,
  activePledgers: 382
};

// Get campus impact summary
router.get("/summary", (req, res) => {
  return res.json(campusWasteStats);
});

// Submit zero waste pledge
router.post("/pledge", verifyToken, (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.body;

  campusWasteStats.totalMealsCleaned += 1;
  campusWasteStats.foodSavedKg = Math.round((campusWasteStats.foodSavedKg + 0.25) * 10) / 10;
  campusWasteStats.carbonOffsetKg = Math.round((campusWasteStats.carbonOffsetKg + 0.6) * 10) / 10;

  return res.json({
    success: true,
    message: "Thank you for joining the Campus Clean Plate Club!",
    earnedPoints: 15,
    streakDays: 4,
    orderId,
    campusStats: campusWasteStats
  });
});

module.exports = router;
