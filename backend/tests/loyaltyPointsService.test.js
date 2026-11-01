const test = require("node:test");
const assert = require("node:assert/strict");
const LoyaltyPointsService = require("../src/services/loyaltyPointsService");

test("LoyaltyPointsService.calculateOrderEcoPoints awards BYOB bonus", () => {
  const points = LoyaltyPointsService.calculateOrderEcoPoints(true, false);
  assert.equal(points, LoyaltyPointsService.POINT_RULES.BYOB_BOX);
});

test("LoyaltyPointsService.calculateOrderEcoPoints awards both BYOB and zero waste bonuses", () => {
  const points = LoyaltyPointsService.calculateOrderEcoPoints(true, true);
  assert.equal(points, LoyaltyPointsService.POINT_RULES.BYOB_BOX + LoyaltyPointsService.POINT_RULES.ZERO_WASTE_CONFIRMED);
});

test("LoyaltyPointsService.getUserTier determines appropriate reward tier", () => {
  assert.equal(LoyaltyPointsService.getUserTier(200).tier, "Bronze Green Explorer");
  assert.equal(LoyaltyPointsService.getUserTier(600).tier, "Silver Campus Hero");
  assert.equal(LoyaltyPointsService.getUserTier(1200).tier, "Gold Sustainability Star");
  assert.equal(LoyaltyPointsService.getUserTier(1800).tier, "Diamond Eco Champion");
});
