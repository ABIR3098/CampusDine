const express = require("express");
const { getConnection } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Add item to favorites
router.post("/:menuItemId", authenticateToken, async (req, res) => {
  try {
    const menuItemId = req.params.menuItemId;

    const db = await getConnection();

    // Check if menu item exists
    const [menuItem] = await db.query(
      "SELECT id, name FROM menu_items WHERE id = ?",
      [menuItemId]
    );

    if (menuItem.length === 0) {
      db.release();
      return res.status(404).json({ error: "Menu item not found" });
    }

    // Check if already in favorites
    const [existing] = await db.query(
      "SELECT id FROM user_favorites WHERE user_id = ? AND menu_item_id = ?",
      [req.user.id, menuItemId]
    );

    if (existing.length > 0) {
      db.release();
      return res.status(400).json({ error: "Item already in favorites" });
    }

    // Add to favorites
    await db.query(
      "INSERT INTO user_favorites (user_id, menu_item_id) VALUES (?, ?)",
      [req.user.id, menuItemId]
    );

    db.release();

    res.json({
      success: true,
      message: `${menuItem[0].name} added to favorites`,
    });
  } catch (error) {
    console.error("Error adding to favorites:", error);
    res.status(500).json({ error: "Failed to add to favorites" });
  }
});

// Remove item from favorites
router.delete("/:menuItemId", authenticateToken, async (req, res) => {
  try {
    const menuItemId = req.params.menuItemId;

    const db = await getConnection();

    const [favorite] = await db.query(
      "SELECT id FROM user_favorites WHERE user_id = ? AND menu_item_id = ?",
      [req.user.id, menuItemId]
    );

    if (favorite.length === 0) {
      db.release();
      return res.status(404).json({ error: "Item not in favorites" });
    }

    await db.query(
      "DELETE FROM user_favorites WHERE user_id = ? AND menu_item_id = ?",
      [req.user.id, menuItemId]
    );

    db.release();

    res.json({
      success: true,
      message: "Item removed from favorites",
    });
  } catch (error) {
    console.error("Error removing from favorites:", error);
    res.status(500).json({ error: "Failed to remove from favorites" });
  }
});

// Get user's favorites
router.get("/", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();

    const [favorites] = await db.query(
      `SELECT mi.id, mi.name, mi.description, mi.price, mi.category, mi.image_url,
              AVG(mr.rating) as averageRating, COUNT(mr.id) as totalRatings
       FROM user_favorites uf
       JOIN menu_items mi ON uf.menu_item_id = mi.id
       LEFT JOIN menu_ratings mr ON mi.id = mr.menu_item_id
       WHERE uf.user_id = ?
       GROUP BY mi.id
       ORDER BY uf.created_at DESC`,
      [req.user.id]
    );

    db.release();

    res.json({ favorites });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

// Check if item is favorited
router.get("/:menuItemId/is-favorite", authenticateToken, async (req, res) => {
  try {
    const menuItemId = req.params.menuItemId;

    const db = await getConnection();

    const [favorite] = await db.query(
      "SELECT id FROM user_favorites WHERE user_id = ? AND menu_item_id = ?",
      [req.user.id, menuItemId]
    );

    db.release();

    res.json({
      isFavorite: favorite.length > 0,
    });
  } catch (error) {
    console.error("Error checking favorite status:", error);
    res.status(500).json({ error: "Failed to check favorite status" });
  }
});

// Get favorite count for a menu item
router.get("/:menuItemId/count", async (req, res) => {
  try {
    const menuItemId = req.params.menuItemId;

    const db = await getConnection();

    const [count] = await db.query(
      "SELECT COUNT(*) as total FROM user_favorites WHERE menu_item_id = ?",
      [menuItemId]
    );

    db.release();

    res.json({
      count: count[0].total,
    });
  } catch (error) {
    console.error("Error getting favorite count:", error);
    res.status(500).json({ error: "Failed to get favorite count" });
  }
});

// Get most favorited items
router.get("/trending/items", async (req, res) => {
  try {
    const db = await getConnection();

    const [trending] = await db.query(
      `SELECT mi.id, mi.name, mi.price, COUNT(uf.id) as favoriteCount
       FROM user_favorites uf
       JOIN menu_items mi ON uf.menu_item_id = mi.id
       GROUP BY mi.id
       ORDER BY favoriteCount DESC
       LIMIT 10`
    );

    db.release();

    res.json({ trending });
  } catch (error) {
    console.error("Error fetching trending items:", error);
    res.status(500).json({ error: "Failed to fetch trending items" });
  }
});

// Quick order from favorites (place order with default quantity)
router.post("/:menuItemId/quick-order", authenticateToken, async (req, res) => {
  try {
    const menuItemId = req.params.menuItemId;
    const { mealDate, quantity } = req.body;

    if (!mealDate || !quantity || quantity <= 0) {
      return res.status(400).json({ error: "Invalid meal date or quantity" });
    }

    // Validate meal date
    const orderDate = new Date(mealDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (orderDate < today) {
      return res.status(400).json({
        error: "Cannot place order for past dates",
      });
    }

    const db = await getConnection();

    // Get menu item price
    const [menuItem] = await db.query(
      "SELECT price FROM menu_items WHERE id = ?",
      [menuItemId]
    );

    if (menuItem.length === 0) {
      db.release();
      return res.status(404).json({ error: "Menu item not found" });
    }

    const totalAmount = menuItem[0].price * quantity;

    // Check wallet balance
    const [user] = await db.query(
      "SELECT wallet_balance FROM users WHERE id = ?",
      [req.user.id]
    );

    if (user[0].wallet_balance < totalAmount) {
      db.release();
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    const { v4: uuidv4 } = require("uuid");
    const orderToken = uuidv4();

    await db.beginTransaction();

    try {
      // Create order
      const [orderResult] = await db.query(
        `INSERT INTO orders (token, user_id, total, meal_date, status, payment_method)
         VALUES (?, ?, ?, ?, 'Received', 'wallet')`,
        [orderToken, req.user.id, totalAmount, mealDate]
      );

      const orderId = orderResult.insertId;

      // Add order item
      await db.query(
        "INSERT INTO order_items (order_id, menu_item_id, name, price, qty) SELECT ?, id, name, price, ? FROM menu_items WHERE id = ?",
        [orderId, quantity, menuItemId]
      );

      // Deduct from wallet
      await db.query(
        "UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?",
        [totalAmount, req.user.id]
      );

      // Log transaction
      await db.query(
        "INSERT INTO wallet_transactions (user_id, amount, label) VALUES (?, ?, ?)",
        [req.user.id, -totalAmount, `Quick Order #${orderId}`]
      );

      await db.commit();
      db.release();

      res.json({
        success: true,
        orderId,
        orderToken,
        totalAmount,
        message: "Quick order placed successfully",
      });
    } catch (error) {
      await db.rollback();
      db.release();
      throw error;
    }
  } catch (error) {
    console.error("Error placing quick order:", error);
    res.status(500).json({ error: "Failed to place quick order" });
  }
});

module.exports = router;
