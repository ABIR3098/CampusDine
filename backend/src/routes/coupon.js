const express = require("express");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Validate and apply coupon code
router.post("/validate", verifyToken, async (req, res) => {
  let db;
  try {
    const { couponCode, items = [] } = req.body;
    if (!couponCode || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid coupon code or order amount" });
    }

    const normalizedItems = items.map((item) => ({ id: Number(item.id), qty: Number(item.qty) }));
    if (normalizedItems.some((item) => !Number.isInteger(item.id) || item.id <= 0 || !Number.isInteger(item.qty) || item.qty <= 0)) {
      return res.status(400).json({ error: "Cart items must have valid IDs and quantities" });
    }
    const itemIds = [...new Set(normalizedItems.map((item) => item.id))];
    db = await pool.getConnection();

    const [coupon] = await db.query(
      `SELECT id, code, discount_type, discount_value, min_order_amount, max_discount,
              usage_limit, used_count, expiry_date, is_active, applies_to_all_items
       FROM coupons
       WHERE code = ?`,
      [String(couponCode).trim().toUpperCase()]
    );

    if (coupon.length === 0) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    const couponData = coupon[0];

    if (!couponData.is_active) {
      return res.status(400).json({ error: "This coupon is no longer active" });
    }

    if (couponData.expiry_date && new Date(couponData.expiry_date) < new Date()) {
      return res.status(400).json({ error: "This coupon has expired" });
    }

    if (couponData.usage_limit && couponData.used_count >= couponData.usage_limit) {
      return res.status(400).json({ error: "This coupon usage limit has been reached" });
    }

    const [menuRows] = await db.query(
      `SELECT id, price FROM menu_items WHERE id IN (${itemIds.map(() => "?").join(",")})`,
      itemIds
    );
    if (menuRows.length !== itemIds.length) {
      return res.status(400).json({ error: "One or more cart items are unavailable" });
    }
    const subtotal = normalizedItems.reduce((sum, item) => {
      const menuItem = menuRows.find((row) => row.id === item.id);
      return sum + Number(menuItem.price) * item.qty;
    }, 0);

    if (subtotal < Number(couponData.min_order_amount || 0)) {
      return res.status(400).json({
        error: `Minimum order amount required: ৳${couponData.min_order_amount || 0}`,
      });
    }

    const [userUsage] = await db.query(
      "SELECT id FROM coupon_usage WHERE user_id = ? AND coupon_id = ?",
      [req.user.id, couponData.id]
    );

    if (userUsage.length > 0) {
      return res.status(400).json({ error: "You have already used this coupon" });
    }

    let eligibleItemIds = [];
    if (!couponData.applies_to_all_items) {
      const [restrictedItems] = await db.query(
        "SELECT item_id FROM coupon_items WHERE coupon_id = ?",
        [couponData.id]
      );
      eligibleItemIds = restrictedItems.map((row) => row.item_id);

      if (eligibleItemIds.length === 0) {
        return res.status(400).json({ error: "This coupon is not valid for any items in your cart" });
      }

      const eligibleSet = new Set(eligibleItemIds.map(Number));
      const hasEligibleItem = itemIds.some((id) => eligibleSet.has(id));
      if (!hasEligibleItem) {
        return res.status(400).json({ error: "This coupon is valid only for selected menu items" });
      }
    }

    const eligibleSet = new Set(eligibleItemIds.map(Number));
    const eligibleSubtotal = couponData.applies_to_all_items
      ? subtotal
      : normalizedItems.reduce((sum, item) => {
        if (!eligibleSet.has(item.id)) return sum;
        const menuItem = menuRows.find((row) => row.id === item.id);
        return sum + Number(menuItem.price) * item.qty;
      }, 0);

    let discount = 0;
    if (couponData.discount_type === "PERCENTAGE") {
      discount = Math.round(eligibleSubtotal * (Number(couponData.discount_value) / 100));
    } else if (couponData.discount_type === "FIXED") {
      discount = Math.min(Number(couponData.discount_value), eligibleSubtotal);
    }

    if (couponData.max_discount && discount > Number(couponData.max_discount)) {
      discount = Number(couponData.max_discount);
    }

    discount = Math.min(discount, eligibleSubtotal);
    const finalAmount = Math.max(0, subtotal - discount);

    res.json({
      valid: true,
      couponId: couponData.id,
      code: couponData.code,
      discountType: couponData.discount_type,
      discountValue: couponData.discount_value,
      discountAmount: discount,
      originalAmount: subtotal,
      finalAmount,
      eligibleItems: eligibleItemIds,
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({ error: "Failed to validate coupon" });
  } finally {
    if (db) db.release();
  }
});

// Apply coupon to order
router.post("/apply", verifyToken, async (req, res) => {
  try {
    const { couponId, orderId } = req.body;

    if (!couponId || !orderId) {
      return res.status(400).json({ error: "Missing coupon ID or order ID" });
    }

    const db = await pool.getConnection();

    await db.beginTransaction();

    try {
      const [coupon] = await db.query(
        "SELECT discount_type, discount_value, max_discount, applies_to_all_items FROM coupons WHERE id = ?",
        [couponId]
      );

      const [order] = await db.query("SELECT total, user_id, status FROM orders WHERE id = ? AND user_id = ?", [orderId, req.user.id]);
      if (!coupon.length) throw new Error("Coupon not found");
      if (!order.length) throw new Error("Order not found");
      if (order[0].status !== "Received") throw new Error("Order is not eligible for a coupon");

      if (!coupon[0].applies_to_all_items) {
        const [itemMatches] = await db.query(
          `SELECT oi.menu_item_id
           FROM order_items oi
           LEFT JOIN coupon_items ci ON ci.coupon_id = ? AND ci.item_id = oi.menu_item_id
           WHERE oi.order_id = ? AND ci.id IS NOT NULL`,
          [couponId, orderId]
        );

        if (itemMatches.length === 0) {
          throw new Error("This coupon does not apply to any item in this order");
        }
      }

      await db.query("INSERT INTO coupon_usage (user_id, coupon_id, order_id) VALUES (?, ?, ?)", [req.user.id, couponId, orderId]);
      await db.query("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", [couponId]);
      let discount = 0;
      if (coupon[0].discount_type === "PERCENTAGE") {
        discount = Math.round(order[0].total * (coupon[0].discount_value / 100));
      } else {
        discount = Number(coupon[0].discount_value);
      }

      if (coupon[0].max_discount && discount > Number(coupon[0].max_discount)) {
        discount = Number(coupon[0].max_discount);
      }

      const newAmount = Math.max(0, Number(order[0].total) - discount);

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
router.get("/available", verifyToken, async (req, res) => {
  try {
    const db = await pool.getConnection();

    const [coupons] = await db.query(
      `SELECT c.id, c.code, c.discount_type, c.discount_value, c.min_order_amount,
              c.max_discount, c.expiry_date, c.description, c.applies_to_all_items,
              GROUP_CONCAT(ci.item_id) AS eligible_item_ids
       FROM coupons c
       LEFT JOIN coupon_items ci ON ci.coupon_id = c.id
       WHERE c.is_active = 1
       AND (c.expiry_date IS NULL OR c.expiry_date > NOW())
       AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit)
       GROUP BY c.id
       ORDER BY c.expiry_date ASC`
    );

    db.release();

    res.json({ coupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
});

// Admin: Create new coupon
router.post("/", verifyToken, async (req, res) => {
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

    const db = await pool.getConnection();

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
router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can view all coupons" });
    }

    const db = await pool.getConnection();

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
router.put("/:couponId", verifyToken, async (req, res) => {
  let db;
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can update coupons" });
    }

    const couponId = Number(req.params.couponId);
    if (!Number.isInteger(couponId) || couponId <= 0) {
      return res.status(400).json({ error: "Invalid coupon ID" });
    }

    db = await pool.getConnection();
    const [rows] = await db.query(
      "SELECT code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, expiry_date, is_active FROM coupons WHERE id = ?",
      [couponId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Coupon not found" });

    const current = rows[0];
    const updates = [];
    const values = [];
    const body = req.body;

    if (body.code !== undefined) {
      const code = String(body.code).trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,50}$/.test(code)) {
        return res.status(400).json({ error: "Coupon code must be 3-50 letters, numbers, hyphens, or underscores" });
      }
      updates.push("code = ?");
      values.push(code);
    }

    const discountType = body.discountType === undefined ? current.discount_type : body.discountType;
    const discountValue = body.discountValue === undefined ? Number(current.discount_value) : Number(body.discountValue);
    if (body.discountType !== undefined && !["PERCENTAGE", "FIXED"].includes(discountType)) {
      return res.status(400).json({ error: "Discount type must be PERCENTAGE or FIXED" });
    }
    if (body.discountValue !== undefined || body.discountType !== undefined) {
      if (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === "PERCENTAGE" && discountValue > 100)) {
        return res.status(400).json({ error: "Discount value must be positive and percentage discounts cannot exceed 100" });
      }
      if (body.discountType !== undefined) {
        updates.push("discount_type = ?");
        values.push(discountType);
      }
      if (body.discountValue !== undefined) {
        updates.push("discount_value = ?");
        values.push(discountValue);
      }
    }

    if (body.minOrderAmount !== undefined) {
      const minOrderAmount = Number(body.minOrderAmount);
      if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
        return res.status(400).json({ error: "Minimum order amount must be zero or greater" });
      }
      updates.push("min_order_amount = ?");
      values.push(minOrderAmount);
    }

    if (body.maxDiscount !== undefined) {
      const maxDiscount = body.maxDiscount === null || body.maxDiscount === "" ? null : Number(body.maxDiscount);
      if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) {
        return res.status(400).json({ error: "Maximum discount must be positive or empty" });
      }
      updates.push("max_discount = ?");
      values.push(maxDiscount);
    }

    if (body.usageLimit !== undefined) {
      const usageLimit = body.usageLimit === null || body.usageLimit === "" ? null : Number(body.usageLimit);
      if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) {
        return res.status(400).json({ error: "Usage limit must be a positive whole number or empty" });
      }
      updates.push("usage_limit = ?");
      values.push(usageLimit);
    }

    if (body.expiryDate !== undefined) {
      let expiryDate = null;
      if (body.expiryDate) {
        const rawDate = String(body.expiryDate).trim();
        if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(rawDate) || Number.isNaN(Date.parse(rawDate.replace(" ", "T")))) {
          return res.status(400).json({ error: "Expiry date is invalid" });
        }
        expiryDate = rawDate.replace("T", " ");
        if (expiryDate.length === 16) expiryDate += ":00";
        if (expiryDate.length === 10) expiryDate += " 23:59:59";
      }
      updates.push("expiry_date = ?");
      values.push(expiryDate);
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return res.status(400).json({ error: "isActive must be true or false" });
      }
      updates.push("is_active = ?");
      values.push(body.isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(couponId);
    await db.query(`UPDATE coupons SET ${updates.join(", ")} WHERE id = ?`, values);
    res.json({ success: true, message: "Coupon updated" });
  } catch (error) {
    console.error("Error updating coupon:", error);
    const status = error.status || (error.code === "ER_DUP_ENTRY" ? 409 : 500);
    res.status(status).json({ error: error.code === "ER_DUP_ENTRY" ? "That coupon code is already in use" : error.message || "Failed to update coupon" });
  } finally {
    if (db) db.release();
  }
});

module.exports = router;
