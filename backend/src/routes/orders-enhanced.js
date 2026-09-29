const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { getConnection } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Place a new order
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { items, mealDate } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid items" });
    }

    // CRITICAL FIX: Validate meal date - only allow current or future dates
    const orderDate = new Date(`${mealDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!mealDate || Number.isNaN(orderDate.getTime()) || orderDate < today) {
      return res.status(400).json({ 
        error: "Cannot place order for past dates. Please select today or a future date." 
      });
    }

    let totalAmount = 0;
    const db = await getConnection();

    // Calculate total and verify items exist
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        db.release();
        return res.status(400).json({ error: "Item quantity must be a positive integer" });
      }

      const [menuItem] = await db.query(
        "SELECT price FROM menu_items WHERE id = ? AND is_available = 1",
        [item.id]
      );
      if (menuItem.length === 0) {
        db.release();
        return res.status(404).json({ error: `Menu item ${item.id} not found` });
      }
      totalAmount += menuItem[0].price * item.quantity;
    }

    // Check wallet balance
    const [user] = await db.query(
      "SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE",
      [req.user.id]
    );

    if (user[0].wallet_balance < totalAmount) {
      db.release();
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    // CRITICAL FIX: Use UUID for order token instead of simple random ID
    const orderToken = uuidv4();

    await db.beginTransaction();

    try {
      // Create order
      const [orderResult] = await db.query(
        `INSERT INTO orders (user_id, order_token, meal_date, status, total_amount) 
         VALUES (?, ?, ?, 'Received', ?)`,
        [req.user.id, orderToken, mealDate, totalAmount]
      );

      const orderId = orderResult.insertId;

      // Add order items
      for (const item of items) {
        await db.query(
          `INSERT INTO order_items (order_id, menu_item_id, quantity) 
           VALUES (?, ?, ?)`,
          [orderId, item.id, item.quantity || 1]
        );
      }

      // Deduct from wallet
      await db.query(
        "UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?",
        [totalAmount, req.user.id]
      );

      // Log transaction
      await db.query(
        "INSERT INTO wallet_transactions (user_id, amount, label) VALUES (?, ?, ?)",
        [req.user.id, -totalAmount, `Order #${orderId}`]
      );

      await db.commit();
      db.release();

      res.json({
        success: true,
        orderId,
        orderToken,
        totalAmount,
      });
    } catch (error) {
      await db.rollback();
      db.release();
      throw error;
    }
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Get user's orders
router.get("/", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();
    const [orders] = await db.query(
      `SELECT o.id, o.order_token, o.meal_date, o.status, o.total_amount, o.created_at
       FROM orders o
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    // Get items for each order
    for (const order of orders) {
      const [items] = await db.query(
        `SELECT oi.quantity, mi.name, mi.price
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    db.release();
    res.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Get order details
router.get("/:orderId", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();
    const [order] = await db.query(
      `SELECT id, order_token, meal_date, status, total_amount, created_at
       FROM orders
       WHERE id = ? AND user_id = ?`,
      [req.params.orderId, req.user.id]
    );

    if (order.length === 0) {
      db.release();
      return res.status(404).json({ error: "Order not found" });
    }

    const [items] = await db.query(
      `SELECT oi.quantity, mi.name, mi.price
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = ?`,
      [req.params.orderId]
    );

    db.release();
    res.json({ order: order[0], items });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// CRITICAL FIX + NEW FEATURE: Cancel order and refund to wallet
router.post("/:orderId/cancel", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();

    // Get order details
    const [order] = await db.query(
      `SELECT id, status, total_amount, user_id
       FROM orders
       WHERE id = ? AND user_id = ?`,
      [req.params.orderId, req.user.id]
    );

    if (order.length === 0) {
      db.release();
      return res.status(404).json({ error: "Order not found" });
    }

    // Only allow cancellation if order status is "Received"
    if (order[0].status !== "Received") {
      db.release();
      return res.status(400).json({
        error: `Cannot cancel order with status: ${order[0].status}. Only "Received" orders can be cancelled.`,
      });
    }

    await db.beginTransaction();

    try {
      // Update order status to cancelled
      await db.query(
        "UPDATE orders SET status = 'Cancelled' WHERE id = ?",
        [req.params.orderId]
      );

      // Refund to wallet
      const refundAmount = order[0].total_amount;
      await db.query(
        "UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?",
        [refundAmount, req.user.id]
      );

      // Log refund transaction
      await db.query(
        "INSERT INTO wallet_transactions (user_id, amount, label) VALUES (?, ?, ?)",
        [req.user.id, refundAmount, `Refund for Order #${req.params.orderId}`]
      );

      await db.commit();
      db.release();

      res.json({
        success: true,
        message: `Order cancelled. ৳${refundAmount} refunded to wallet`,
      });
    } catch (error) {
      await db.rollback();
      db.release();
      throw error;
    }
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// NEW FEATURE: Export order history as CSV
router.get("/export/csv", authenticateToken, async (req, res) => {
  try {
    const db = await getConnection();

    const [orders] = await db.query(
      `SELECT o.id, o.order_token, o.meal_date, o.status, o.total_amount, o.created_at
       FROM orders o
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    // Build CSV content
    let csv = "Order ID,Order Token,Meal Date,Status,Items,Quantity,Total Amount,Order Date\n";

    for (const order of orders) {
      const [items] = await db.query(
        `SELECT oi.quantity, mi.name
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = ?`,
        [order.id]
      );

      const itemsList = items.map((i) => `${i.name}(${i.quantity})`).join("; ");

      csv += `"${order.id}","${order.order_token}","${order.meal_date}","${order.status}","${itemsList}","","৳${order.total_amount}","${new Date(order.created_at).toLocaleString()}"\n`;
    }

    db.release();

    res.header("Content-Type", "text/csv");
    res.header("Content-Disposition", 'attachment; filename="order_history.csv"');
    res.send(csv);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    res.status(500).json({ error: "Failed to export order history" });
  }
});

// Update order status (admin only)
router.put("/:orderId/status", authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can update order status" });
    }

    const validStatuses = ["Received", "Confirmed", "Preparing", "Ready", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const db = await getConnection();
    await db.query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.orderId]);
    db.release();

    // Emit socket event to notify user
    const io = req.app.get("io");
    io.to(`user:${order[0].user_id}`).emit("orderUpdated", {
      orderId: req.params.orderId,
      status,
    });

    res.json({ success: true, message: "Order status updated" });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

module.exports = router;
