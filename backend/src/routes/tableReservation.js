// CampusDine Route: Table Reservation & QR Dine-in API
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const tableController = require("../controllers/tableController");

router.get("/status", tableController.getSeatingOverview);
router.get("/verify-qr/:token", tableController.verifyTableQr);
router.post("/reserve", verifyToken, tableController.bookTable);

module.exports = router;
