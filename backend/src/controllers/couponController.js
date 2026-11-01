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

  // Record daily spin reward
  async claimDailySpin(req, res) {
    try {
      const { rewardType, value } = req.body;
      const userId = req.user.id;

      if (rewardType === "cash" && Number(value) > 0) {
        await pool.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [Number(value), userId]);
      }

      return res.json({ message: "Daily reward credited successfully", reward: { rewardType, value } });
    } catch (error) {
      console.error("CouponController.claimDailySpin error:", error);
      return res.status(500).json({ error: "Failed to claim spin reward" });
    }
  }
};

module.exports = CouponController;
