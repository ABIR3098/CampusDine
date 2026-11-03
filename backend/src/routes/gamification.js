// CampusDine Route: Gamification, Daily Lucky Spin & Eco Badges
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const CouponController = require("../controllers/couponController");
const pool = require("../db");

const MONTH_START = "DATE_FORMAT(CURDATE(), '%Y-%m-01')";
function badgeFor(orders) {
  if (orders >= 20) return "Top Diner";
  if (orders >= 10) return "Regular";
  return "Rising Diner";
}

// Claim daily spin wheel reward
router.post("/spin/claim", verifyToken, CouponController.claimDailySpin);

// Get leaderboard top rankings
router.get("/leaderboard", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, COUNT(o.id) AS orders
         FROM orders o JOIN users u ON u.id = o.user_id
        WHERE o.status <> 'Cancelled' AND u.role IN ('student', 'teacher') AND o.created_at >= ${MONTH_START}
        GROUP BY u.id, u.name
        ORDER BY orders DESC, u.id ASC
        LIMIT 10`
    );
    const board = rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      orders: Number(r.orders),
      badge: badgeFor(Number(r.orders)),
      isCurrent: r.id === req.user.id,
    }));

    // If the current user is not in the top 10, add their own row at the end.
    if (!board.some((b) => b.isCurrent)) {
      const [[mine]] = await pool.query(
        `SELECT COUNT(*) AS orders FROM orders WHERE user_id = ? AND status <> 'Cancelled' AND created_at >= ${MONTH_START}`,
        [req.user.id]
      );
      const myOrders = Number(mine.orders);
      if (myOrders > 0) {
        const [[ahead]] = await pool.query(
          `SELECT COUNT(*) AS c FROM (
             SELECT user_id, COUNT(*) AS n FROM orders
              WHERE status <> 'Cancelled' AND created_at >= ${MONTH_START}
              GROUP BY user_id HAVING n > ?
           ) t`,
          [myOrders]
        );
        board.push({
          rank: Number(ahead.c) + 1,
          name: req.user.name || "You",
          orders: myOrders,
          badge: badgeFor(myOrders),
          isCurrent: true,
        });
      }
    }
    return res.json(board);
  } catch (error) {
    console.error("Gamification leaderboard error:", error);
    return res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

module.exports = router;
