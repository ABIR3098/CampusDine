const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const { ensureCode, REFERRAL_BONUS, MAX_REWARDS_PER_REFERRER } = require("../referrals");
const { dailyTopupLimit, checkDailyTopup } = require("../utils/money");

const router = express.Router();

// GET /api/wallet — balance + transaction history for the logged-in user
router.get("/", verifyToken, catchAsync(async (req, res) => {
  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);
  const [transactions] = await pool.query(
    "SELECT label, amount, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC",
    [req.user.id]
  );
  res.json({ balance: user.wallet_balance, transactions });
}));

const PAY_METHOD_LABELS = {
  bkash: "bKash",
  nagad: "Nagad",
  dbbl: "Dutch-Bangla Bank",
  brac: "BRAC Bank",
  city: "City Bank",
  islami: "Islami Bank Bangladesh",
  sonali: "Sonali Bank",
  card: "Card",
};

// POST /api/wallet/topup  body: { amount, method } — method is one of the keys in PAY_METHOD_LABELS
// NOTE: this is a simulated payment confirmation (no real bKash/Nagad/bank gateway call).
// It just requires a valid method key so the wallet can't be credited without picking one.
router.post("/topup", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const { method } = req.body;
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "amount must be a positive number" });

  const label = PAY_METHOD_LABELS[method];
  if (!label) return res.status(400).json({ error: "a valid payment method is required" });

  /* Fix: wallet top-up limits */
  const MAX_PER_TOPUP = 10000;
  if (Math.round(amount * 100) / 100 !== amount) return res.status(400).json({ error: "Amount can have at most 2 decimal places" });
  if (amount > MAX_PER_TOPUP) return res.status(400).json({ error: `You can top up at most ৳${MAX_PER_TOPUP} at a time` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Lock this wallet first, so two parallel top-ups cannot both pass the daily check
    await conn.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [req.user.id]);
    const [[{ toppedUpToday }]] = await conn.query(
      "SELECT COALESCE(SUM(amount), 0) AS toppedUpToday FROM wallet_transactions WHERE user_id = ? AND label LIKE 'Wallet top-up via %' AND created_at >= CURDATE()",
      [req.user.id]
    );
    const dailyLimit = dailyTopupLimit();
    const daily = checkDailyTopup({ toppedUpToday, amount, limit: dailyLimit });
    if (!daily.ok) {
      await conn.rollback();
      return res.status(400).json({ error: `Daily top-up limit is ৳${dailyLimit} (you can add ৳${daily.remaining} more today)` });
    }
    await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, req.user.id]);
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
      req.user.id,
      `Wallet top-up via ${label}`,
      amount,
    ]);
    const [[user]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);
    await conn.commit();
    res.json({ balance: user.wallet_balance });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// ─────────────── Wallet transfer (student/teacher → student/teacher) ───────────────
const MAX_PER_TRANSFER = 2000;
const MAX_PER_DAY = 5000;
const clean = (v) => (typeof v === "string" ? v.trim() : "");

// GET /api/wallet/recipient?id=<external id> — lets the sender confirm WHO they are paying before sending.
// Only the name is returned.
router.get("/recipient", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const id = clean(req.query.id);
  if (!id) return res.status(400).json({ error: "Enter the ID number of the person you want to pay" });
  const [rows] = await pool.query(
    "SELECT id, name, external_id FROM users WHERE external_id = ? AND role IN ('student','teacher')",
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "No student or teacher found with this ID" });
  if (rows[0].id === req.user.id) return res.status(400).json({ error: "That is your own ID" });
  res.json({ name: rows[0].name, externalId: rows[0].external_id });
}));

// POST /api/wallet/transfer  body: { toId, amount, note? }
// Moves money between two wallets in ONE database transaction (both balances and both history rows
// change together or not at all). Limits: ৳2,000 per transfer, ৳5,000 sent per day.
router.post("/transfer", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const toId = clean(req.body.toId);
  const amount = Number(req.body.amount);
  const note = clean(req.body.note).slice(0, 40);

  if (!toId) return res.status(400).json({ error: "Enter the ID number of the person you want to pay" });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Enter an amount greater than zero" });
  if (Math.round(amount * 100) / 100 !== amount) return res.status(400).json({ error: "Amount can have at most 2 decimal places" });
  if (amount > MAX_PER_TRANSFER) return res.status(400).json({ error: `You can send at most ৳${MAX_PER_TRANSFER} at a time` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [found] = await conn.query(
      "SELECT id FROM users WHERE external_id = ? AND role IN ('student','teacher')",
      [toId]
    );
    if (found.length === 0) { await conn.rollback(); return res.status(404).json({ error: "No student or teacher found with this ID" }); }
    const recipientId = found[0].id;
    if (recipientId === req.user.id) { await conn.rollback(); return res.status(400).json({ error: "You can't send money to yourself" }); }

    // Lock both wallets, always lowest id first, so two people paying each other at once can't deadlock
    const [locked] = await conn.query(
      "SELECT id, name, external_id, wallet_balance FROM users WHERE id IN (?, ?) ORDER BY id FOR UPDATE",
      [req.user.id, recipientId]
    );
    const sender = locked.find((u) => u.id === req.user.id);
    const recipient = locked.find((u) => u.id === recipientId);

    const [[{ sentToday }]] = await conn.query(
      "SELECT COALESCE(-SUM(amount), 0) AS sentToday FROM wallet_transactions WHERE user_id = ? AND label LIKE 'Sent to %' AND created_at >= CURDATE()",
      [req.user.id]
    );
    if (Number(sentToday) + amount > MAX_PER_DAY) {
      await conn.rollback();
      return res.status(400).json({ error: `Daily sending limit is ৳${MAX_PER_DAY} (you've sent ৳${Number(sentToday)} today)` });
    }
    if (Number(sender.wallet_balance) < amount) {
      await conn.rollback();
      return res.status(402).json({ error: "Insufficient wallet balance" });
    }

    const newBalance = Number(sender.wallet_balance) - amount;
    await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [amount, sender.id]);
    await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, recipient.id]);
    const suffix = note ? ` — ${note}` : "";
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
      sender.id, `Sent to ${recipient.name} (${recipient.external_id})${suffix}`, -amount,
    ]);
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
      recipient.id, `Received from ${sender.name} (${sender.external_id})${suffix}`, amount,
    ]);
    await conn.commit();

    // Tell the receiver straight away (if they're online)
    const io = req.app.get("io");
    if (io) io.to(`user:${recipient.id}`).emit("wallet:received", { from: sender.name, amount });

    res.json({
      ok: true,
      balance: newBalance,
      to: { name: recipient.name, externalId: recipient.external_id },
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// Feature: referral code — GET /api/wallet/referral: my code and how it is doing
router.get("/referral", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const code = await ensureCode(pool, req.user.id);
  const [[st]] = await pool.query(
    "SELECT COUNT(*) AS invited, COALESCE(SUM(referral_rewarded_at IS NOT NULL), 0) AS rewarded FROM users WHERE referred_by = ?", [req.user.id]);
  const rewarded = Number(st.rewarded);
  res.json({
    code, bonus: REFERRAL_BONUS, maxRewards: MAX_REWARDS_PER_REFERRER,
    invited: Number(st.invited), rewarded, earned: Math.min(rewarded, MAX_REWARDS_PER_REFERRER) * REFERRAL_BONUS,
  });
}));

module.exports = router;