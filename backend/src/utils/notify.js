const pool = require("../db");

// Swap the body for Twilio / SSL Wireless / etc. when you have credentials.
async function sendSMS(phone, message) {
  console.log(`[SMS stub] to ${phone}: ${message}`);
  return true;
}

const MESSAGES = {
  Received: (id) => `Order #${id} received. We'll start cooking soon.`,
  Confirmed: (id) => `Order #${id} payment confirmed.`,
  Cooking: (id) => `Order #${id} is being cooked now.`,
  Ready: (id) => `Order #${id} is READY for pickup!`,
  Cancelled: (id) => `Order #${id} was cancelled.`,
  Collected: (id) => `Order #${id} collected. Enjoy your meal!`,
  Refunded: (id) => `Order #${id} was cancelled and refunded to your wallet.`,
};

// Saves an in-app notification, pushes it live over the socket, and texts the
// user if they opted in. Never throws: a notification failure must not fail an order.
async function notifyUser(app, userId, orderId, status, extra = "") {
  try {
    const message = (MESSAGES[status] ? MESSAGES[status](orderId) : `Order #${orderId} status: ${status}`) + (extra ? ` ${extra}` : "");
    const [r] = await pool.query("INSERT INTO notification_log (user_id, order_id, notification_type, status, message) VALUES (?, ?, 'order', ?, ?)", [userId, orderId, status, message]);
    const payload = { id: r.insertId, order_id: orderId, status, message, sent_at: new Date().toISOString(), read: false };
    app.get("io")?.to(`user:${userId}`).emit("notification", payload);
    const [[u]] = await pool.query("SELECT phone, notifications_enabled FROM users WHERE id = ?", [userId]);
    if (u?.notifications_enabled && u.phone) await sendSMS(u.phone, `CampusDine: ${message}`);
  } catch (err) {
    console.error("notifyUser failed:", err.message);
  }
}

module.exports = { notifyUser, sendSMS };

// Who should hear about an order's status: the owner, every member of a group order, and
// (on cancellation/refund) whoever paid for a treat.
async function partyIds(order, status) {
  const ids = new Set([order.user_id]);
  const [shares] = await pool.query("SELECT user_id FROM order_shares WHERE order_id = ?", [order.id]);
  if (order.kind === "group" || ["Cancelled", "Refunded"].includes(status)) shares.forEach((s) => ids.add(s.user_id));
  return [...ids];
}

async function notifyOrder(app, order, status, extra = "") {
  for (const uid of await partyIds(order, status)) await notifyUser(app, uid, order.id, status, extra);
}

async function emitOrder(app, order, event, payload) {
  const io = app.get("io");
  io.to("admins").emit(event, payload);
  for (const uid of await partyIds(order, payload.status)) io.to(`user:${uid}`).emit(event, payload);
}

module.exports.partyIds = partyIds;
module.exports.notifyOrder = notifyOrder;
module.exports.emitOrder = emitOrder;

// Free-form in-app notification (treats, rewards, budget warnings...). Never throws.
async function pushNotification(app, userId, message, { orderId = null, type = "info", status = null } = {}) {
  try {
    const text = String(message).slice(0, 255);
    const [r] = await pool.query("INSERT INTO notification_log (user_id, order_id, notification_type, status, message) VALUES (?, ?, ?, ?, ?)", [userId, orderId, type, status, text]);
    app.get("io")?.to(`user:${userId}`).emit("notification", { id: r.insertId, order_id: orderId, status, message: text, sent_at: new Date().toISOString(), read: false });
  } catch (err) { console.error("pushNotification failed:", err.message); }
}
module.exports.pushNotification = pushNotification;
