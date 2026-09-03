const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");

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
    if (!["student", "teacher", "admin"].includes(role)) {
      return res.status(400).json({ error: "role must be student, teacher or admin" });
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

// GET /api/auth/me — the logged-in user's own profile
router.get("/me", verifyToken, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, external_id, role, wallet_balance FROM users WHERE id = ?",
    [req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "User not found" });
  const u = rows[0];
  res.json({ id: u.id, name: u.name, externalId: u.external_id, role: u.role, walletBalance: u.wallet_balance });
});

// PUT /api/auth/me — update name and/or password
// body: { name?, currentPassword?, newPassword? }
router.put("/me", verifyToken, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const fields = [];
    const values = [];

    if (name && name.trim()) {
      fields.push("name = ?");
      values.push(name.trim());
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Enter your current password to set a new one" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }
      const [rows] = await pool.query("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
      const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
      const hash = await bcrypt.hash(newPassword, 10);
      fields.push("password_hash = ?");
      values.push(hash);
    }

    if (fields.length === 0) return res.status(400).json({ error: "Nothing to update" });

    values.push(req.user.id);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);

    const [rows] = await pool.query(
      "SELECT id, name, external_id, role, wallet_balance FROM users WHERE id = ?",
      [req.user.id]
    );
    const u = rows[0];
    res.json({ id: u.id, name: u.name, externalId: u.external_id, role: u.role, walletBalance: u.wallet_balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Profile update failed" });
  }
});

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// POST /api/auth/reset-password
// body: { externalId, newPassword }
// NOTE: simplified for a coursework demo — no email/OTP verification step.
// A production system would email a one-time reset link/code before allowing this.
router.post("/reset-password", async (req, res) => {
  try {
    const { externalId, newPassword } = req.body;
    if (!externalId || !newPassword) {
      return res.status(400).json({ error: "externalId and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const [rows] = await pool.query("SELECT id FROM users WHERE external_id = ?", [externalId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "No account found with this ID" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, rows[0].id]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Password reset failed" });
  }
});

module.exports = router;
