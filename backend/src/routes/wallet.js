const express = require("express");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");
const MAX_TOPUP = Number(process.env.MAX_WALLET_TOPUP || 9999);

const router = express.Router();

// GET /api/wallet — balance + transaction history for the logged-in user
router.get("/", verifyToken, async (req, res) => {
  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);
  const [transactions] = await pool.query(
    "SELECT id, label, amount, created_at FROM wallet_transactions WHERE user_id = ? AND hidden_at IS NULL ORDER BY id DESC",
    [req.user.id]
  );
  res.json({ balance: user.wallet_balance, transactions });
});

router.delete("/transactions/:transactionId", verifyToken, async (req, res) => {
  const [result] = await pool.query(
    "UPDATE wallet_transactions SET hidden_at = NOW() WHERE id = ? AND user_id = ? AND hidden_at IS NULL",
    [req.params.transactionId, req.user.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: "Transaction not found" });
  res.json({ ok: true, message: "Transaction removed from your history" });
});

router.delete("/transactions", verifyToken, async (req, res) => {
  const [result] = await pool.query(
    "UPDATE wallet_transactions SET hidden_at = NOW() WHERE user_id = ? AND hidden_at IS NULL",
    [req.user.id]
  );
  res.json({ ok: true, removed: result.affectedRows, message: "Wallet history cleared" });
});

// POST /api/wallet/topup  body: { amount }
router.post("/topup", verifyToken, async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (amount > MAX_TOPUP) {
    return res.status(400).json({ error: `amount cannot exceed ${MAX_TOPUP}` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, req.user.id]);
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, 'Wallet top-up', ?)", [
      req.user.id,
      amount,
    ]);

    const [[user]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);
    await conn.commit();
    res.json({ balance: user.wallet_balance });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Wallet top-up failed" });
  } finally {
    conn.release();
  }
});

module.exports = router;
