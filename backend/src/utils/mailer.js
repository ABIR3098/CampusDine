// Email sender (commit 2), built on nodemailer.
// If SMTP_HOST is not set, nothing is sent: the message is printed to the server console instead,
// so sign-up / reset flows can be tested without any email account.
let transporter = null;
let triedInit = false;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (triedInit) return transporter;
  triedInit = true;
  if (!smtpConfigured()) return null;
  const nodemailer = require("nodemailer"); // loaded only when SMTP is configured
  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

const PURPOSE_TEXT = {
  signup: { subject: "Verify your CampusDine account", line: "Use this code to verify your email and finish creating your account." },
  reset: { subject: "Reset your CampusDine password", line: "Use this code to reset your password." },
  login2fa: { subject: "Your CampusDine login code", line: "Use this code to finish signing in." },
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Returns { sent: true } when an email went out, { sent: false, dev: true } when only logged to console.
// Throws if SMTP is configured but sending fails (the route should turn that into a clean error).
async function sendOtpEmail(to, code, purpose, expiresInMin = 10) {
  const text = PURPOSE_TEXT[purpose] || PURPOSE_TEXT.signup;
  const tx = getTransporter();

  if (!tx) {
    console.log(`\n📧 [DEV EMAIL — SMTP not configured] To: ${to}\n   ${text.subject}\n   Code: ${code} (valid ${expiresInMin} min)\n`);
    return { sent: false, dev: true };
  }

  const from = process.env.MAIL_FROM || `CampusDine <${process.env.SMTP_USER}>`;
  await tx.sendMail({
    from,
    to,
    subject: text.subject,
    text: `${text.line}\n\nYour code: ${code}\n\nIt expires in ${expiresInMin} minutes. If you did not request this, ignore this email.\n\n— CampusDine`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e5e5e5;border-radius:12px">
      <h2 style="margin:0 0 8px">🍽 CampusDine</h2>
      <p style="color:#444">${escapeHtml(text.line)}</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:700;text-align:center;padding:14px;background:#f6f6f6;border-radius:8px">${escapeHtml(code)}</div>
      <p style="color:#777;font-size:13px">This code expires in ${expiresInMin} minutes. If you did not request it, you can ignore this email.</p>
    </div>`,
  });
  return { sent: true };
}

module.exports = { sendOtpEmail, smtpConfigured };
