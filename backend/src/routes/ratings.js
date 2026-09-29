const express = require("express");
const { getConnection } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.get("/admin/reviews", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  try {
    const db = await getConnection();
    const [reviews] = await db.query(
      `SELECT mr.id, mr.rating, mr.review, mr.created_at, u.name AS user_name, u.external_id, mi.name AS menu_name
       FROM menu_ratings mr
       JOIN users u ON u.id = mr.user_id
       JOIN menu_items mi ON mi.id = mr.menu_item_id
       ORDER BY mr.created_at DESC`
    );
    db.release();
    res.json({ reviews });
  } catch (error) {
    console.error("Error fetching admin reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Get top-rated menu items
router.get("/top/items", async (req, res) => {
  try {
    const db = await getConnection();

    const [topItems] = await db.query(
      `SELECT mi.id, mi.name, AVG(mr.rating) as averageRating, COUNT(mr.id) as totalRatings
       FROM menu_items mi
       LEFT JOIN menu_ratings mr ON mi.id = mr.menu_item_id
       GROUP BY mi.id
       HAVING totalRatings > 0
       ORDER BY averageRating DESC
       LIMIT 10`
    );

    db.release();

    res.json({ topItems });
  } catch (error) {
    console.error("Error fetching top items:", error);
    res.status(500).json({ error: "Failed to fetch top items" });
  }
});

// Submit or update rating for a menu item
router.post("/:menuItemId", authenticateToken, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const menuItemId = req.params.menuItemId;

    // Validate rating (1-5 stars)
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Validate review (optional, but max length if provided)
    if (review && review.trim().length > 500) {
      return res.status(400).json({ error: "Review must be less than 500 characters" });
    }

    const db = await getConnection();

    // Check if menu item exists
    const [menuItem] = await db.query(
      "SELECT id FROM menu_items WHERE id = ?",
      [menuItemId]
    );

    if (menuItem.length === 0) {
      db.release();
      return res.status(404).json({ error: "Menu item not found" });
    }

    // Check if user has ordered this item before (optional - for authenticity)
    const [orderedItem] = await db.query(
      `SELECT oi.id FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.menu_item_id = ?`,
      [req.user.id, menuItemId]
    );

    // Check if rating already exists
    const [existingRating] = await db.query(
      "SELECT id FROM menu_ratings WHERE user_id = ? AND menu_item_id = ?",
      [req.user.id, menuItemId]
    );

    if (existingRating.length > 0) {
      // Update existing rating
      await db.query(
        "UPDATE menu_ratings SET rating = ?, review = ?, updated_at = NOW() WHERE user_id = ? AND menu_item_id = ?",
        [rating, review || null, req.user.id, menuItemId]
      );
    } else {
      // Insert new rating
      await db.query(
        "INSERT INTO menu_ratings (user_id, menu_item_id, rating, review) VALUES (?, ?, ?, ?)",
        [req.user.id, menuItemId, rating, review || null]
      );
    }

    db.release();

    res.json({
      success: true,
      message: "Rating submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting rating:", error);
    res.status(500).json({ error: "Failed to submit rating" });
  }
});

// Get ratings for a menu item
router.get("/:menuItemId", async (req, res) => {
  try {
    const menuItemId = req.params.menuItemId;

    const db = await getConnection();

    // Get all ratings for the item
    const [ratings] = await db.query(
      `SELECT mr.id, mr.rating, mr.review, mr.created_at, u.name
       FROM menu_ratings mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.menu_item_id = ?
       ORDER BY mr.created_at DESC`,
      [menuItemId]
    );

    // Calculate average rating
    const [avgRating] = await db.query(
      `SELECT AVG(rating) as average, COUNT(*) as total
       FROM menu_ratings
       WHERE menu_item_id = ?`,
      [menuItemId]
    );

    db.release();

    res.json({
      ratings,
      averageRating: avgRating[0].average ? parseFloat(avgRating[0].average.toFixed(2)) : 0,
      totalRatings: avgRating[0].total,
    });
  } catch (error) {
    console.error("Error fetching ratings:", error);
    res.status(500).json({ error: "Failed to fetch ratings" });
  }
});

// Get user's own rating for a menu item
router.get("/:menuItemId/my-rating", authenticateToken, async (req, res) => {
  try {
    const menuItemId = req.params.menuItemId;

    const db = await getConnection();

    const [rating] = await db.query(
      "SELECT id, rating, review, created_at FROM menu_ratings WHERE user_id = ? AND menu_item_id = ?",
      [req.user.id, menuItemId]
    );

    db.release();

    if (rating.length === 0) {
      return res.json({ rating: null });
    }

    res.json({ rating: rating[0] });
  } catch (error) {
    console.error("Error fetching user's rating:", error);
    res.status(500).json({ error: "Failed to fetch rating" });
  }
});

// Delete rating
router.delete("/:ratingId", authenticateToken, async (req, res) => {
  try {
    const ratingId = req.params.ratingId;

    const db = await getConnection();

    // Check if rating belongs to user
    const [rating] = await db.query(
      "SELECT id FROM menu_ratings WHERE id = ? AND user_id = ?",
      [ratingId, req.user.id]
    );

    if (rating.length === 0) {
      db.release();
      return res.status(404).json({ error: "Rating not found" });
    }

    await db.query("DELETE FROM menu_ratings WHERE id = ?", [ratingId]);

    db.release();

    res.json({
      success: true,
      message: "Rating deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting rating:", error);
    res.status(500).json({ error: "Failed to delete rating" });
  }
});

module.exports = router;
