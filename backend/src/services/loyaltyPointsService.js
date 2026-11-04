// CampusDine Service: Gamification Eco Points & Sustainability Badges
const LoyaltyPointsService = {
  // Points awarded per action
  POINT_RULES: {
    BYOB_BOX: 25, // Bring own tiffin carrier
    ZERO_WASTE_CONFIRMED: 30, // Finished all food
    HALL_STREAK_DAY: 15, // Consecutive dining days
    EARLY_BREAKFAST: 10 // Eating before 8:30 AM
  },

  // Calculate points gained from an order
  calculateOrderEcoPoints(isBYOB = false, isZeroWaste = false) {
    let earned = 0;
    if (isBYOB) earned += LoyaltyPointsService.POINT_RULES.BYOB_BOX;
    if (isZeroWaste) earned += LoyaltyPointsService.POINT_RULES.ZERO_WASTE_CONFIRMED;
    return earned;
  },

  // Determine user rank title based on accumulated points
  getUserTier(points = 0) {
    if (points >= 1500) return { tier: "Diamond Eco Champion", badge: "💎", discount: 15 };
    if (points >= 1000) return { tier: "Gold Sustainability Star", badge: "🥇", discount: 10 };
    if (points >= 500) return { tier: "Silver Campus Hero", badge: "🥈", discount: 5 };
    return { tier: "Bronze Green Explorer", badge: "🥉", discount: 0 };
  }
};

module.exports = LoyaltyPointsService;
