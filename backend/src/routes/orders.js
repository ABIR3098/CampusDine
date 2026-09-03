const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();
const STATUSES = ["Received", "Cooking", "Ready"];

async function attachItems(orders) {
  if (orders.length === 0) return orders;
  const ids = orders.map((o) => o.id);
  const [items] = await pool.query(
    `SELECT * FROM order_items WHERE order_id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  return orders.map((o) => ({
    ...o,
    items: items.filter((i) => i.order_id === o.id).map((i) => ({ name: i.name, price: i.price, qty: i.qty })),
  }));
}

async function attachFeedback(orders) {
  if (orders.length === 0) return orders;
  const ids = orders.map((o) => o.id);
  const [rows] = await pool.query(
    `SELECT order_id, rating, comment FROM order_feedback WHERE order_id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  return orders.map((o) => {
    const f = rows.find((r) => r.order_id === o.id);
    return { ...o, feedback: f ? { rating: f.rating, comment: f.comment } : null };
  });
}

// POST /api/orders  (student/teacher) — place an order
// body: { items: [{ id, qty }], paymentMethod: 'wallet' | 'cash' }
router.post("/", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const { items, paymentMethod } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array is required" });
  }
  if (!["wallet", "cash"].includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod must be wallet or cash" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock and re-read menu prices/stock server-side — never trust client prices
    const ids = items.map((i) => i.id);
    const [menuRows] = await conn.query(
      `SELECT * FROM menu_items WHERE id IN (${ids.map(() => "?").join(",")}) FOR UPDATE`,
      ids
    );

    let total = 0;
    const snapshot = [];
    for (const reqItem of items) {
      const menuItem = menuRows.find((m) => m.id === reqItem.id);
      if (!menuItem) throw { status: 404, message: `Menu item ${reqItem.id} not found` };
      if (menuItem.stock < reqItem.qty) throw { status: 409, message: `${menuItem.name} is out of stock` };
      total += menuItem.price * reqItem.qty;
      snapshot.push({ id: menuItem.id, name: menuItem.name, price: menuItem.price, qty: reqItem.qty });
    }

    if (paymentMethod === "wallet") {
      const [[user]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [req.user.id]);
      if (user.wallet_balance < total) throw { status: 402, message: "Insufficient wallet balance" };
      await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [total, req.user.id]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
        req.user.id,
        "Order payment",
        -total,
      ]);
    }

    for (const item of snapshot) {
      await conn.query("UPDATE menu_items SET stock = stock - ? WHERE id = ?", [item.qty, item.id]);
    }

    // Sequential, human-friendly token e.g. C-104
    const [[{ maxId }]] = await conn.query("SELECT COALESCE(MAX(id), 0) AS maxId FROM orders");
    const token = `C-${String(100 + maxId + 1).padStart(3, "0")}`;

    const [orderResult] = await conn.query(
      "INSERT INTO orders (token, user_id, total, payment_method, status) VALUES (?, ?, ?, ?, 'Received')",
      [token, req.user.id, total, paymentMethod]
    );
    for (const item of snapshot) {
      await conn.query(
        "INSERT INTO order_items (order_id, menu_item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)",
        [orderResult.insertId, item.id, item.name, item.price, item.qty]
      );
    }

    await conn.commit();

    const order = { id: orderResult.insertId, token, total, status: "Received", items: snapshot };
    req.app.get("io").to("admins").emit("order:new", order);
    res.status(201).json(order);
  } catch (err) {
    await conn.rollback();
    const status = err.status || 500;
    console.error(err);
    res.status(status).json({ error: err.message || "Failed to place order" });
  } finally {
    conn.release();
  }
});

// GET /api/orders/mine  (student/teacher) — my order history
router.get("/mine", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const [orders] = await pool.query("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", [req.user.id]);
  res.json(await attachFeedback(await attachItems(orders)));
});

// GET /api/orders  (admin) — live queue
router.get("/", verifyToken, requireRole("admin"), async (req, res) => {
  const [orders] = await pool.query("SELECT * FROM orders ORDER BY id DESC LIMIT 100");
  res.json(await attachFeedback(await attachItems(orders)));
});

// PATCH /api/orders/:id/advance  (admin) — Received -> Cooking -> Ready
router.patch("/:id/advance", verifyToken, requireRole("admin"), async (req, res) => {
  const [[order]] = await pool.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const nextIndex = Math.min(STATUSES.indexOf(order.status) + 1, STATUSES.length - 1);
  const nextStatus = STATUSES[nextIndex];
  await pool.query("UPDATE orders SET status = ? WHERE id = ?", [nextStatus, order.id]);

  const updated = { ...order, status: nextStatus };
  const io = req.app.get("io");
  io.to("admins").emit("order:update", updated);
  io.to(`user:${order.user_id}`).emit("order:update", updated);

  res.json(updated);
});

// POST /api/orders/:id/feedback  (student/teacher) — rate a completed order
// body: { rating: 1-5, comment? }
router.post("/:id/feedback", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  const { rating, comment } = req.body;
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: "rating must be an integer from 1 to 5" });
  }

  const [[order]] = await pool.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: "This isn't your order" });
  if (order.status !== "Ready") return res.status(400).json({ error: "You can only rate an order once it's Ready" });

  await pool.query(
    `INSERT INTO order_feedback (order_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
    [order.id, req.user.id, r, comment || null]
  );

  res.json({ orderId: order.id, rating: r, comment: comment || null });
});

module.exports = router;
