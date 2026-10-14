const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { checkCoupon } = require("../utils/coupons");

const router = express.Router();

// POST /validate { couponCode, orderAmount } — preview only; the order re-checks and applies it atomically.
router.post("/validate", verifyToken, async (req, res) => {
  const { couponCode } = req.body;
  const orderAmount = Number(req.body.orderAmount);
  if (!couponCode || !Number.isFinite(orderAmount) || orderAmount <= 0) return res.status(400).json({ error: "Invalid coupon code or order amount" });
  const { coupon, discount } = await checkCoupon(pool, couponCode, req.user.id, orderAmount);
  res.json({ valid: true, couponId: coupon.id, code: coupon.code, discountType: coupon.discount_type, discountValue: coupon.discount_value, discountAmount: discount, originalAmount: orderAmount, finalAmount: Math.round((orderAmount - discount) * 100) / 100 });
});

// The coupon is now applied INSIDE POST /api/orders (couponCode). The old endpoint applied it
// a second time after the order existed, which always failed and could double-discount.
router.post("/apply", verifyToken, (req, res) => res.status(410).json({ error: "Deprecated: send couponCode with POST /api/orders instead" }));

// Coupons this user can still use
router.get("/available", verifyToken, async (req, res) => {
  const [coupons] = await pool.query(
    `SELECT c.id, c.code, c.discount_type, c.discount_value, c.min_order_amount, c.max_discount, c.expiry_date, c.description
       FROM coupons c
      WHERE c.is_active = 1 AND (c.owner_user_id IS NULL OR c.owner_user_id = ?) AND (c.expiry_date IS NULL OR c.expiry_date > NOW()) AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit)
        AND NOT EXISTS (SELECT 1 FROM coupon_usage u WHERE u.coupon_id = c.id AND u.user_id = ?)
      ORDER BY c.expiry_date IS NULL, c.expiry_date ASC`, [req.user.id, req.user.id]);
  res.json({ coupons });
});

router.use(verifyToken, requireRole("admin"));

function parseCoupon(b, { partial }) {
  const v = {}; const bad = (error) => ({ error });
  if (b.code !== undefined || !partial) { const code = String(b.code || "").trim().toUpperCase(); if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return bad("code must be 3-40 letters/numbers"); v.code = code; }
  const type = b.discountType ?? b.discount_type;
  if (type !== undefined || !partial) { if (!["PERCENTAGE", "FIXED"].includes(type)) return bad("discountType must be PERCENTAGE or FIXED"); v.discount_type = type; }
  const val = b.discountValue ?? b.discount_value;
  if (val !== undefined || !partial) { const n = Number(val); if (!Number.isFinite(n) || n <= 0) return bad("discountValue must be greater than 0"); v.discount_value = n; }
  if (v.discount_type === "PERCENTAGE" && v.discount_value > 100) return bad("percentage cannot exceed 100");
  const num = (key, alt, col, min = 0) => { const raw = b[key] ?? b[alt]; if (raw === undefined) return null; if (raw === null || raw === "") { v[col] = null; return null; } const n = Number(raw); if (!Number.isFinite(n) || n < min) return `${key} must be a number ≥ ${min}`; v[col] = n; return null; };
  for (const e of [num("minOrderAmount", "min_order_amount", "min_order_amount"), num("maxDiscount", "max_discount", "max_discount"), num("usageLimit", "usage_limit", "usage_limit", 1)]) if (e) return bad(e);
  const exp = b.expiryDate ?? b.expiry_date; if (exp !== undefined) { if (exp && Number.isNaN(Date.parse(exp))) return bad("expiryDate is not a valid date"); v.expiry_date = exp || null; }
  if (b.description !== undefined) v.description = b.description ? String(b.description).slice(0, 255) : null;
  const active = b.isActive ?? b.is_active; if (active !== undefined) v.is_active = active ? 1 : 0;
  return { value: v };
}

router.post("/", async (req, res) => {
  const { error, value } = parseCoupon(req.body, { partial: false });
  if (error) return res.status(400).json({ error });
  value.min_order_amount = value.min_order_amount ?? 0;
  const cols = Object.keys(value);
  try { await pool.query(`INSERT INTO coupons (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((c) => value[c])); }
  catch (err) { if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A coupon with this code already exists" }); throw err; }
  res.status(201).json({ success: true, message: "Coupon created successfully" });
});

router.get("/", async (req, res) => {
  const [coupons] = await pool.query("SELECT id, code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, used_count, expiry_date, description, is_active, created_at FROM coupons WHERE owner_user_id IS NULL ORDER BY created_at DESC");
  res.json({ coupons });
});

router.put("/:couponId", async (req, res) => {
  const { error, value } = parseCoupon(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(value);
  if (!cols.length) return res.status(400).json({ error: "No fields to update" });
  const [r] = await pool.query(`UPDATE coupons SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [...cols.map((c) => value[c]), req.params.couponId]);
  if (!r.affectedRows) return res.status(404).json({ error: "Coupon not found" });
  res.json({ success: true, message: "Coupon updated" });
});

module.exports = router;
