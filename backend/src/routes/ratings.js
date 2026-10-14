const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/admin/reviews", verifyToken, requireRole("admin"), async (req, res) => {
  const [reviews] = await pool.query(
    `SELECT mr.id, mr.rating, mr.review, mr.created_at, u.name AS user_name, u.external_id, mi.name AS menu_name
       FROM menu_ratings mr JOIN users u ON u.id = mr.user_id JOIN menu_items mi ON mi.id = mr.menu_item_id ORDER BY mr.created_at DESC LIMIT 500`);
  res.json({ reviews });
});

router.get("/top/items", verifyToken, async (req, res) => {
  const [topItems] = await pool.query(
    `SELECT mi.id, mi.name, ROUND(AVG(mr.rating), 2) AS averageRating, COUNT(mr.id) AS totalRatings
       FROM menu_items mi JOIN menu_ratings mr ON mi.id = mr.menu_item_id GROUP BY mi.id ORDER BY averageRating DESC, totalRatings DESC LIMIT 10`);
  res.json({ topItems });
});

// Submit or update a rating. You can only rate something you actually ordered (and didn't cancel).
router.post("/:menuItemId", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const menuItemId = Number(req.params.menuItemId);
  const rating = Number(req.body.rating);
  const review = req.body.review ? String(req.body.review).trim() : "";
  if (!Number.isInteger(menuItemId)) return res.status(400).json({ error: "Invalid menu item" });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be a whole number from 1 to 5" });
  if (review.length > 500) return res.status(400).json({ error: "Review must be 500 characters or fewer" });
  const [item] = await pool.query("SELECT id FROM menu_items WHERE id = ?", [menuItemId]);
  if (!item.length) return res.status(404).json({ error: "Menu item not found" });
  const [bought] = await pool.query("SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = ? AND oi.menu_item_id = ? AND o.status NOT IN ('Cancelled','Refunded') LIMIT 1", [req.user.id, menuItemId]);
  if (!bought.length) return res.status(403).json({ error: "You can only rate items you have ordered" });
  await pool.query("INSERT INTO menu_ratings (user_id, menu_item_id, rating, review) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = VALUES(review)", [req.user.id, menuItemId, rating, review || null]);
  res.json({ success: true, message: "Rating submitted successfully" });
});

router.get("/:menuItemId", verifyToken, async (req, res) => {
  const [ratings] = await pool.query("SELECT mr.id, mr.rating, mr.review, mr.created_at, u.name FROM menu_ratings mr JOIN users u ON mr.user_id = u.id WHERE mr.menu_item_id = ? ORDER BY mr.created_at DESC LIMIT 100", [req.params.menuItemId]);
  const [[agg]] = await pool.query("SELECT AVG(rating) AS average, COUNT(*) AS total FROM menu_ratings WHERE menu_item_id = ?", [req.params.menuItemId]);
  res.json({ ratings, averageRating: agg.average ? Math.round(agg.average * 100) / 100 : 0, totalRatings: agg.total });
});

router.get("/:menuItemId/my-rating", verifyToken, async (req, res) => {
  const [rows] = await pool.query("SELECT id, rating, review, created_at FROM menu_ratings WHERE user_id = ? AND menu_item_id = ?", [req.user.id, req.params.menuItemId]);
  res.json({ rating: rows[0] || null });
});

router.delete("/:ratingId", verifyToken, async (req, res) => {
  const [r] = await pool.query("DELETE FROM menu_ratings WHERE id = ? AND user_id = ?", [req.params.ratingId, req.user.id]);
  if (!r.affectedRows) return res.status(404).json({ error: "Rating not found" });
  res.json({ success: true, message: "Rating deleted successfully" });
});

module.exports = router;
