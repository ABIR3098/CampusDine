const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db");

const router = express.Router();
const SIGNUP_BONUS = 250;

// POST /api/auth/register
// body: { name, externalId, role: 'student'|'teacher'|'admin', password }
router.post("/register", async (req, res) => {
  try {
    const { name, externalId, role, password } = req.body;
    if (!name || !externalId || !role || !password) {
      return res.status(400).json({ error: "name, externalId, role and password are required" });
    }
    if (!["student", "teacher"].includes(role)) {
      return res.status(400).json({ error: "role must be student or teacher" });
    }

    const [existing] = await pool.query("SELECT id FROM users WHERE external_id = ?", [externalId]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with this ID already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const startingBalance = role === "admin" ? 0 : SIGNUP_BONUS;

    const [result] = await pool.query(
      "INSERT INTO users (name, external_id, role, password_hash, wallet_balance) VALUES (?, ?, ?, ?, ?)",
      [name, externalId, role, passwordHash, startingBalance]
    );

    if (startingBalance > 0) {
      await pool.query(
        "INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, 'Welcome bonus', ?)",
        [result.insertId, startingBalance]
      );
    }

    const token = signToken({ id: result.insertId, name, role });
    res.status(201).json({ token, user: { id: result.insertId, name, role, walletBalance: startingBalance } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
// body: { externalId, password }
router.post("/login", async (req, res) => {
  try {
    const { externalId, password } = req.body;
    if (!externalId || !password) {
      return res.status(400).json({ error: "externalId and password are required" });
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE external_id = ?", [externalId]);
    if (rows.length === 0) return res.status(401).json({ error: "Invalid ID or password" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid ID or password" });

    const token = signToken({ id: user.id, name: user.name, role: user.role });
    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role, walletBalance: user.wallet_balance },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

async function requestReset(req, res) {
  try {
    const identifier = req.body.email || req.body.externalId || req.body.external_id;
    if (!identifier) return res.status(400).json({ error: "email or externalId is required" });
    const [rows] = await pool.query("SELECT id FROM users WHERE email = ? OR external_id = ?", [identifier, identifier]);
    if (rows.length) {
      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
      await pool.query("UPDATE users SET reset_otp_hash = ?, reset_otp_expiry = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?", [otpHash, rows[0].id]);
      console.log(`[OTP adapter] Reset requested for ${identifier}; configure SMS_PROVIDER credentials to deliver it.`);
      if (process.env.NODE_ENV !== "production" && process.env.EXPOSE_DEV_OTP === "true") return res.json({ ok: true, _devOTP: otp });
    }
    return res.json({ ok: true, message: "If the account exists, an OTP has been sent" });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Password reset request failed" }); }
}

async function verifyReset(req, res) {
  try {
    const identifier = req.body.email || req.body.externalId || req.body.external_id;
    const { otp, newPassword } = req.body;
    if (!identifier || !otp || !newPassword) return res.status(400).json({ error: "email/externalId, otp and newPassword are required" });
    if (String(newPassword).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const [rows] = await pool.query("SELECT id, reset_otp_hash, reset_otp_expiry FROM users WHERE email = ? OR external_id = ?", [identifier, identifier]);
    const otpHash = crypto.createHash("sha256").update(String(otp)).digest("hex");
    if (!rows.length || rows[0].reset_otp_hash !== otpHash || new Date(rows[0].reset_otp_expiry) < new Date()) return res.status(400).json({ error: "Invalid or expired OTP" });
    await pool.query("UPDATE users SET password_hash = ?, reset_otp_hash = NULL, reset_otp_expiry = NULL WHERE id = ?", [await bcrypt.hash(newPassword, 10), rows[0].id]);
    return res.json({ ok: true, success: true, message: "Password reset successfully" });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Password reset failed" }); }
}

router.post("/request-password-reset", requestReset);
router.post("/verify-otp-and-reset", verifyReset);
router.post("/reset-password", (req, res) => req.body.otp ? verifyReset(req, res) : res.status(400).json({ error: "OTP verification is required" }));

module.exports = router;
