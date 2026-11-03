// CampusDine Controller: Promo Coupons, Lucky Spins & Discounts
const pool = require("../db");

const CouponController = {
  // Validate coupon code during order checkout
  async validateCoupon(req, res) {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "Coupon code is required" });

      const [coupons] = await pool.query(
        "SELECT id, code, discount_type, discount_value, min_order_amount, is_active FROM coupons WHERE code = ? AND is_active = 1",
        [code.trim().toUpperCase()]
      ).catch(() => [[]]);

      if (coupons.length === 0) {
        return res.status(404).json({ error: "Invalid or expired coupon code" });
      }

      const c = coupons[0];
      return res.json({
        valid: true,
        code: c.code,
        discountType: c.discount_type,
        discountValue: Number(c.discount_value),
        minOrder: Number(c.min_order_amount || 0)
      });
    } catch (error) {
      console.error("CouponController.validateCoupon error:", error);
      return res.status(500).json({ error: "Failed to validate coupon" });
    }
  },

  // Daily spin: the SERVER picks the prize and allows one spin per day.
  // Nothing in the request body is trusted.
  async claimDailySpin(req, res) {
    let conn;
    try {
      const userId = req.user.id;
      conn = await pool.getConnection();
      await conn.beginTransaction();

      // Lock the user row so two parallel requests cannot both claim.
      const [users] = await conn.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId]);
      if (!users.length) {
        await conn.rollback();
        return res.status(404).json({ error: "User not found" });
      }

      const [done] = await conn.query(
        "SELECT id FROM wallet_transactions WHERE user_id = ? AND label = ? AND created_at >= CURDATE() LIMIT 1",
        [userId, DAILY_SPIN_LABEL]
      );
      if (done.length) {
        await conn.rollback();
        return res.status(429).json({ error: "You have already spun today. Come back tomorrow!" });
      }

      const value = pickSpinPrize();
      // Always record the spin (even a 0 prize) so it counts as today's spin.
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [userId, DAILY_SPIN_LABEL, value]);
      if (value > 0) {
        await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [value, userId]);
      }
      await conn.commit();

      return res.json({
        message: value > 0 ? "Daily reward credited successfully" : "Better luck tomorrow!",
        reward: { rewardType: value > 0 ? "cash" : "none", value },
      });
    } catch (error) {
      if (conn) { try { await conn.rollback(); } catch (_) {} }
      console.error("CouponController.claimDailySpin error:", error);
      return res.status(500).json({ error: "Failed to claim spin reward" });
    } finally {
      if (conn) conn.release();
    }
  }
};

const DAILY_SPIN_LABEL = "Daily spin reward";
const SPIN_PRIZES = [0, 2, 2, 3, 5, 10]; // taka; small values on purpose
function pickSpinPrize() {
  return SPIN_PRIZES[Math.floor(Math.random() * SPIN_PRIZES.length)];
}

module.exports = CouponController;
