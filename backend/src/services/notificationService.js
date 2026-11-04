// CampusDine Service: In-App & Socket Notification Broadcaster
const NotificationService = {
  // Broadcast real-time socket events
  broadcast(io, eventName, payload) {
    if (!io) return;
    try {
      io.emit(eventName, payload);
    } catch (e) {
      console.warn("NotificationService.broadcast error:", e.message);
    }
  },

  // Notify specific user room
  notifyUser(io, userId, title, message, data = {}) {
    if (!io) return;
    try {
      io.to("user_" + userId).emit("notification", {
        title,
        message,
        timestamp: new Date().toISOString(),
        ...data
      });
    } catch (e) {
      console.warn("NotificationService.notifyUser error:", e.message);
    }
  },

  // Notify kitchen display on new order
  notifyKitchen(io, order) {
    if (!io) return;
    try {
      io.emit("kds:new-order", order);
    } catch (e) {
      console.warn("NotificationService.notifyKitchen error:", e.message);
    }
  }
};

module.exports = NotificationService;
