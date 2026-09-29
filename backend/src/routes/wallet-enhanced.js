const express = require("express");
const { getConnection } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Maximum wallet top-up limit: ৳9,999
const MAX_TOPUP_AMOUNT = 9999;

// Get wallet balance
router.get("/balance", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();
    const [user] = await db.query(
      "SELECT wallet_balance FROM users WHERE id = ?",
      [req.user.id]
    );
    db.release();

    if (user.length === 0) return res.status(404).json({ error: "User not found" });

    res.json({ balance: user[0].wallet_balance });
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

// Get wallet transaction history
router.get("/transactions", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();
    const [transactions] = await db.query(
      `SELECT id, amount, label, created_at 
       FROM wallet_transactions 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.id]
    );
    db.release();

    res.json({ transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Top up wallet - with maximum limit enforcement
router.post("/topup", authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    // Input validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // CRITICAL FIX: Enforce maximum top-up limit of ৳9,999
    if (amount > MAX_TOPUP_AMOUNT) {
      return res.status(400).json({
        error: `Maximum top-up limit is ৳${MAX_TOPUP_AMOUNT}. You requested ৳${amount}`,
      });
    }

    const db = await getConnection();

    // Start transaction
    await db.beginTransaction();

    try {
      // Update wallet balance
      await db.query(
        "UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?",
        [amount, req.user.id]
      );

      // Log transaction
      const label = `Top-up: ৳${amount}`;
      const [result] = await db.query(
        "INSERT INTO wallet_transactions (user_id, amount, label) VALUES (?, ?, ?)",
        [req.user.id, amount, label]
      );

      await db.commit();
      db.release();

      res.json({
        success: true,
        message: `Successfully topped up ৳${amount}`,
        transactionId: result.insertId,
      });
    } catch (error) {
      await db.rollback();
      db.release();
      throw error;
    }
  } catch (error) {
    console.error("Error topping up wallet:", error);
    res.status(500).json({ error: "Failed to top up wallet" });
  }
});

// Deduct from wallet (for order payment)
router.post("/deduct", authenticateToken, async (req, res) => {
  try {
    const { amount, orderId, label } = req.body;

    if (!amount || amount <= 0 || !orderId) {
      return res.status(400).json({ error: "Invalid amount or order ID" });
    }

    const db = await getConnection();

    // Check balance
    const [user] = await db.query(
      "SELECT wallet_balance FROM users WHERE id = ?",
      [req.user.id]
    );

    if (user.length === 0 || user[0].wallet_balance < amount) {
      db.release();
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    // Start transaction
    await db.beginTransaction();

    try {
      // Deduct from wallet
      await db.query(
        "UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?",
        [amount, req.user.id]
      );

      // Log transaction
      const txLabel = label || `Order #${orderId}`;
      await db.query(
        "INSERT INTO wallet_transactions (user_id, amount, label) VALUES (?, ?, ?)",
        [req.user.id, -amount, txLabel]
      );

      await db.commit();
      db.release();

      res.json({ success: true, message: "Payment processed" });
    } catch (error) {
      await db.rollback();
      db.release();
      throw error;
    }
  } catch (error) {
    console.error("Error deducting from wallet:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

// Refund to wallet (for order cancellation)
router.post("/refund", authenticateToken, async (req, res) => {
  try {
    const { amount, orderId, reason } = req.body;

    if (!amount || amount <= 0 || !orderId) {
      return res.status(400).json({ error: "Invalid amount or order ID" });
    }

    const db = await getConnection();

    await db.beginTransaction();

    try {
      // Add refund to wallet
      await db.query(
        "UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?",
        [amount, req.user.id]
      );

      // Log transaction
      const label = reason || `Refund for Order #${orderId}`;
      await db.query(
        "INSERT INTO wallet_transactions (user_id, amount, label) VALUES (?, ?, ?)",
        [req.user.id, amount, label]
      );

      await db.commit();
      db.release();

      res.json({ success: true, message: `Refund of ৳${amount} processed` });
    } catch (error) {
      await db.rollback();
      db.release();
      throw error;
    }
  } catch (error) {
    console.error("Error refunding wallet:", error);
    res.status(500).json({ error: "Failed to process refund" });
  }
});

module.exports = router;
