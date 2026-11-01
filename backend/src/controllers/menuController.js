// CampusDine Controller: Menu & Food Catalog Management
const pool = require("../db");

const MenuController = {
  // List all available menu items
  async listItems(req, res) {
    try {
      const { category, restaurantId, inStock } = req.query;
      let query = "SELECT id, restaurant_id, name, description, price, category, image_url, is_available, stock_qty FROM menu_items WHERE 1=1";
      const params = [];

      if (category && category !== "all") {
        query += " AND category = ?";
        params.push(category);
      }
      if (restaurantId) {
        query += " AND restaurant_id = ?";
        params.push(restaurantId);
      }
      if (inStock === "true") {
        query += " AND is_available = 1 AND stock_qty > 0";
      }

      query += " ORDER BY category, name ASC";
      const [items] = await pool.query(query, params);
      return res.json(items);
    } catch (error) {
      console.error("MenuController.listItems error:", error);
      return res.status(500).json({ error: "Failed to retrieve menu items" });
    }
  },

  // Create new food item (Admin)
  async createItem(req, res) {
    try {
      const { restaurantId, name, description, price, category, imageUrl, stockQty } = req.body;
      if (!name || price == null) {
        return res.status(400).json({ error: "Item name and price are required" });
      }

      const [result] = await pool.query(
        "INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, stock_qty, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
        [restaurantId || 1, name, description || "", Number(price), category || "lunch", imageUrl || null, stockQty || 50]
      );

      return res.status(201).json({ id: result.insertId, message: "Menu item created successfully" });
    } catch (error) {
      console.error("MenuController.createItem error:", error);
      return res.status(500).json({ error: "Failed to create menu item" });
    }
  },

  // Update menu item
  async updateItem(req, res) {
    try {
      const { id } = req.params;
      const { name, description, price, category, isAvailable, stockQty, imageUrl } = req.body;

      await pool.query(
        "UPDATE menu_items SET name = COALESCE(?, name), description = COALESCE(?, description), price = COALESCE(?, price), category = COALESCE(?, category), is_available = COALESCE(?, is_available), stock_qty = COALESCE(?, stock_qty), image_url = COALESCE(?, image_url) WHERE id = ?",
        [name, description, price, category, isAvailable, stockQty, imageUrl, id]
      );

      return res.json({ message: "Menu item updated successfully" });
    } catch (error) {
      console.error("MenuController.updateItem error:", error);
      return res.status(500).json({ error: "Failed to update menu item" });
    }
  },

  // Delete menu item
  async deleteItem(req, res) {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM menu_items WHERE id = ?", [id]);
      return res.json({ message: "Menu item deleted successfully" });
    } catch (error) {
      console.error("MenuController.deleteItem error:", error);
      return res.status(500).json({ error: "Failed to delete menu item" });
    }
  }
};

module.exports = MenuController;
