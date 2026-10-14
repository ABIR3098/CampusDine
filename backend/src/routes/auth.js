const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const SIGNUP_BONUS = 250;
const MAX_OTP_ATTEMPTS = 5;
const ID_RE = /^[A-Za-z0-9_.@-]{3,50}$/;

const signToken = (p) => jwt.sign(p, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const publicUser = (u) => ({ id: u.id, name: u.name, role: u.role, walletBalance: Number(u.wallet_balance) });

// POST /api/auth/register  { name, externalId, role: student|teacher, password }
router.post("/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const externalId = String(req.body.externalId || "").trim();
  const { role, password } = req.body;
  if (!name || !externalId || !role || !password) return res.status(400).json({ error: "name, externalId, role and password are required" });
  if (name.length > 100) return res.status(400).json({ error: "Name is too long" });
  if (!ID_RE.test(externalId)) return res.status(400).json({ error: "ID must be 3-50 characters: letters, numbers, . _ - @" });
  if (!["student", "teacher"].includes(role)) return res.status(400).json({ error: "role must be student or teacher" });
  if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const hash = await bcrypt.hash(String(password), 10);
  let result;
  try {
    [result] = await pool.query("INSERT INTO users (name, external_id, role, password_hash, wallet_balance) VALUES (?, ?, ?, ?, ?)", [name, externalId, role, hash, SIGNUP_BONUS]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "An account with this ID already exists" });
    throw err;
  }
  await pool.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, 'Welcome bonus', ?)", [result.insertId, SIGNUP_BONUS]);
  const user = { id: result.insertId, name, role, wallet_balance: SIGNUP_BONUS };
  res.status(201).json({ token: signToken({ id: user.id, name, role }), user: publicUser(user) });
});

// POST /api/auth/login  { externalId, password }
router.post("/login", async (req, res) => {
  const { externalId, password } = req.body;
  if (!externalId || !password) return res.status(400).json({ error: "externalId and password are required" });
  const [rows] = await pool.query("SELECT * FROM users WHERE external_id = ?", [String(externalId).trim()]);
  const user = rows[0];
  // Always run a bcrypt compare so response time doesn't reveal whether the ID exists.
  const ok = await bcrypt.compare(String(password), user ? user.password_hash : "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi");
  if (!user || !ok) return res.status(401).json({ error: "Invalid ID or password" });
  res.json({ token: signToken({ id: user.id, name: user.name, role: user.role }), user: publicUser(user) });
});

// GET /api/auth/me — restore a session after a page refresh
router.get("/me", verifyToken, async (req, res) => {
  const [rows] = await pool.query("SELECT id, name, role, wallet_balance FROM users WHERE id = ?", [req.user.id]);
  if (!rows.length) return res.status(401).json({ error: "Account no longer exists" });
  res.json({ user: publicUser(rows[0]) });
});

const identifierOf = (b) => String(b.email || b.externalId || b.external_id || "").trim();

async function requestReset(req, res) {
  const identifier = identifierOf(req.body);
  if (!identifier) return res.status(400).json({ error: "email or externalId is required" });
  const [rows] = await pool.query("SELECT id FROM users WHERE email = ? OR external_id = ? LIMIT 1", [identifier, identifier]);
  const generic = { ok: true, message: "If the account exists, an OTP has been sent" };
  if (!rows.length) return res.json(generic);
  const otp = crypto.randomInt(100000, 1000000).toString();
  await pool.query("UPDATE users SET reset_otp_hash = ?, reset_otp_expiry = DATE_ADD(NOW(), INTERVAL 10 MINUTE), reset_otp_attempts = 0 WHERE id = ?", [sha(otp), rows[0].id]);
  console.log(`[OTP adapter] Reset requested for ${identifier}; wire an SMS/email provider to deliver it.`);
  if (process.env.NODE_ENV !== "production" && process.env.EXPOSE_DEV_OTP === "true") return res.json({ ...generic, _devOTP: otp });
  res.json(generic);
}

async function verifyReset(req, res) {
  const identifier = identifierOf(req.body);
  const { otp, newPassword } = req.body;
  if (!identifier || !otp || !newPassword) return res.status(400).json({ error: "email/externalId, otp and newPassword are required" });
  if (String(newPassword).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  const [rows] = await pool.query("SELECT id, reset_otp_hash, reset_otp_expiry, reset_otp_attempts FROM users WHERE email = ? OR external_id = ? LIMIT 1", [identifier, identifier]);
  const u = rows[0];
  const bad = () => res.status(400).json({ error: "Invalid or expired OTP" });
  if (!u || !u.reset_otp_hash || new Date(u.reset_otp_expiry) < new Date()) return bad();
  if (u.reset_otp_attempts >= MAX_OTP_ATTEMPTS) return res.status(429).json({ error: "Too many wrong attempts. Request a new OTP." });
  if (u.reset_otp_hash !== sha(otp)) {
    await pool.query("UPDATE users SET reset_otp_attempts = reset_otp_attempts + 1 WHERE id = ?", [u.id]);
    return bad();
  }
  await pool.query("UPDATE users SET password_hash = ?, reset_otp_hash = NULL, reset_otp_expiry = NULL, reset_otp_attempts = 0 WHERE id = ?", [await bcrypt.hash(String(newPassword), 10), u.id]);
  res.json({ ok: true, success: true, message: "Password reset successfully" });
}

router.post("/request-password-reset", requestReset);
router.post("/verify-otp-and-reset", verifyReset);
router.post("/reset-password", (req, res) => (req.body.otp ? verifyReset(req, res) : res.status(400).json({ error: "OTP verification is required" })));

module.exports = router;
