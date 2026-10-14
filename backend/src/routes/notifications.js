const express = require("express");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");
const { sendSMS } = require("../utils/notify");

const router = express.Router();
const normPhone = (p) => String(p || "").replace(/[\s-]/g, "");
const validPhone = (p) => /^\+?\d{10,15}$/.test(p);

router.post("/subscribe", verifyToken, async (req, res) => {
  const phone = normPhone(req.body.phoneNumber);
  if (!validPhone(phone)) return res.status(400).json({ error: "Invalid phone number" });
  await pool.query("UPDATE users SET phone = ?, notifications_enabled = 1 WHERE id = ?", [phone, req.user.id]);
  res.json({ success: true, message: "SMS notifications enabled" });
});

router.post("/unsubscribe", verifyToken, async (req, res) => {
  await pool.query("UPDATE users SET notifications_enabled = 0 WHERE id = ?", [req.user.id]);
  res.json({ success: true, message: "SMS notifications disabled" });
});

router.get("/preferences", verifyToken, async (req, res) => {
  const [rows] = await pool.query("SELECT phone, notifications_enabled FROM users WHERE id = ?", [req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "User not found" });
  res.json({ phone: rows[0].phone, notificationsEnabled: Boolean(rows[0].notifications_enabled) });
});

router.post("/test", verifyToken, async (req, res) => {
  const [rows] = await pool.query("SELECT phone FROM users WHERE id = ?", [req.user.id]);
  if (!rows.length || !rows[0].phone) return res.status(400).json({ error: "Phone number not set" });
  const sent = await sendSMS(rows[0].phone, "CampusDine: This is a test notification. Your SMS alerts are working!");
  sent ? res.json({ success: true, message: "Test SMS sent" }) : res.status(502).json({ error: "Failed to send test SMS" });
});

// In-app notification feed (the bell icon). `read` = the user has opened it.
router.get("/history", verifyToken, async (req, res) => {
  const [rows] = await pool.query("SELECT id, order_id, notification_type, status, message, sent_at, read_at IS NOT NULL AS `read` FROM notification_log WHERE user_id = ? ORDER BY id DESC LIMIT 30", [req.user.id]);
  const [[u]] = await pool.query("SELECT COUNT(*) AS c FROM notification_log WHERE user_id = ? AND read_at IS NULL", [req.user.id]);
  res.json({ notifications: rows.map((n) => ({ ...n, read: Boolean(n.read) })), unread: u.c });
});

router.post("/read-all", verifyToken, async (req, res) => {
  await pool.query("UPDATE notification_log SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL", [req.user.id]);
  res.json({ success: true });
});

module.exports = router;
