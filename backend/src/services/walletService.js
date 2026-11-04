// CampusDine Service: Wallet Ledger & Balance Management
const pool = require("../db");

const WalletService = {
  // Execute atomic debit from user wallet with transaction receipt
  async debit(userId, amount, description = "Order payment", connection = null) {
    const conn = connection || (await pool.getConnection());
    const shouldRelease = !connection;
    try {
      const numAmount = Number(amount);
      const [users] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [userId]);
      if (users.length === 0) throw new Error("User not found");

      const currentBalance = Number(users[0].wallet_balance || 0);
      if (currentBalance < numAmount) {
        throw new Error("Insufficient wallet balance");
      }

      const newBalance = currentBalance - numAmount;
      await conn.query("UPDATE users SET wallet_balance = ? WHERE id = ?", [newBalance, userId]);

      // Record transaction
      await conn.query(
        "INSERT INTO wallet_transactions (user_id, amount, type, description, balance_after, created_at) VALUES (?, ?, 'debit', ?, ?, NOW())",
        [userId, numAmount, description, newBalance]
      ).catch(() => {});

      return { success: true, balance: newBalance };
    } finally {
      if (shouldRelease) conn.release();
    }
  },

  // Credit user wallet (refunds, cashback, deposit)
  async credit(userId, amount, description = "Wallet topup", connection = null) {
    const conn = connection || (await pool.getConnection());
    const shouldRelease = !connection;
    try {
      const numAmount = Number(amount);
      const [users] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [userId]);
      if (users.length === 0) throw new Error("User not found");

      const newBalance = Number(users[0].wallet_balance || 0) + numAmount;
      await conn.query("UPDATE users SET wallet_balance = ? WHERE id = ?", [newBalance, userId]);

      await conn.query(
        "INSERT INTO wallet_transactions (user_id, amount, type, description, balance_after, created_at) VALUES (?, ?, 'credit', ?, ?, NOW())",
        [userId, numAmount, description, newBalance]
      ).catch(() => {});

      return { success: true, balance: newBalance };
    } finally {
      if (shouldRelease) conn.release();
    }
  }
};

module.exports = WalletService;
