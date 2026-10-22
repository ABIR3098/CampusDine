const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const { createOtp, verifyOtp } = require("../utils/otp");
const { sendOtpEmail } = require("../utils/mailer");

const router = express.Router();
const SIGNUP_BONUS = 250;
// Email OTP is on by default. Set EMAIL_OTP_REQUIRED=false in .env to go back to the old
// no-code sign-up / reset flow (e.g. while the OTP screens are not in the frontend yet).
const otpRequired = () => String(process.env.EMAIL_OTP_REQUIRED || "true").toLowerCase() !== "false";
// Login 2FA: after the password is right, a code is emailed and must be typed to finish logging in.
//   LOGIN_OTP=all (default) | admin | off      (only works while EMAIL_OTP_REQUIRED is not false)
// An account with no email on file (e.g. the demo accounts) skips the code, because there is nowhere to send it.
const loginOtpApplies = (user) => {
  if (!otpRequired() || !user.email) return false;
  const mode = String(process.env.LOGIN_OTP || "all").toLowerCase();
  if (mode === "off") return false;
  if (mode === "admin") return user.role === "admin";
  return true;
};
const maskEmail = (e) => String(e).replace(/^(.).*?(@.*)$/, (_, a, b) => `${a}***${b}`);
const signChallenge = (userId) => jwt.sign({ uid: userId, purpose: "login2fa" }, process.env.JWT_SECRET, { expiresIn: "10m" });
function readChallenge(raw) {
  try {
    const c = jwt.verify(String(raw || ""), process.env.JWT_SECRET);
    return c.purpose === "login2fa" ? c : null;
  } catch (e) { return null; }
}
const PUBLIC_ROLES = ["student", "teacher", "rider"]; // admin accounts can NOT be created from the public sign-up form

// ───────────── helpers ─────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ID_RE = /^[A-Za-z0-9._-]{3,50}$/;

const clean = (v) => (typeof v === "string" ? v.trim() : "");
const hallIdFor = (userId) => `H-${String(userId).padStart(4, "0")}`;

function publicUser(u) {
  return {
    id: u.id, name: u.name, externalId: u.external_id, role: u.role, walletBalance: u.wallet_balance,
    email: u.email || null, accountType: u.account_type || "regular",
    phone: u.phone, address: u.address, department: u.department, fatherPhone: u.father_phone,
    hallName: u.hall_name || null, roomNumber: u.room_number, hallId: u.hall_id, avatar: u.avatar || null,
  };
}

const USER_COLUMNS = `id, name, external_id, role, wallet_balance, email, account_type,
  phone, address, department, father_phone, hall_name, room_number, hall_id, avatar`;

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// Very small in-memory brute-force guard for login / password reset:
// 5 wrong attempts for the same ID from the same address locks it for 10 minutes.
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const fails = new Map();
const failKey = (req, id) => `${req.ip}|${String(id).toLowerCase()}`;
function lockedFor(key) {
  const f = fails.get(key);
  if (!f || f.count < MAX_FAILS) return 0;
  const left = f.last + LOCK_MS - Date.now();
  if (left <= 0) { fails.delete(key); return 0; }
  return left;
}
function noteFail(key) {
  const f = fails.get(key) || { count: 0, last: 0 };
  f.count += 1; f.last = Date.now();
  fails.set(key, f);
}
setInterval(() => {
  const now = Date.now();
  for (const [k, f] of fails) if (now - f.last > LOCK_MS) fails.delete(k);
}, 5 * 60 * 1000).unref();

// A real bcrypt hash of a random string — compared against when the account doesn't
// exist so "unknown ID" and "wrong password" take about the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// ───────────── GET /api/auth/availability?externalId=&email= ─────────────
// Lets the sign-up form tell the person immediately that an ID / email is already used.
router.get("/availability", catchAsync(async (req, res) => {
  const externalId = clean(req.query.externalId);
  const email = clean(req.query.email).toLowerCase();
  const out = {};
  if (externalId) {
    const [r] = await pool.query("SELECT 1 FROM users WHERE external_id = ? LIMIT 1", [externalId]);
    out.externalIdTaken = r.length > 0;
  }
  if (email) {
    const [r] = await pool.query("SELECT 1 FROM users WHERE email = ? LIMIT 1", [email]);
    out.emailTaken = r.length > 0;
  }
  res.json(out);
}));

// ───────────── GET /api/auth/config ─────────────
// Lets the frontend know whether it must show the OTP step.
router.get("/config", (req, res) => res.json({ otpRequired: otpRequired() }));

// ───────────── POST /api/auth/otp/send-signup ─────────────
// body: { email, externalId }  → emails a 6-digit code (purpose "signup").
// Refuses if the email or ID already has an account, so no code is wasted.
router.post("/otp/send-signup", catchAsync(async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const externalId = clean(req.body.externalId);
  if (!EMAIL_RE.test(email) || email.length > 120) return res.status(400).json({ error: "Enter a valid email address" });
  if (externalId && !ID_RE.test(externalId)) {
    return res.status(400).json({ error: "ID must be 3–50 characters: letters, numbers, dot, dash or underscore" });
  }
  if (externalId) {
    const [idRows] = await pool.query("SELECT id FROM users WHERE external_id = ?", [externalId]);
    if (idRows.length > 0) return res.status(409).json({ error: "An account with this ID already exists" });
  }
  const [mailRows] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
  if (mailRows.length > 0) return res.status(409).json({ error: "An account with this email already exists" });

  const otp = await createOtp(pool, email, "signup");
  if (!otp.ok) return res.status(otp.status).json({ error: otp.error, retryAfter: otp.retryAfter });
  try {
    const mail = await sendOtpEmail(email, otp.code, "signup", otp.expiresInMin);
    res.json({ ok: true, expiresInMin: otp.expiresInMin, emailed: mail.sent });
  } catch (err) {
    console.error("OTP email failed:", err.message);
    res.status(502).json({ error: "Could not send the email. Check the address and try again." });
  }
}));

// ───────────── POST /api/auth/forgot-password ─────────────
// body: { externalId, email }  → if they match a real account, emails a reset code.
// The answer is always the same, so nobody can use this to find out which IDs / emails exist.
router.post("/forgot-password", catchAsync(async (req, res) => {
  const externalId = clean(req.body.externalId);
  const email = clean(req.body.email).toLowerCase();
  const generic = { ok: true, message: "If these details match an account, a code has been sent to that email." };
  if (!externalId || !EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter your ID and the email on your account" });

  const [rows] = await pool.query("SELECT id, email, role FROM users WHERE external_id = ?", [externalId]);
  const user = rows[0];
  if (user && user.role !== "admin" && user.email && user.email.toLowerCase() === email) {
    const otp = await createOtp(pool, email, "reset");
    if (otp.ok) {
      try { await sendOtpEmail(email, otp.code, "reset", otp.expiresInMin); }
      catch (err) { console.error("OTP email failed:", err.message); }
    } // on cooldown / hourly limit: stay silent, same generic answer
  }
  res.json(generic);
}));

// ───────────── POST /api/auth/register ─────────────
// body: { name, email, externalId, role: 'student'|'teacher', password,
//         accountType: 'regular'|'hall', hallName?, roomNumber? }
// A "hall" account must give hallName + roomNumber and gets its fixed Hall ID right away.
router.post("/register", catchAsync(async (req, res) => {
  const name = clean(req.body.name);
  const email = clean(req.body.email).toLowerCase();
  const externalId = clean(req.body.externalId);
  const role = clean(req.body.role);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const accountType = req.body.accountType === "hall" ? "hall" : "regular";
  const hallName = clean(req.body.hallName);
  const roomNumber = clean(req.body.roomNumber);

  if (!name || !email || !externalId || !role || !password) {
    return res.status(400).json({ error: "Name, email, ID, role and password are required" });
  }
  if (role === "admin") {
    return res.status(403).json({ error: "Admin accounts can't be created from the sign-up page" });
  }
  if (!PUBLIC_ROLES.includes(role)) {
    return res.status(400).json({ error: "Role must be student, teacher, or rider" });
  }
  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: "Name must be 2–100 characters" });
  }
  if (!EMAIL_RE.test(email) || email.length > 120) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  if (!ID_RE.test(externalId)) {
    return res.status(400).json({ error: "ID must be 3–50 characters: letters, numbers, dot, dash or underscore" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (accountType === "hall") {
    if (!hallName || hallName.length > 60) return res.status(400).json({ error: "Enter your hall name" });
    if (!roomNumber || roomNumber.length > 20) return res.status(400).json({ error: "Enter your hall room number" });
  }

  const [idRows] = await pool.query("SELECT id FROM users WHERE external_id = ?", [externalId]);
  if (idRows.length > 0) return res.status(409).json({ error: "An account with this ID already exists" });
  const [mailRows] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
  if (mailRows.length > 0) return res.status(409).json({ error: "An account with this email already exists" });

  // Email must be proven with the 6-digit code that /otp/send-signup mailed (body.otp)
  if (otpRequired()) {
    const check = await verifyOtp(pool, email, "signup", req.body.otp);
    if (!check.ok) return res.status(check.status).json({ error: check.error, code: "OTP_INVALID" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const startingBalance = role === "rider" ? 0 : SIGNUP_BONUS;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO users (name, email, external_id, role, password_hash, wallet_balance, account_type, hall_name, room_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, externalId, role, passwordHash, startingBalance, accountType,
        accountType === "hall" ? hallName : null, accountType === "hall" ? roomNumber : null]
    );
    const userId = result.insertId;

    let hallId = null;
    if (accountType === "hall") {
      hallId = hallIdFor(userId);
      await conn.query("UPDATE users SET hall_id = ? WHERE id = ?", [hallId, userId]);
    }
    if (startingBalance > 0) {
      await conn.query(
        "INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, 'Welcome bonus', ?)",
        [userId, startingBalance]
      );
    }
    await conn.commit();

    const token = signToken({ id: userId, name, role });
    res.status(201).json({
      token,
      user: {
        id: userId, name, role, walletBalance: startingBalance, email, accountType,
        hallName: accountType === "hall" ? hallName : null,
        roomNumber: accountType === "hall" ? roomNumber : null,
        hallId, avatar: null,
      },
    });
  } catch (err) {
    await conn.rollback();
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "An account with this ID or email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  } finally {
    conn.release();
  }
}));

// ───────────── POST /api/auth/login ─────────────
// body: { externalId (an ID number OR an email), password, role? }
// If the person picked a portal (student / teacher / admin) and the account belongs to a
// different one, they're told so instead of silently landing in the wrong portal.
router.post("/login", catchAsync(async (req, res) => {
  const identifier = clean(req.body.externalId || req.body.identifier);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const portal = clean(req.body.role);
  if (!identifier || !password) {
    return res.status(400).json({ error: "ID (or email) and password are required" });
  }

  const key = failKey(req, identifier);
  const wait = lockedFor(key);
  if (wait > 0) {
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${Math.ceil(wait / 60000)} minute(s).` });
  }

  const byEmail = identifier.includes("@");
  const [rows] = await pool.query(
    `SELECT * FROM users WHERE ${byEmail ? "email" : "external_id"} = ?`,
    [byEmail ? identifier.toLowerCase() : identifier]
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    noteFail(key);
    return res.status(401).json({ error: "Invalid ID or password" });
  }
  fails.delete(key);

  if (["student", "teacher", "admin", "rider"].includes(portal) && portal !== user.role) {
    return res.status(403).json({ error: `This account is a ${user.role} account — go back and choose the ${user.role} portal.` });
  }

  // 2FA: password was right, now ask for the emailed code. The signed "challenge" proves the password step
  // was passed, so the code alone (without the password) can never log anyone in.
  if (loginOtpApplies(user)) {
    const otp = await createOtp(pool, user.email, "login2fa");
    const challenge = signChallenge(user.id);
    if (!otp.ok) {
      // A code was sent a moment ago: let them type that one instead of failing
      if (otp.retryAfter) return res.json({ otpRequired: true, challenge, email: maskEmail(user.email), resendIn: otp.retryAfter, emailed: true });
      return res.status(otp.status).json({ error: otp.error });
    }
    try {
      const mail = await sendOtpEmail(user.email, otp.code, "login2fa", otp.expiresInMin);
      return res.json({ otpRequired: true, challenge, email: maskEmail(user.email), resendIn: 60, emailed: mail.sent });
    } catch (err) {
      console.error("OTP email failed:", err.message);
      return res.status(502).json({ error: "Could not send the login code email. Try again." });
    }
  }

  const token = signToken({ id: user.id, name: user.name, role: user.role });
  res.json({ token, user: publicUser(user) });
}));

// ───────────── POST /api/auth/login/verify ─────────────
// body: { challenge, otp }  → finishes a 2FA login and returns the same { token, user } as a normal login.
router.post("/login/verify", catchAsync(async (req, res) => {
  const c = readChallenge(req.body.challenge);
  if (!c) return res.status(401).json({ error: "Login session expired. Enter your password again.", code: "CHALLENGE_EXPIRED" });

  const key = failKey(req, "2fa:" + c.uid);
  const wait = lockedFor(key);
  if (wait > 0) return res.status(429).json({ error: `Too many wrong codes. Try again in ${Math.ceil(wait / 60000)} minute(s).` });

  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [c.uid]);
  const user = rows[0];
  if (!user || !user.email) return res.status(401).json({ error: "Login session expired. Enter your password again.", code: "CHALLENGE_EXPIRED" });

  const check = await verifyOtp(pool, user.email, "login2fa", req.body.otp);
  if (!check.ok) {
    noteFail(key);
    return res.status(check.status).json({ error: check.error, code: "OTP_INVALID" });
  }
  fails.delete(key);
  const token = signToken({ id: user.id, name: user.name, role: user.role });
  res.json({ token, user: publicUser(user) });
}));

// ───────────── POST /api/auth/login/resend ─────────────
// body: { challenge }  → emails a fresh login code (same 60-second wait as every other OTP).
router.post("/login/resend", catchAsync(async (req, res) => {
  const c = readChallenge(req.body.challenge);
  if (!c) return res.status(401).json({ error: "Login session expired. Enter your password again.", code: "CHALLENGE_EXPIRED" });
  const [rows] = await pool.query("SELECT id, email FROM users WHERE id = ?", [c.uid]);
  const user = rows[0];
  if (!user || !user.email) return res.status(401).json({ error: "Login session expired. Enter your password again.", code: "CHALLENGE_EXPIRED" });

  const otp = await createOtp(pool, user.email, "login2fa");
  if (!otp.ok) return res.status(otp.status).json({ error: otp.error, retryAfter: otp.retryAfter });
  try {
    const mail = await sendOtpEmail(user.email, otp.code, "login2fa", otp.expiresInMin);
    res.json({ ok: true, resendIn: 60, emailed: mail.sent });
  } catch (err) {
    console.error("OTP email failed:", err.message);
    res.status(502).json({ error: "Could not send the email. Try again." });
  }
}));

// ───────────── GET /api/auth/me ─────────────
router.get("/me", verifyToken, catchAsync(async (req, res) => {
  const [rows] = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [req.user.id]);
  if (rows.length === 0) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(rows[0]));
}));

// ───────────── PUT /api/auth/me ─────────────
// body (all optional): { name, email, phone, address, department, fatherPhone,
//                        hallName, roomNumber, currentPassword, newPassword, avatar }
// Giving a room number (with a hall name) turns the account into a hall account and
// assigns the fixed Hall ID the first time. The ID never changes afterwards.
router.put("/me", verifyToken, catchAsync(async (req, res) => {
  const { name, email, phone, address, department, fatherPhone, hallName, roomNumber, currentPassword, newPassword, avatar } = req.body;
  const fields = [];
  const values = [];

  if (name !== undefined) {
    const n = clean(name);
    if (n) { fields.push("name = ?"); values.push(n); }
  }
  if (email !== undefined) {
    const e = clean(email).toLowerCase();
    if (!EMAIL_RE.test(e) || e.length > 120) return res.status(400).json({ error: "Enter a valid email address" });
    const [taken] = await pool.query("SELECT id FROM users WHERE email = ? AND id != ?", [e, req.user.id]);
    if (taken.length > 0) return res.status(409).json({ error: "This email is already used by another account" });
    fields.push("email = ?"); values.push(e);
  }
  if (phone !== undefined) { fields.push("phone = ?"); values.push(clean(phone) || null); }
  if (address !== undefined) { fields.push("address = ?"); values.push(clean(address) || null); }
  if (department !== undefined) { fields.push("department = ?"); values.push(clean(department) || null); }
  if (fatherPhone !== undefined) { fields.push("father_phone = ?"); values.push(clean(fatherPhone) || null); }

  if (roomNumber !== undefined || hallName !== undefined) {
    const [[current]] = await pool.query("SELECT hall_id, hall_name, room_number FROM users WHERE id = ?", [req.user.id]);
    const room = roomNumber !== undefined ? (clean(roomNumber) || null) : current.room_number;
    const hall = hallName !== undefined ? (clean(hallName) || null) : current.hall_name;
    if (room && room.length > 20) return res.status(400).json({ error: "Room number is too long" });
    if (hall && hall.length > 60) return res.status(400).json({ error: "Hall name is too long" });

    if (roomNumber !== undefined) { fields.push("room_number = ?"); values.push(room); }
    if (hallName !== undefined) { fields.push("hall_name = ?"); values.push(hall); }

    if (room) {
      if (!hall) return res.status(400).json({ error: "Enter your hall name along with the room number" });
      fields.push("account_type = 'hall'");
      // Hall ID: made once, the first time a room is saved, and never changed after that.
      if (!current.hall_id) { fields.push("hall_id = ?"); values.push(hallIdFor(req.user.id)); }
    }
  }

  // Profile picture: a small data-URL image, or null/"" to remove it.
  if (avatar !== undefined) {
    if (avatar === null || avatar === "") {
      fields.push("avatar = ?"); values.push(null);
    } else {
      if (typeof avatar !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar)) {
        return res.status(400).json({ error: "Profile picture must be a PNG, JPG or WebP image" });
      }
      if (avatar.length > 400000) return res.status(400).json({ error: "Profile picture is too large" });
      fields.push("avatar = ?"); values.push(avatar);
    }
  }

  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: "Enter your current password to set a new one" });
    if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });
    const [rows] = await pool.query("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
    fields.push("password_hash = ?");
    values.push(await bcrypt.hash(newPassword, 10));
  }

  if (fields.length === 0) return res.status(400).json({ error: "Nothing to update" });

  try {
    values.push(req.user.id);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "This email is already used by another account" });
    throw err;
  }

  const [rows] = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [req.user.id]);
  res.json(publicUser(rows[0]));
}));

// ───────────── POST /api/auth/reset-password ─────────────
// body: { externalId, email, otp, newPassword }
// Step 1 is POST /forgot-password (mails the code). Here the code + the matching ID/email are checked,
// so knowing someone's ID and email is no longer enough to take their account over.
// Admin accounts and accounts with no email on file can't be reset here.
router.post("/reset-password", catchAsync(async (req, res) => {
  const externalId = clean(req.body.externalId);
  const email = clean(req.body.email).toLowerCase();
  const newPassword = typeof req.body.newPassword === "string" ? req.body.newPassword : "";
  if (!externalId || !email || !newPassword || (otpRequired() && !clean(req.body.otp))) {
    return res.status(400).json({ error: otpRequired() ? "ID, email, code and new password are required" : "ID, email and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const key = failKey(req, "reset:" + externalId);
  const wait = lockedFor(key);
  if (wait > 0) {
    return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60000)} minute(s).` });
  }

  const [rows] = await pool.query("SELECT id, email, role FROM users WHERE external_id = ?", [externalId]);
  const user = rows[0];
  if (!user || user.role === "admin" || !user.email || user.email.toLowerCase() !== email) {
    noteFail(key);
    return res.status(400).json({ error: "We couldn't verify this ID and email together. Check them, or ask the canteen admin for help." });
  }

  if (otpRequired()) {
    const check = await verifyOtp(pool, email, "reset", req.body.otp);
    if (!check.ok) {
      noteFail(key);
      return res.status(check.status).json({ error: check.error, code: "OTP_INVALID" });
    }
  }
  fails.delete(key);

  await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(newPassword, 10), user.id]);
  res.json({ ok: true });
}));

module.exports = router;
