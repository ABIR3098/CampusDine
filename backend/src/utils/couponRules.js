// Coupon rules that need no database, so the routes and the tests share one copy.

const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"];
const CODE_PATTERN = /^[A-Z0-9_-]{3,50}$/;
const EXPIRY_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;

// Why a coupon cannot be used right now, or null when it can. `coupon` is a row from the coupons table.
function couponUnusable(coupon, now = new Date()) {
  if (!coupon.is_active) return "This coupon is no longer active";
  if (coupon.expiry_date && new Date(coupon.expiry_date) < now) return "This coupon has expired";
  if (coupon.usage_limit && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
    return "This coupon usage limit has been reached";
  }
  return null;
}

// "2026-12-31" → "2026-12-31 23:59:59", "2026-12-31T10:00" → "2026-12-31 10:00:00". Empty means no expiry.
function normalizeExpiry(value) {
  if (value === undefined || value === null || value === "") return { value: null };
  const raw = String(value).trim();
  if (!EXPIRY_PATTERN.test(raw) || Number.isNaN(Date.parse(raw.replace(" ", "T")))) {
    return { error: "Expiry date is invalid" };
  }
  let out = raw.replace("T", " ");
  if (out.length === 10) out += " 23:59:59";
  else if (out.length === 16) out += ":00";
  return { value: out };
}

// Checks the body an admin sends to create a coupon. Returns { error } or { value } ready for the INSERT.
function validateNewCoupon(body = {}) {
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) return { error: "Coupon code must be 3-50 letters, numbers, hyphens, or underscores" };

  if (!DISCOUNT_TYPES.includes(body.discountType)) return { error: "Invalid discount type" };

  const discountValue = Number(body.discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0 || (body.discountType === "PERCENTAGE" && discountValue > 100)) {
    return { error: "Discount value must be positive and percentage discounts cannot exceed 100" };
  }

  const minOrderAmount = body.minOrderAmount === undefined || body.minOrderAmount === "" ? 0 : Number(body.minOrderAmount);
  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) return { error: "Minimum order amount must be zero or greater" };

  let maxDiscount = null;
  if (body.maxDiscount !== undefined && body.maxDiscount !== null && body.maxDiscount !== "") {
    maxDiscount = Number(body.maxDiscount);
    if (!Number.isFinite(maxDiscount) || maxDiscount <= 0) return { error: "Maximum discount must be positive or empty" };
  }

  let usageLimit = null;
  if (body.usageLimit !== undefined && body.usageLimit !== null && body.usageLimit !== "") {
    usageLimit = Number(body.usageLimit);
    if (!Number.isInteger(usageLimit) || usageLimit <= 0) return { error: "Usage limit must be a positive whole number or empty" };
  }

  const expiry = normalizeExpiry(body.expiryDate);
  if (expiry.error) return { error: expiry.error };

  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim().slice(0, 255) : null;

  return {
    value: {
      code, discountType: body.discountType, discountValue, minOrderAmount,
      maxDiscount, usageLimit, expiryDate: expiry.value, description,
    },
  };
}

module.exports = { couponUnusable, normalizeExpiry, validateNewCoupon, DISCOUNT_TYPES };
