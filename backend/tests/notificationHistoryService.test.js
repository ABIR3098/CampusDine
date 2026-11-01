const test = require("node:test");
const assert = require("node:assert/strict");
const NotificationHistoryService = require("../src/services/notificationHistoryService");

test("NotificationHistoryService.addNotification stores notification with unread status", () => {
  const notif = NotificationHistoryService.addNotification("u100", {
    title: "Order Cooking",
    message: "Your Biryani is being prepared in kitchen",
    category: "order"
  });
  assert.equal(notif.title, "Order Cooking");
  assert.equal(notif.read, false);
  assert.equal(NotificationHistoryService.getUnreadCount("u100"), 1);
});

test("NotificationHistoryService.getUserNotifications filters by category", () => {
  NotificationHistoryService.addNotification("u100", { title: "Hall Feast", message: "Special feast Friday", category: "hall" });
  NotificationHistoryService.addNotification("u100", { title: "10% Promo", message: "Flash coupon active", category: "promo" });

  const hallOnly = NotificationHistoryService.getUserNotifications("u100", "hall");
  const promoOnly = NotificationHistoryService.getUserNotifications("u100", "promo");

  assert.equal(hallOnly.length, 1);
  assert.equal(hallOnly[0].category, "hall");
  assert.equal(promoOnly.length, 1);
});

test("NotificationHistoryService.markAsRead updates read flag and decreases unread count", () => {
  const notifs = NotificationHistoryService.getUserNotifications("u100");
  const firstId = notifs[0].id;

  NotificationHistoryService.markAsRead("u100", firstId);
  const updated = NotificationHistoryService.getUserNotifications("u100").find((n) => n.id === firstId);
  assert.equal(updated.read, true);
});

test("NotificationHistoryService.markAllAsRead clears unread count to 0", () => {
  NotificationHistoryService.markAllAsRead("u100");
  assert.equal(NotificationHistoryService.getUnreadCount("u100"), 0);
});
