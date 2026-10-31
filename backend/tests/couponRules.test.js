const test = require("node:test");
const assert = require("node:assert/strict");
const { couponUnusable, normalizeExpiry, validateNewCoupon } = require("../src/utils/couponRules");

const live = { is_active: 1, expiry_date: null, usage_limit: null, used_count: 0 };
const NOW = new Date("2026-10-31T00:00:00Z");

test("a normal active coupon can be used", () => {
  assert.equal(couponUnusable(live, NOW), null);
});

test("inactive, expired and used-up coupons are refused", () => {
  assert.match(couponUnusable({ ...live, is_active: 0 }, NOW), /no longer active/);
  assert.match(couponUnusable({ ...live, expiry_date: "2026-10-01 00:00:00" }, NOW), /expired/);
  assert.match(couponUnusable({ ...live, usage_limit: 5, used_count: 5 }, NOW), /usage limit/);
});

test("a coupon with uses left or a future expiry is fine", () => {
  assert.equal(couponUnusable({ ...live, usage_limit: 5, used_count: 4, expiry_date: "2026-12-31 23:59:59" }, NOW), null);
});

test("normalizeExpiry fills in missing time parts", () => {
  assert.deepEqual(normalizeExpiry("2026-12-31"), { value: "2026-12-31 23:59:59" });
  assert.deepEqual(normalizeExpiry("2026-12-31T10:30"), { value: "2026-12-31 10:30:00" });
  assert.deepEqual(normalizeExpiry("2026-12-31 10:30:15"), { value: "2026-12-31 10:30:15" });
  assert.deepEqual(normalizeExpiry(""), { value: null });
  assert.deepEqual(normalizeExpiry(null), { value: null });
});

test("normalizeExpiry rejects bad text", () => {
  assert.ok(normalizeExpiry("tomorrow").error);
  assert.ok(normalizeExpiry("2026-13-45").error);
});

const good = { code: " save10 ", discountType: "PERCENTAGE", discountValue: "10" };

test("validateNewCoupon cleans a minimal coupon", () => {
  const r = validateNewCoupon(good);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.value, {
    code: "SAVE10", discountType: "PERCENTAGE", discountValue: 10, minOrderAmount: 0,
    maxDiscount: null, usageLimit: null, expiryDate: null, description: null,
  });
});

test("validateNewCoupon reads every optional field", () => {
  const r = validateNewCoupon({
    ...good, minOrderAmount: "100", maxDiscount: "50", usageLimit: "20",
    expiryDate: "2026-12-31", description: "  Winter offer  ",
  });
  assert.equal(r.value.minOrderAmount, 100);
  assert.equal(r.value.maxDiscount, 50);
  assert.equal(r.value.usageLimit, 20);
  assert.equal(r.value.expiryDate, "2026-12-31 23:59:59");
  assert.equal(r.value.description, "Winter offer");
});

test("validateNewCoupon rejects bad input", () => {
  assert.ok(validateNewCoupon({}).error);
  assert.ok(validateNewCoupon({ ...good, code: "a" }).error);
  assert.ok(validateNewCoupon({ ...good, code: "bad code!" }).error);
  assert.ok(validateNewCoupon({ ...good, code: 12345 }).value); // numbers are text codes
  assert.ok(validateNewCoupon({ ...good, discountType: "HALF" }).error);
  assert.ok(validateNewCoupon({ ...good, discountValue: 150 }).error);
  assert.ok(validateNewCoupon({ ...good, discountValue: -5 }).error);
  assert.ok(validateNewCoupon({ ...good, discountValue: "abc" }).error);
  assert.ok(validateNewCoupon({ ...good, minOrderAmount: -1 }).error);
  assert.ok(validateNewCoupon({ ...good, maxDiscount: 0 }).error);
  assert.ok(validateNewCoupon({ ...good, usageLimit: 2.5 }).error);
  assert.ok(validateNewCoupon({ ...good, expiryDate: "soon" }).error);
});

test("a fixed discount may be above 100", () => {
  assert.equal(validateNewCoupon({ code: "FLAT200", discountType: "FIXED", discountValue: 200 }).value.discountValue, 200);
});
