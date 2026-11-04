// CampusDine Controller: Order Placement & Lifecycle Tracking
const pool = require("../db");

const OrderController = {
  // Place a new order
  async placeOrder(req, res) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const { restaurantId, items, paymentMethod, pickupTime, note, couponCode } = req.body;
      const userId = req.user.id;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "Order must contain at least one item" });
      }

      // Calculate subtotal
      let total = 0;
      for (const item of items) {
        total += Number(item.price || 0) * (item.qty || 1);
      }

      // Generate token
      const token = "T-" + Math.floor(1000 + Math.random() * 9000);

      // Insert Order
      const [orderResult] = await conn.query(
        "INSERT INTO orders (user_id, restaurant_id, token, total_amount, status, payment_method, pickup_time, note) VALUES (?, ?, ?, ?, 'Received', ?, ?, ?)",
        [userId, restaurantId || 1, token, total, paymentMethod || "wallet", pickupTime || null, note || ""]
      );
      const orderId = orderResult.insertId;

      // Insert Items
      for (const item of items) {
        await conn.query(
          "INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price) VALUES (?, ?, ?, ?, ?)",
          [orderId, item.id || null, item.name, item.qty || 1, item.price]
        );
      }

      // If wallet payment, deduct balance
      if (paymentMethod === "wallet") {
        const [u] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [userId]);
        const bal = Number(u[0]?.wallet_balance || 0);
        if (bal < total) {
          await conn.rollback();
          return res.status(400).json({ error: "Insufficient wallet balance" });
        }
        await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [total, userId]);
      }

      await conn.commit();
      return res.status(201).json({ id: orderId, token, total, message: "Order placed successfully" });
    } catch (error) {
      await conn.rollback();
      console.error("OrderController.placeOrder error:", error);
      return res.status(500).json({ error: "Failed to place order" });
    } finally {
      conn.release();
    }
  },

  // Advance order status (Received -> Cooking -> Ready -> Picked Up)
  async advanceStatus(req, res) {
    try {
      const { id } = req.params;
      const [orders] = await pool.query("SELECT id, status, user_id FROM orders WHERE id = ?", [id]);
      if (orders.length === 0) return res.status(404).json({ error: "Order not found" });

      const current = orders[0].status;
      const transitions = {
        Received: "Cooking",
        Cooking: "Ready",
        Ready: "Picked Up"
      };

      const next = transitions[current];
      if (!next) {
        return res.status(400).json({ error: "Order cannot be advanced from status: " + current });
      }

      await pool.query("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?", [next, id]);
      return res.json({ id, status: next, message: "Order advanced to " + next });
    } catch (error) {
      console.error("OrderController.advanceStatus error:", error);
      return res.status(500).json({ error: "Failed to advance order" });
    }
  },

  // Cancel order & refund
  async cancelOrder(req, res) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const { id } = req.params;
      const [orders] = await conn.query("SELECT id, status, total_amount, user_id, payment_method FROM orders WHERE id = ? FOR UPDATE", [id]);
      if (orders.length === 0) return res.status(404).json({ error: "Order not found" });

      const order = orders[0];
      if (order.status === "Ready" || order.status === "Picked Up") {
        return res.status(400).json({ error: "Cannot cancel order already prepared or completed" });
      }

      await conn.query("UPDATE orders SET status = 'Cancelled', updated_at = NOW() WHERE id = ?", [id]);

      // Refund if paid via wallet
      if (order.payment_method === "wallet") {
        await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [order.total_amount, order.user_id]);
      }

      await conn.commit();
      return res.json({ id, status: "Cancelled", refunded: order.payment_method === "wallet" });
    } catch (error) {
      await conn.rollback();
      console.error("OrderController.cancelOrder error:", error);
      return res.status(500).json({ error: "Failed to cancel order" });
    } finally {
      conn.release();
    }
  }
};

module.exports = OrderController;
