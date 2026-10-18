const express = require("express");
const { getConnection } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// In production, use Twilio or similar service
// For now, we'll implement a stub that logs SMS
// Install twilio: npm install twilio

const sendSMS = async (phoneNumber, message) => {
  try {
    // TODO: Replace with actual SMS service (Twilio, AWS SNS, etc.)
    // Example with Twilio:
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phoneNumber
    // });

    // For development: just log it
    console.log(`[SMS] To: ${phoneNumber}\nMessage: ${message}`);

    return true;
  } catch (error) {
    console.error("Error sending SMS:", error);
    return false;
  }
};

// Send order notification
const sendOrderNotification = async (userId, orderId, status, phoneNumber) => {
  const messages = {
    Received: `Your CampusDine order #${orderId} has been received. Status: Order Received`,
    Confirmed: `Your CampusDine order #${orderId} is confirmed. Status: Order Confirmed`,
    Preparing: `Your CampusDine order #${orderId} is being prepared. Status: Preparing`,
    Ready: `Your CampusDine order #${orderId} is ready for pickup. Status: Ready`,
    Delivered: `Your CampusDine order #${orderId} has been delivered. Thank you!`,
    Cancelled: `Your CampusDine order #${orderId} has been cancelled. Refund processed.`,
  };

  const message = messages[status] || `Your CampusDine order #${orderId} status: ${status}`;
  return await sendSMS(phoneNumber, message);
};

// Subscribe to notifications
router.post("/subscribe", authenticateToken, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || !/^\d{10,}$/.test(phoneNumber.replace(/[\s-]/g, ""))) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const db = await getConnection();

    await db.query(
      "UPDATE users SET phone = ?, notifications_enabled = 1 WHERE id = ?",
      [phoneNumber, req.user.id]
    );

    db.release();

    res.json({
      success: true,
      message: "SMS notifications enabled",
    });
  } catch (error) {
    console.error("Error subscribing to notifications:", error);
    res.status(500).json({ error: "Failed to enable notifications" });
  }
});

// Unsubscribe from notifications
router.post("/unsubscribe", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();

    await db.query(
      "UPDATE users SET notifications_enabled = 0 WHERE id = ?",
      [req.user.id]
    );

    db.release();

    res.json({
      success: true,
      message: "SMS notifications disabled",
    });
  } catch (error) {
    console.error("Error unsubscribing from notifications:", error);
    res.status(500).json({ error: "Failed to disable notifications" });
  }
});

// Get notification preferences
router.get("/preferences", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();

    const [user] = await db.query(
      "SELECT phone, notifications_enabled FROM users WHERE id = ?",
      [req.user.id]
    );

    db.release();

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      phone: user[0].phone,
      notificationsEnabled: user[0].notifications_enabled,
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

// Trigger notification (for testing)
router.post("/test", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();

    const [user] = await db.query(
      "SELECT phone FROM users WHERE id = ?",
      [req.user.id]
    );

    if (user.length === 0 || !user[0].phone) {
      db.release();
      return res.status(400).json({ error: "Phone number not set" });
    }

    const testMessage = "CampusDine: This is a test notification. Your SMS alerts are working!";
    const sent = await sendSMS(user[0].phone, testMessage);

    db.release();

    if (sent) {
      res.json({ success: true, message: "Test SMS sent" });
    } else {
      res.status(500).json({ error: "Failed to send test SMS" });
    }
  } catch (error) {
    console.error("Error sending test notification:", error);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// Get notification history
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();

    const [notifications] = await db.query(
      `SELECT id, order_id, notification_type, status, sent_at
       FROM notification_log
       WHERE user_id = ?
       ORDER BY sent_at DESC
       LIMIT 20`,
      [req.user.id]
    );

    db.release();

    res.json({ notifications });
  } catch (error) {
    console.error("Error fetching notification history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Export sendOrderNotification for use in order routes
module.exports = router;
module.exports.sendOrderNotification = sendOrderNotification;
module.exports.sendSMS = sendSMS;
