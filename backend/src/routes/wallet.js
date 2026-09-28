const express = require("express");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// GET /api/wallet — balance + transaction history for the logged-in user
router.get("/", verifyToken, async (req, res) => {
  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);
  const [transactions] = await pool.query(
    "SELECT label, amount, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC",
    [req.user.id]
  );
  res.json({ balance: user.wallet_balance, transactions });
});

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
router.post("/topup", verifyToken, async (req, res) => {
  const { amount, method } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "amount must be a positive number" });

  const label = PAY_METHOD_LABELS[method];
  if (!label) return res.status(400).json({ error: "a valid payment method is required" });

  await pool.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, req.user.id]);
  await pool.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
    req.user.id,
    `Wallet top-up via ${label}`,
    amount,
  ]);

  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);
  res.json({ balance: user.wallet_balance });
});

module.exports = router;