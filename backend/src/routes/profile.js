const express = require("express");
const bcrypt = require("bcryptjs");
const { getConnection } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
router.get("/", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();
  const [rows] = await db.query("SELECT id, name, external_id, email, phone, role, wallet_balance, created_at FROM users WHERE id = ?", [req.user.id]);
  db.release();
  if (!rows.length) return res.status(404).json({ error: "User not found" });
    return res.json({ user: rows[0] });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Failed to fetch profile" }); }
});
router.put("/", authenticateToken, async (req, res) => {
  const fields = [];
  const values = [];
  if (req.body.name !== undefined) { if (!String(req.body.name).trim()) return res.status(400).json({ error: "Name cannot be empty" }); fields.push("name = ?"); values.push(String(req.body.name).trim()); }
  if (req.body.email !== undefined) { if (req.body.email && !/^\S+@\S+\.\S+$/.test(req.body.email)) return res.status(400).json({ error: "Invalid email format" }); fields.push("email = ?"); values.push(req.body.email || null); }
  if (req.body.phone !== undefined) { fields.push("phone = ?"); values.push(req.body.phone || null); }
  if (!fields.length) return res.status(400).json({ error: "No fields to update" });
  try { values.push(req.user.id); await getConnection().then(async (db) => { await db.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values); db.release(); }); return res.json({ success: true, message: "Profile updated successfully" }); }
  catch (err) { console.error(err); return res.status(500).json({ error: "Failed to update profile" }); }
});
router.post("/change-password", authenticateToken, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword !== confirmPassword || String(newPassword).length < 6) return res.status(400).json({ error: "Valid current password and matching password of at least 6 characters are required" });
  try {
    const db = await getConnection();
    const [rows] = await db.query("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
  if (!rows.length || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) { db.release(); return res.status(401).json({ error: "Current password is incorrect" }); }
  await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(newPassword, 10), req.user.id]);
  db.release();
    return res.json({ success: true, message: "Password changed successfully" });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Failed to change password" }); }
});
module.exports = router;
/*
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getConnection } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Get user profile
router.get("/", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();
    const [user] = await db.query(
      `SELECT id, name, external_id, email, phone, role, wallet_balance, created_at 
       FROM users 
       WHERE id = ?`,
      [req.user.id]
    );
    db.release();

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: user[0] });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Update user profile (name, email, phone)
router.put("/", authenticateToken, async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Validate input
    if (name && name.trim().length === 0) {
      return res.status(400).json({ error: "Name cannot be empty" });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (phone && !/^\d{10,}$/.test(phone.replace(/[\s-]/g, ""))) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const db = await getConnection();

    const updateFields = [];
    const updateValues = [];

    if (name) {
      updateFields.push("name = ?");
      updateValues.push(name);
    }
    if (email) {
      updateFields.push("email = ?");
      updateValues.push(email);
    }
    if (phone) {
      updateFields.push("phone = ?");
      updateValues.push(phone);
    }

    if (updateFields.length === 0) {
      db.release();
      return res.status(400).json({ error: "No fields to update" });
    }

    updateValues.push(req.user.id);

    await db.query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );

    db.release();

    res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Change password
router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const db = await getConnection();

    // Get current password hash
    const [user] = await db.query(
      "SELECT password_hash FROM users WHERE id = ?",
      [req.user.id]
    );

    if (user.length === 0) {
      db.release();
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user[0].password_hash
    );

    if (!isPasswordValid) {
      db.release();
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      newPasswordHash,
      req.user.id,
    ]);

    db.release();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// CRITICAL FIX: Password reset with OTP verification
router.post("/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const db = await getConnection();

    // Check if user exists
    const [user] = await db.query(
      "SELECT id, phone FROM users WHERE email = ?",
      [email]
    );

    if (user.length === 0) {
      db.release();
      // Don't reveal whether email exists for security
      return res.json({
        message: "If the email exists, an OTP will be sent to the phone number",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP
    await db.query(
      "UPDATE users SET reset_otp = ?, reset_otp_expiry = ? WHERE id = ?",
      [otp, otpExpiry, user[0].id]
    );

    db.release();

    // TODO: Send OTP via SMS to user[0].phone
    // For now, log it (in production, use Twilio or similar)
    console.log(`[SMS] OTP for ${email}: ${otp}`);

    res.json({
      message: "OTP sent to registered phone number",
      success: true,
    });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    res.status(500).json({ error: "Failed to request password reset" });
  }
});

// Verify OTP and reset password
router.post("/verify-otp-and-reset", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const db = await getConnection();

    // Get user
    const [user] = await db.query(
      "SELECT id, reset_otp, reset_otp_expiry FROM users WHERE email = ?",
      [email]
    );

    if (user.length === 0) {
      db.release();
      return res.status(404).json({ error: "User not found" });
    }

    // Verify OTP
    if (user[0].reset_otp !== otp) {
      db.release();
      return res.status(401).json({ error: "Invalid OTP" });
    }

    // Check OTP expiry
    if (new Date() > new Date(user[0].reset_otp_expiry)) {
      db.release();
      return res.status(401).json({ error: "OTP has expired" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    await db.query(
      "UPDATE users SET password_hash = ?, reset_otp = NULL, reset_otp_expiry = NULL WHERE id = ?",
      [passwordHash, user[0].id]
    );

    db.release();

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// Get account statistics
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();

    // Total orders
    const [orders] = await db.query(
      "SELECT COUNT(*) as total, SUM(total_amount) as spent FROM orders WHERE user_id = ?",
      [req.user.id]
    );

    // Pending orders
    const [pending] = await db.query(
      "SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status IN ('Received', 'Preparing', 'Ready')",
      [req.user.id]
    );

    // Favorite items count
    const [favorites] = await db.query(
      "SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?",
      [req.user.id]
    );

    db.release();

    res.json({
      stats: {
        totalOrders: orders[0].total || 0,
        totalSpent: orders[0].spent || 0,
        pendingOrders: pending[0].count || 0,
        favoriteItems: favorites[0].count || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

module.exports = router;
}
*/
