const express = require("express");
const { getConnection } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Get all menu items with optional filters and search
router.get("/", async (req, res) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      minRating,
      availability,
      sortBy,
    } = req.query;

    let query = `
      SELECT mi.id, mi.name, mi.description, mi.price, mi.category, mi.image_url, 
             mi.is_available, 
             AVG(mr.rating) as averageRating, COUNT(mr.id) as totalRatings,
             COUNT(DISTINCT uf.id) as favoriteCount
      FROM menu_items mi
      LEFT JOIN menu_ratings mr ON mi.id = mr.menu_item_id
      LEFT JOIN user_favorites uf ON mi.id = uf.menu_item_id
      WHERE 1=1
    `;

    const params = [];

    // Search by name or description
    if (search) {
      query += ` AND (mi.name LIKE ? OR mi.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Filter by category
    if (category) {
      query += ` AND mi.category = ?`;
      params.push(category);
    }

    // Filter by price range
    if (minPrice) {
      query += ` AND mi.price >= ?`;
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      query += ` AND mi.price <= ?`;
      params.push(parseFloat(maxPrice));
    }

    // Filter by availability
    if (availability !== undefined) {
      const isAvailable = availability === "true" || availability === "1";
      query += ` AND mi.is_available = ?`;
      params.push(isAvailable ? 1 : 0);
    }

    // Group by to aggregate ratings
    query += ` GROUP BY mi.id`;

    // Filter by minimum rating
    if (minRating) {
      query += ` HAVING AVG(mr.rating) >= ?`;
      params.push(parseFloat(minRating));
    }

    // Sort results
    if (sortBy === "price_asc") {
      query += ` ORDER BY mi.price ASC`;
    } else if (sortBy === "price_desc") {
      query += ` ORDER BY mi.price DESC`;
    } else if (sortBy === "rating") {
      query += ` ORDER BY averageRating DESC`;
    } else if (sortBy === "favorites") {
      query += ` ORDER BY favoriteCount DESC`;
    } else if (sortBy === "newest") {
      query += ` ORDER BY mi.created_at DESC`;
    } else {
      query += ` ORDER BY mi.name ASC`;
    }

    const db = await getConnection();
    const [items] = await db.query(query, params);
    db.release();

    res.json({ items });
  } catch (error) {
    console.error("Error fetching menu items:", error);
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
});

// Get available categories
router.get("/categories/list", async (req, res) => {
  try {
    const db = await getConnection();

    const [item] = await db.query(
      `SELECT mi.id, mi.name, mi.description, mi.price, mi.category, mi.image_url, 
              mi.is_available, AVG(mr.rating) as averageRating, COUNT(mr.id) as totalRatings
       FROM menu_items mi
       LEFT JOIN menu_ratings mr ON mi.id = mr.menu_item_id
       WHERE mi.id = ?
       GROUP BY mi.id`,
      [req.params.id]
    );

    if (item.length === 0) {
      db.release();
      return res.status(404).json({ error: "Menu item not found" });
    }

    // Get recent reviews
    const [reviews] = await db.query(
      `SELECT mr.id, mr.rating, mr.review, u.name, mr.created_at
       FROM menu_ratings mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.menu_item_id = ?
       ORDER BY mr.created_at DESC
       LIMIT 5`,
      [req.params.id]
    );

    db.release();

    res.json({ item: item[0], reviews });
  } catch (error) {
    console.error("Error fetching menu item:", error);
    res.status(500).json({ error: "Failed to fetch menu item" });
  }
});

// Get price range statistics
router.get("/stats/price-range", async (req, res) => {
  try {
    const db = await getConnection();

    const [categories] = await db.query(
      `SELECT DISTINCT category, COUNT(*) as itemCount
       FROM menu_items
       WHERE is_available = 1
       GROUP BY category
       ORDER BY category ASC`
    );

    db.release();

    res.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Get top rated items
router.get("/top/rated", async (req, res) => {
  try {
    const db = await getConnection();

    const [stats] = await db.query(
      `SELECT MIN(price) as minPrice, MAX(price) as maxPrice, AVG(price) as avgPrice
       FROM menu_items
       WHERE is_available = 1`
    );

    db.release();

    res.json(stats[0]);
  } catch (error) {
    console.error("Error fetching price stats:", error);
    res.status(500).json({ error: "Failed to fetch price stats" });
  }
});

// Advanced search with multiple filters
router.post("/search", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const db = await getConnection();

    const [items] = await db.query(
      `SELECT mi.id, mi.name, mi.price, mi.image_url, 
              AVG(mr.rating) as averageRating, COUNT(mr.id) as totalRatings
       FROM menu_items mi
       LEFT JOIN menu_ratings mr ON mi.id = mr.menu_item_id
       WHERE mi.is_available = 1
       GROUP BY mi.id
       HAVING COUNT(mr.id) > 0
       ORDER BY averageRating DESC
       LIMIT ?`,
      [limit]
    );

    db.release();

    res.json({ items });
  } catch (error) {
    console.error("Error fetching top rated items:", error);
    res.status(500).json({ error: "Failed to fetch top rated items" });
  }
});

// Get single menu item with details
router.get("/:id", async (req, res) => {
  try {
    const { query, filters } = req.body;

    let sql = `
      SELECT mi.id, mi.name, mi.description, mi.price, mi.category, mi.image_url, 
             AVG(mr.rating) as averageRating, COUNT(mr.id) as totalRatings
      FROM menu_items mi
      LEFT JOIN menu_ratings mr ON mi.id = mr.menu_item_id
      WHERE mi.is_available = 1
    `;

    const params = [];

    // Text search
    if (query) {
      sql += ` AND (mi.name LIKE ? OR mi.description LIKE ?)`;
      params.push(`%${query}%`, `%${query}%`);
    }

    // Apply filters
    if (filters) {
      if (filters.categories && filters.categories.length > 0) {
        const placeholders = filters.categories.map(() => "?").join(",");
        sql += ` AND mi.category IN (${placeholders})`;
        params.push(...filters.categories);
      }

      if (filters.minPrice !== undefined) {
        sql += ` AND mi.price >= ?`;
        params.push(filters.minPrice);
      }

      if (filters.maxPrice !== undefined) {
        sql += ` AND mi.price <= ?`;
        params.push(filters.maxPrice);
      }
    }

    sql += ` GROUP BY mi.id`;

    if (filters && filters.minRating) {
      sql += ` HAVING AVG(mr.rating) >= ?`;
      params.push(filters.minRating);
    }

    sql += ` ORDER BY mi.name ASC`;

    const db = await getConnection();
    const [items] = await db.query(sql, params);
    db.release();

    res.json({ items, count: items.length });
  } catch (error) {
    console.error("Error searching menu:", error);
    res.status(500).json({ error: "Failed to search menu" });
  }
});

// Admin: Create menu item
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, description, price, category, image_url } = req.body;

    const db = await getConnection();

    // Check if user is admin
    const [user] = await db.query("SELECT role FROM users WHERE id = ?", [
      req.user.id,
    ]);

    if (user.length === 0 || user[0].role !== "admin") {
      db.release();
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!name || !price || price <= 0) {
      db.release();
      return res.status(400).json({ error: "Invalid menu item data" });
    }

    await db.query(
      "INSERT INTO menu_items (name, description, price, category, image_url) VALUES (?, ?, ?, ?, ?)",
      [name, description || null, price, category || null, image_url || null]
    );

    db.release();

    res.json({ success: true, message: "Menu item created" });
  } catch (error) {
    console.error("Error creating menu item:", error);
    res.status(500).json({ error: "Failed to create menu item" });
  }
});

// Admin: Update menu item
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { name, description, price, category, is_available } = req.body;

    const db = await getConnection();

    // Check if user is admin
    const [user] = await db.query("SELECT role FROM users WHERE id = ?", [
      req.user.id,
    ]);

    if (user.length === 0 || user[0].role !== "admin") {
      db.release();
      return res.status(403).json({ error: "Admin access required" });
    }

    let updateQuery = "UPDATE menu_items SET ";
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }
    if (price !== undefined) {
      updates.push("price = ?");
      params.push(price);
    }
    if (category !== undefined) {
      updates.push("category = ?");
      params.push(category);
    }
    if (is_available !== undefined) {
      updates.push("is_available = ?");
      params.push(is_available ? 1 : 0);
    }

    if (updates.length === 0) {
      db.release();
      return res.status(400).json({ error: "No updates provided" });
    }

    updateQuery += updates.join(", ") + " WHERE id = ?";
    params.push(req.params.id);

    await db.query(updateQuery, params);
    db.release();

    res.json({ success: true, message: "Menu item updated" });
  } catch (error) {
    console.error("Error updating menu item:", error);
    res.status(500).json({ error: "Failed to update menu item" });
  }
});

module.exports = router;
