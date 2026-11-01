// CampusDine Route: Live Rider GPS Map Tracking API
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const RiderTrackingService = require("../services/riderTrackingService");

// Get live tracking coordinates and ETA for an active order
router.get("/orders/:id/live-location", verifyToken, (req, res) => {
  const orderId = Number(req.params.id);
  // Simulate active delivery progress based on order timestamp or random seed
  const progress = Math.min(95, Math.max(15, (Date.now() / 3000) % 90));
  const location = RiderTrackingService.interpolatePosition("canteen", "hall_boys", progress);

  return res.json({
    orderId,
    rider: {
      name: "Tariqul Islam",
      phone: "+880 1712-345678",
      vehicle: "Bicycle (Fleet #04)",
      rating: 4.9
    },
    origin: RiderTrackingService.CAMPUS_WAYPOINTS.canteen,
    destination: RiderTrackingService.CAMPUS_WAYPOINTS.hall_boys,
    currentLocation: location,
    waypoints: RiderTrackingService.CAMPUS_WAYPOINTS
  });
});

module.exports = router;
