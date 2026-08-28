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

// POST /api/wallet/topup  body: { amount }
router.post("/topup", verifyToken, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "amount must be a positive number" });

  await pool.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, req.user.id]);
  await pool.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, 'Wallet top-up', ?)", [
    req.user.id,
    amount,
  ]);

  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);
  res.json({ balance: user.wallet_balance });
});

module.exports = router;
