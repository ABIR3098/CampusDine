// CampusDine Service: Hall Residency & Meal Quota Verification
const pool = require("../db");

const HallService = {
  // Check if a user is an active hall resident
  async isResident(userId) {
    const [rows] = await pool.query(
      "SELECT account_type, hall_name, room_number FROM users WHERE id = ?",
      [userId]
    );
    if (rows.length === 0) return false;
    const u = rows[0];
    return u.account_type === "hall_resident" || Boolean(u.hall_name && u.room_number);
  },

  // Calculate monthly hall meal billing total
  async calculateMonthlyHallBill(userId, year, month) {
    try {
      const [rows] = await pool.query(
        "SELECT COUNT(*) as mealCount FROM hall_meal_selections WHERE user_id = ? AND YEAR(meal_date) = ? AND MONTH(meal_date) = ? AND status = 'consumed'",
        [userId, year, month]
      ).catch(() => [[{ mealCount: 0 }]]);

      const count = rows[0]?.mealCount || 0;
      const ratePerMeal = 45; // Default standard hall meal cost
      return {
        year,
        month,
        totalMeals: count,
        totalCost: count * ratePerMeal
      };
    } catch (e) {
      console.error("HallService.calculateMonthlyHallBill error:", e);
      return { year, month, totalMeals: 0, totalCost: 0 };
    }
  }
};

module.exports = HallService;
