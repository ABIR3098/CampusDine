// CampusDine Controller: Wallet & Digital Transactions
const pool = require("../db");

const WalletController = {
  // Get wallet balance and recent activity
  async getBalance(req, res) {
    try {
      const [users] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);
      if (users.length === 0) return res.status(404).json({ error: "User not found" });

      const balance = Number(users[0].wallet_balance || 0);
      const [transactions] = await pool.query(
        "SELECT id, amount, type, description, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 20",
        [req.user.id]
      ).catch(() => [[]]);

      return res.json({ balance, transactions });
    } catch (error) {
      console.error("WalletController.getBalance error:", error);
      return res.status(500).json({ error: "Failed to retrieve wallet information" });
    }
  },

  // Peer-to-peer balance transfer between campus users
  async transfer(req, res) {
    const { recipientId, amount } = req.body || {};
    const senderId = req.user.id;
    const numAmount = Number(amount);

    // NaN <= 0 is false, so a text amount used to get past this check.
    if (!recipientId || !Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Valid recipient and positive amount are required" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check recipient. When a campus ID and a database id look the same, the campus ID wins.
      const [recipient] = await conn.query(
        "SELECT id FROM users WHERE external_id = ? OR id = ? ORDER BY (external_id = ?) DESC LIMIT 1",
        [recipientId, recipientId, recipientId]
      );
      if (recipient.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Recipient user not found" });
      }

      const recId = recipient[0].id;
      if (Number(recId) === Number(senderId)) {
        await conn.rollback();
        return res.status(400).json({ error: "Cannot transfer to yourself" });
      }

      // Lock both wallets in id order, so two people paying each other at once cannot deadlock.
      const [locked] = await conn.query(
        "SELECT id, wallet_balance FROM users WHERE id IN (?, ?) ORDER BY id FOR UPDATE",
        [senderId, recId]
      );
      const sender = locked.find((u) => Number(u.id) === Number(senderId));
      if (!sender || Number(sender.wallet_balance || 0) < numAmount) {
        await conn.rollback();
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }

      // Transfer balances
      await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [numAmount, senderId]);
      await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [numAmount, recId]);

      await conn.commit();
      return res.json({ message: "Transfer completed successfully", transferred: numAmount });
    } catch (error) {
      await conn.rollback();
      console.error("WalletController.transfer error:", error);
      return res.status(500).json({ error: "Failed to process transfer" });
    } finally {
      conn.release();
    }
  }
};

module.exports = WalletController;
