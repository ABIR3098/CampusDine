// CampusDine Controller: notificationController
const NotificationHistoryService = require("../services/notificationHistoryService");

const notificationController = {
  getUserNotifications: (req, res) => {
    const userId = req.user ? req.user.id : "guest";
    const notifications = NotificationHistoryService.getForUser(userId);
    const unreadCount = NotificationHistoryService.getUnreadCount(userId);

    return res.json({
      notifications,
      unreadCount
    });
  },

  markAsRead: (req, res) => {
    const userId = req.user ? req.user.id : "guest";
    const notificationId = req.params.id;
    const updated = NotificationHistoryService.markAsRead(userId, notificationId);

    if (!updated) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json({ success: true, notification: updated });
  },

  markAllAsRead: (req, res) => {
    const userId = req.user ? req.user.id : "guest";
    const count = NotificationHistoryService.markAllAsRead(userId);

    return res.json({ success: true, markedCount: count });
  }
};

module.exports = notificationController;
