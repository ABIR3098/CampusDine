// CampusDine Service: In-App Notification Center & Unread Count Management
const notificationsStore = new Map(); // userId -> Array of notification objects

const NotificationHistoryService = {
  // Push notification into user history
  addNotification(userId, { title, message, category = "order", metadata = {} }) {
    if (!userId) return null;
    const uid = String(userId);
    if (!notificationsStore.has(uid)) {
      notificationsStore.set(uid, []);
    }

    const notif = {
      id: "ntf_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      title,
      message,
      category,
      metadata,
      read: false,
      createdAt: new Date().toISOString()
    };

    const userNotifs = notificationsStore.get(uid);
    userNotifs.unshift(notif);
    // Keep max 50 recent notifications
    if (userNotifs.length > 50) userNotifs.pop();

    return notif;
  },

  // Get user notifications with optional category filter
  getUserNotifications(userId, category = null) {
    const uid = String(userId);
    const list = notificationsStore.get(uid) || [];
    if (!category || category === "all") return list;
    return list.filter((n) => n.category === category);
  },

  // Get unread count
  getUnreadCount(userId) {
    const uid = String(userId);
    const list = notificationsStore.get(uid) || [];
    return list.filter((n) => !n.read).length;
  },

  // Mark specific notification as read
  markAsRead(userId, notificationId) {
    const uid = String(userId);
    const list = notificationsStore.get(uid) || [];
    const item = list.find((n) => n.id === notificationId);
    if (item) item.read = true;
    return item;
  },

  // Mark all user notifications as read
  markAllAsRead(userId) {
    const uid = String(userId);
    const list = notificationsStore.get(uid) || [];
    list.forEach((n) => (n.read = true));
    return list.length;
  }
};

module.exports = NotificationHistoryService;
