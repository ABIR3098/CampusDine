// Email OTP service (commit 1).
// - Codes are 6 digits, stored only as an HMAC hash (never plain text).
// - Valid for OTP_TTL_MIN minutes, at most MAX_ATTEMPTS wrong tries per code.
// - A new code can be requested only after RESEND_COOLDOWN_SEC seconds,
//   and at most MAX_PER_HOUR codes per email+purpose per hour.
// All time checks run inside MySQL (NOW()), so server/DB timezone differences can't break expiry.
const crypto = require("crypto");

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 60;
const MAX_PER_HOUR = 5;
const PURPOSES = ["signup", "reset", "login2fa"];

async function ensureOtpSchema(db) {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(120) NOT NULL,
        purpose ENUM('signup','reset','login2fa') NOT NULL,
        code_hash CHAR(64) NOT NULL,
        attempts TINYINT NOT NULL DEFAULT 0,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_otp_lookup (email, purpose, id)
      )
    `);
  } catch (e) {
    console.warn("⚠️ Could not verify email_otps table:", e.message);
  }
}

function secret() {
  return process.env.JWT_SECRET || "campusdine-dev-secret";
}

function hashCode(email, purpose, code) {
  return crypto.createHmac("sha256", secret()).update(`otp:${purpose}:${email}:${code}`).digest("hex");
}

const normEmail = (e) => String(e || "").trim().toLowerCase();

// Creates a fresh code. Returns { ok: true, code } or { ok: false, status, error, retryAfter? }.
async function createOtp(db, emailRaw, purpose) {
  const email = normEmail(emailRaw);
  if (!email || !PURPOSES.includes(purpose)) return { ok: false, status: 400, error: "Invalid email or purpose" };

  const [[last]] = await db.query(
    "SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age FROM email_otps WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1",
    [email, purpose]
  );
  if (last && last.age < RESEND_COOLDOWN_SEC) {
    const retryAfter = RESEND_COOLDOWN_SEC - last.age;
    return { ok: false, status: 429, error: `Please wait ${retryAfter} second(s) before requesting a new code`, retryAfter };
  }

  const [[{ n }]] = await db.query(
    "SELECT COUNT(*) AS n FROM email_otps WHERE email = ? AND purpose = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)",
    [email, purpose]
  );
  if (Number(n) >= MAX_PER_HOUR) {
    return { ok: false, status: 429, error: "Too many codes requested. Try again in an hour." };
  }

  // Older unused codes for the same email+purpose stop working
  await db.query("UPDATE email_otps SET used_at = NOW() WHERE email = ? AND purpose = ? AND used_at IS NULL", [email, purpose]);

  const code = String(crypto.randomInt(100000, 1000000));
  await db.query(
    "INSERT INTO email_otps (email, purpose, code_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))",
    [email, purpose, hashCode(email, purpose, code), OTP_TTL_MIN]
  );
  return { ok: true, code, expiresInMin: OTP_TTL_MIN };
}

// Checks a code. A correct code is consumed (one use only).
// Returns { ok: true } or { ok: false, status, error }.
async function verifyOtp(db, emailRaw, purpose, codeRaw) {
  const email = normEmail(emailRaw);
  const code = String(codeRaw || "").trim();
  if (!email || !PURPOSES.includes(purpose) || !/^\d{6}$/.test(code)) {
    return { ok: false, status: 400, error: "Enter the 6-digit code" };
  }

  const [[row]] = await db.query(
    "SELECT id, code_hash, attempts FROM email_otps WHERE email = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1",
    [email, purpose]
  );
  if (!row) return { ok: false, status: 400, error: "Code expired or not found. Request a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, status: 429, error: "Too many wrong attempts. Request a new code." };

  const given = Buffer.from(hashCode(email, purpose, code));
  const expected = Buffer.from(row.code_hash);
  const match = given.length === expected.length && crypto.timingSafeEqual(given, expected);

  if (!match) {
    await db.query("UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?", [row.id]);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return { ok: false, status: 400, error: left > 0 ? `Wrong code. ${left} attempt(s) left.` : "Wrong code. Request a new one." };
  }

  // used_at IS NULL in the WHERE makes a double-submit of the same code fail the second time
  const [upd] = await db.query("UPDATE email_otps SET used_at = NOW() WHERE id = ? AND used_at IS NULL", [row.id]);
  if (upd.affectedRows === 0) return { ok: false, status: 400, error: "This code was already used" };
  return { ok: true };
}

// Housekeeping: delete codes older than a day (call occasionally or on startup)
async function purgeOldOtps(db) {
  try { await db.query("DELETE FROM email_otps WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)"); } catch (e) { /* ignore */ }
}

module.exports = { ensureOtpSchema, createOtp, verifyOtp, purgeOldOtps, OTP_TTL_MIN, MAX_ATTEMPTS, RESEND_COOLDOWN_SEC };
