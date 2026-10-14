// One implementation of coupon maths so the price shown in the cart is
// EXACTLY what the order charges (previously they rounded differently).
const round2 = (n) => Math.round(Number(n) * 100) / 100;

function computeDiscount(coupon, amount) {
  let discount = coupon.discount_type === "PERCENTAGE" ? (Number(amount) * Number(coupon.discount_value)) / 100 : Number(coupon.discount_value);
  if (coupon.max_discount) discount = Math.min(discount, Number(coupon.max_discount));
  return round2(Math.min(Math.max(discount, 0), Number(amount)));
}

// Throws {status,message} when the coupon can't be used. `q` = pool or connection.
async function checkCoupon(q, code, userId, amount, { lock = false } = {}) {
  const [rows] = await q.query(`SELECT * FROM coupons WHERE code = ? ${lock ? "FOR UPDATE" : ""}`, [String(code || "").trim().toUpperCase()]);
  const c = rows[0];
  if (!c || (c.owner_user_id && c.owner_user_id !== userId)) throw { status: 404, message: "Coupon not found" }; // personal reward coupons are private
  if (!c.is_active) throw { status: 400, message: "This coupon is no longer active" };
  if (c.expiry_date && new Date(c.expiry_date) < new Date()) throw { status: 400, message: "This coupon has expired" };
  if (c.usage_limit && c.used_count >= c.usage_limit) throw { status: 400, message: "This coupon usage limit has been reached" };
  if (Number(amount) < Number(c.min_order_amount || 0)) throw { status: 400, message: `Minimum order amount required: ৳${c.min_order_amount}` };
  const [used] = await q.query("SELECT id FROM coupon_usage WHERE coupon_id = ? AND user_id = ?", [c.id, userId]);
  if (used.length) throw { status: 400, message: "You have already used this coupon" };
  return { coupon: c, discount: computeDiscount(c, amount) };
}

module.exports = { computeDiscount, checkCoupon, round2 };
