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
<<<<<<< HEAD
});
=======
}));

// GET /api/auth/me — the logged-in user's own profile
router.get("/me", verifyToken, catchAsync(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, external_id, role, wallet_balance,
            phone, address, department, father_phone, room_number, hall_id
     FROM users WHERE id = ?`,
    [req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "User not found" });
  const u = rows[0];
  res.json({
    id: u.id, name: u.name, externalId: u.external_id, role: u.role, walletBalance: u.wallet_balance,
    phone: u.phone, address: u.address, department: u.department, fatherPhone: u.father_phone,
    roomNumber: u.room_number, hallId: u.hall_id,
  });
}));

// PUT /api/auth/me — update name and/or password
// body: { name?, currentPassword?, newPassword? }
router.put("/me", verifyToken, catchAsync(async (req, res) => {
  try {
    const { name, phone, address, department, fatherPhone, roomNumber, currentPassword, newPassword } = req.body;
    const fields = [];
    const values = [];

    if (name && name.trim()) {
      fields.push("name = ?");
      values.push(name.trim());
    }
    if (phone !== undefined) { fields.push("phone = ?"); values.push(phone.trim() || null); }
    if (address !== undefined) { fields.push("address = ?"); values.push(address.trim() || null); }
    if (department !== undefined) { fields.push("department = ?"); values.push(department.trim() || null); }
    if (fatherPhone !== undefined) { fields.push("father_phone = ?"); values.push(fatherPhone.trim() || null); }

    if (roomNumber !== undefined) {
      const room = roomNumber.trim() || null;
      fields.push("room_number = ?");
      values.push(room);

      // Hall ID: assigned automatically, once, the first time a room number is
      // saved — fixed from then on (based on the user's own id, so it's unique
      // and never regenerated even if the room number later changes or is cleared).
      if (room) {
        const [[existing]] = await pool.query("SELECT hall_id FROM users WHERE id = ?", [req.user.id]);
        if (!existing.hall_id) {
          fields.push("hall_id = ?");
          values.push(`H-${String(req.user.id).padStart(4, "0")}`);
        }
      }
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
      `SELECT id, name, external_id, role, wallet_balance,
              phone, address, department, father_phone, room_number, hall_id
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    const u = rows[0];
    res.json({
      id: u.id, name: u.name, externalId: u.external_id, role: u.role, walletBalance: u.wallet_balance,
      phone: u.phone, address: u.address, department: u.department, fatherPhone: u.father_phone,
      roomNumber: u.room_number, hallId: u.hall_id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Profile update failed" });
  }
}));
>>>>>>> 20c39de (feat: extended profile (phone, address, department, father's number, hall room) with auto-assigned fixed Hall ID and edit mode)

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