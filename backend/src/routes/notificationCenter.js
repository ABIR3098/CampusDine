// CampusDine Route: Notification Center API
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const notificationController = require("../controllers/notificationController");

router.get("/", verifyToken, notificationController.getUserNotifications);
router.patch("/:id/read", verifyToken, notificationController.markAsRead);
router.post("/read-all", verifyToken, notificationController.markAllAsRead);

module.exports = router;
