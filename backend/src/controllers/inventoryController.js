// CampusDine Controller: Canteen Inventory & Raw Material Management
const pool = require("../db");

const InventoryController = {
  // Get active inventory stock list
  async getInventory(req, res) {
    try {
      const [items] = await pool.query(
        "SELECT id, item_name, category, current_stock, unit, reorder_level, unit_cost FROM inventory_items ORDER BY item_name ASC"
      ).catch(() => [[]]);

      return res.json(items);
    } catch (error) {
      console.error("InventoryController.getInventory error:", error);
      return res.status(500).json({ error: "Failed to retrieve inventory items" });
    }
  },

  // Record stock purchase / restock
  async recordRestock(req, res) {
    try {
      const { itemId, quantityAdded, costTotal, supplierName } = req.body;
      const numQty = Number(quantityAdded);

      if (!itemId || numQty <= 0) {
        return res.status(400).json({ error: "Valid item ID and positive quantity required" });
      }

      await pool.query(
        "UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = NOW() WHERE id = ?",
        [numQty, itemId]
      );

      return res.json({ message: "Stock restocked successfully", added: numQty });
    } catch (error) {
      console.error("InventoryController.recordRestock error:", error);
      return res.status(500).json({ error: "Failed to restock inventory" });
    }
  }
};

module.exports = InventoryController;
