const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { getConnection } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Helper function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    const external_id = req.body.external_id || req.body.externalId;

    if (!name || !external_id || !password) {
      return res
        .status(400)
        .json({ error: "Name, external_id, and password required" });
    }

    const db = await getConnection();

    // Check if user already exists
    const [existing] = await db.query(
      "SELECT id FROM users WHERE external_id = ? OR email = ?",
      [external_id, email]
    );

    if (existing.length > 0) {
      db.release();
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    await db.query(
      `INSERT INTO users (name, external_id, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        external_id,
        email || null,
        phone || null,
        passwordHash,
        role || "student",
      ]
    );

    db.release();

    res.json({ success: true, message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { password } = req.body;
    const external_id = req.body.external_id || req.body.externalId;

    if (!external_id || !password) {
      return res
        .status(400)
        .json({ error: "external_id and password required" });
    }

    const db = await getConnection();

    const [users] = await db.query(
      "SELECT id, name, password_hash, role, wallet_balance FROM users WHERE external_id = ?",
      [external_id]
    );

    if (users.length === 0) {
      db.release();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = users[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      db.release();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || "7d" }
    );

    db.release();

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        wallet_balance: user.wallet_balance,
      },
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

// Request password reset (Step 1: Send OTP)
router.post("/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const db = await getConnection();

    // Find user by email
    const [users] = await db.query(
      "SELECT id, name, email FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      db.release();
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    await db.query(
      "UPDATE users SET reset_otp = ?, reset_otp_expiry = ? WHERE id = ?",
      [otp, otpExpiry, user.id]
    );

    db.release();

    // TODO: Send OTP via email or SMS
    // For now, log to console for development
    console.log(`[OTP] User: ${user.name} (${user.email}), OTP: ${otp}`);

    // In production, send via email
    // await sendEmailOTP(email, otp);

    res.json({
      success: true,
      message: "OTP sent to your email",
      // Remove this in production - only for development
      _devOTP: otp,
    });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    res.status(500).json({ error: "Failed to request password reset" });
  }
});

// Verify OTP and reset password (Step 2)
router.post("/verify-otp-and-reset", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ error: "Email, OTP, and new password required" });
    }

    const db = await getConnection();

    // Find user by email
    const [users] = await db.query(
      "SELECT id, reset_otp, reset_otp_expiry FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      db.release();
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // Verify OTP
    if (user.reset_otp !== otp) {
      db.release();
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Check OTP expiry
    if (new Date() > new Date(user.reset_otp_expiry)) {
      db.release();
      return res.status(400).json({ error: "OTP has expired" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    await db.query(
      "UPDATE users SET password_hash = ?, reset_otp = NULL, reset_otp_expiry = NULL WHERE id = ?",
      [passwordHash, user.id]
    );

    db.release();

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// Verify token
router.get("/verify", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();

    const [users] = await db.query(
      "SELECT id, name, role, wallet_balance FROM users WHERE id = ?",
      [req.user.id]
    );

    db.release();

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      valid: true,
      user: users[0],
    });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(500).json({ error: "Failed to verify token" });
  }
});

// Logout (client-side only, but endpoint for consistency)
router.post("/logout", authenticateToken, async (req, res) => {
  // JWT tokens are stateless, so logout is handled client-side
  res.json({ success: true, message: "Logged out successfully" });
});

module.exports = router;
