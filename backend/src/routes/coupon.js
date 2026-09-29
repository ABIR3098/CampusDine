const express = require("express");
const { getConnection } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Validate and apply coupon code
router.post("/validate", authenticateToken, async (req, res) => {
  try {
    const { couponCode, orderAmount } = req.body;

    if (!couponCode || !orderAmount || orderAmount <= 0) {
      return res.status(400).json({ error: "Invalid coupon code or order amount" });
    }

    const db = await getConnection();

    // Get coupon details
    const [coupon] = await db.query(
      `SELECT id, discount_type, discount_value, min_order_amount, max_discount, 
              usage_limit, used_count, expiry_date, is_active
       FROM coupons
       WHERE code = ?`,
      [couponCode]
    );

    if (coupon.length === 0) {
      db.release();
      return res.status(404).json({ error: "Coupon not found" });
    }

    const couponData = coupon[0];

    // Validate coupon
    if (!couponData.is_active) {
      db.release();
      return res.status(400).json({ error: "This coupon is no longer active" });
    }

    if (couponData.expiry_date && new Date(couponData.expiry_date) < new Date()) {
      db.release();
      return res.status(400).json({ error: "This coupon has expired" });
    }

    if (couponData.usage_limit && couponData.used_count >= couponData.usage_limit) {
      db.release();
      return res.status(400).json({ error: "This coupon usage limit has been reached" });
    }

    if (orderAmount < (couponData.min_order_amount || 0)) {
      db.release();
      return res.status(400).json({
        error: `Minimum order amount required: ৳${couponData.min_order_amount || 0}`,
      });
    }

    // Check if user has already used this coupon
    const [userUsage] = await db.query(
      "SELECT id FROM coupon_usage WHERE user_id = ? AND coupon_id = ?",
      [req.user.id, couponData.id]
    );

    if (userUsage.length > 0) {
      db.release();
      return res.status(400).json({ error: "You have already used this coupon" });
    }

    // Calculate discount
    let discount = 0;
    if (couponData.discount_type === "PERCENTAGE") {
      discount = Math.round(orderAmount * (couponData.discount_value / 100));
    } else if (couponData.discount_type === "FIXED") {
      discount = couponData.discount_value;
    }

    // Apply max discount limit
    if (couponData.max_discount && discount > couponData.max_discount) {
      discount = couponData.max_discount;
    }

    const finalAmount = Math.max(0, orderAmount - discount);

    db.release();

    res.json({
      valid: true,
      couponId: couponData.id,
      discountType: couponData.discount_type,
      discountValue: couponData.discount_value,
      discountAmount: discount,
      originalAmount: orderAmount,
      finalAmount,
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({ error: "Failed to validate coupon" });
  }
});

// Apply coupon to order
router.post("/apply", authenticateToken, async (req, res) => {
  try {
    const { couponId, orderId } = req.body;

    if (!couponId || !orderId) {
      return res.status(400).json({ error: "Missing coupon ID or order ID" });
    }

    const db = await getConnection();

    await db.beginTransaction();

    try {
      const [coupon] = await db.query(
        "SELECT discount_type, discount_value, max_discount FROM coupons WHERE id = ?",
        [couponId]
      );

      const [order] = await db.query("SELECT total, user_id, status FROM orders WHERE id = ? AND user_id = ?", [orderId, req.user.id]);
      if (!coupon.length) throw new Error("Coupon not found");
      if (!order.length) throw new Error("Order not found");
      if (order[0].status !== "Received") throw new Error("Order is not eligible for a coupon");
      await db.query("INSERT INTO coupon_usage (user_id, coupon_id, order_id) VALUES (?, ?, ?)", [req.user.id, couponId, orderId]);
      await db.query("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", [couponId]);
      let discount = 0;
      if (coupon[0].discount_type === "PERCENTAGE") {
        discount = Math.round(order[0].total * (coupon[0].discount_value / 100));
      } else {
        discount = coupon[0].discount_value;
      }

      if (coupon[0].max_discount && discount > coupon[0].max_discount) {
        discount = coupon[0].max_discount;
      }

      const newAmount = Math.max(0, order[0].total - discount);

      await db.query(
        "UPDATE orders SET discount_amount = ?, discount_applied = 1, total = ? WHERE id = ? AND user_id = ?",
        [discount, newAmount, orderId, req.user.id]
      );

      await db.commit();
      db.release();

      res.json({
        success: true,
        message: `Discount of ৳${discount} applied`,
        discountAmount: discount,
        newTotal: newAmount,
      });
    } catch (error) {
      await db.rollback();
      db.release();
      throw error;
    }
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ error: "Failed to apply coupon" });
  }
});

// Get available coupons
router.get("/available", async (req, res) => {
  try {
    const db = await getConnection();

    const [coupons] = await db.query(
      `SELECT id, code, discount_type, discount_value, min_order_amount, 
              max_discount, expiry_date, description
       FROM coupons
       WHERE is_active = 1
       AND (expiry_date IS NULL OR expiry_date > NOW())
       AND (usage_limit IS NULL OR used_count < usage_limit)
       ORDER BY expiry_date ASC`
    );

    db.release();

    res.json({ coupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
});

// Admin: Create new coupon
router.post("/", authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can create coupons" });
    }

    const {
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      usageLimit,
      expiryDate,
      description,
    } = req.body;

    // Validate input
    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["PERCENTAGE", "FIXED"].includes(discountType)) {
      return res.status(400).json({ error: "Invalid discount type" });
    }

    const db = await getConnection();

    await db.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, 
                           max_discount, usage_limit, expiry_date, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        code.toUpperCase(),
        discountType,
        discountValue,
        minOrderAmount || 0,
        maxDiscount || null,
        usageLimit || null,
        expiryDate || null,
        description || null,
      ]
    );

    db.release();

    res.json({
      success: true,
      message: "Coupon created successfully",
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({ error: "Failed to create coupon" });
  }
});

// Admin: List all coupons
router.get("/", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can view all coupons" });
    }

    const db = await getConnection();

    const [coupons] = await db.query(`
      SELECT id, code, discount_type, discount_value, min_order_amount, 
             max_discount, usage_limit, used_count, expiry_date, 
             is_active, created_at
      FROM coupons
      ORDER BY created_at DESC
    `);

    db.release();

    res.json({ coupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
});

// Admin: Update coupon
router.put("/:couponId", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can update coupons" });
    }

    const { isActive, expiryDate } = req.body;

    const db = await getConnection();

    const updates = [];
    const values = [];

    if (isActive !== undefined) {
      updates.push("is_active = ?");
      values.push(isActive ? 1 : 0);
    }

    if (expiryDate !== undefined) {
      updates.push("expiry_date = ?");
      values.push(expiryDate);
    }

    if (updates.length === 0) {
      db.release();
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(req.params.couponId);

    await db.query(`UPDATE coupons SET ${updates.join(", ")} WHERE id = ?`, values);

    db.release();

    res.json({ success: true, message: "Coupon updated" });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({ error: "Failed to update coupon" });
  }
});

module.exports = router;
