const express = require("express");
const pool = require("../db");
const { withTransaction } = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const MAX_TOPUP = Number(process.env.MAX_WALLET_TOPUP || 9999);
const MAX_DAILY_TOPUP = Number(process.env.MAX_DAILY_TOPUP || 20000);
// The demo top-up credits money with no payment. Set ALLOW_DEMO_TOPUP=false in production.
const DEMO_TOPUP = process.env.ALLOW_DEMO_TOPUP !== "false";

router.get("/", verifyToken, async (req, res) => {
  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);
  const [transactions] = await pool.query("SELECT id, label, amount, created_at FROM wallet_transactions WHERE user_id = ? AND hidden_at IS NULL ORDER BY id DESC LIMIT 200", [req.user.id]);
  res.json({ balance: user.wallet_balance, transactions });
});

router.delete("/transactions/:transactionId", verifyToken, async (req, res) => {
  const [r] = await pool.query("UPDATE wallet_transactions SET hidden_at = NOW() WHERE id = ? AND user_id = ? AND hidden_at IS NULL", [req.params.transactionId, req.user.id]);
  if (!r.affectedRows) return res.status(404).json({ error: "Transaction not found" });
  res.json({ ok: true, message: "Transaction removed from your history" });
});

router.delete("/transactions", verifyToken, async (req, res) => {
  const [r] = await pool.query("UPDATE wallet_transactions SET hidden_at = NOW() WHERE user_id = ? AND hidden_at IS NULL", [req.user.id]);
  res.json({ ok: true, removed: r.affectedRows, message: "Wallet history cleared" });
});

// POST /api/wallet/topup { amount }
router.post("/topup", verifyToken, async (req, res) => {
  if (!DEMO_TOPUP) return res.status(403).json({ error: "Demo top-up is disabled. Use bKash or Nagad." });
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "amount must be a positive number" });
  if (amount > MAX_TOPUP) return res.status(400).json({ error: `amount cannot exceed ${MAX_TOPUP}` });

  const balance = await withTransaction(async (conn) => {
    const [[user]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [req.user.id]);
    const [[today]] = await conn.query("SELECT COALESCE(SUM(amount), 0) AS s FROM wallet_transactions WHERE user_id = ? AND label = 'Wallet top-up' AND DATE(created_at) = CURDATE()", [req.user.id]);
    if (today.s + amount > MAX_DAILY_TOPUP) throw { status: 400, message: `Daily top-up limit of ${MAX_DAILY_TOPUP} reached` };
    await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, req.user.id]);
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, 'Wallet top-up', ?)", [req.user.id, amount]);
    return Math.round((user.wallet_balance + amount) * 100) / 100;
  });
  res.json({ balance });
});

module.exports = router;
