const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();
const STATUSES = ["Received", "Cooking", "Ready"];
// Feature: pre-order / scheduled pickup — how far ahead a student may schedule
const PICKUP_MIN_LEAD_MINUTES = 10;
const PICKUP_MAX_LEAD_HOURS = 4;

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

// Feature: queue position. An ASAP order is ordered by when it was placed; orders
// scheduled for later don't hold up ASAP ones. Each active ASAP order gets
// { ahead, position, est_minutes } — everything else gets queue: null.
const AVG_MINUTES_PER_ORDER = 4;

async function attachQueue(orders) {
  const mine = orders.filter((o) => (o.status === "Received" || o.status === "Cooking") && !o.pickup_time);
  if (mine.length === 0) return orders.map((o) => ({ ...o, queue: null }));

  const [rows] = await pool.query(
    "SELECT id, pickup_time, created_at FROM orders WHERE status IN ('Received', 'Cooking')"
  );
  const when = (r) => new Date(r.pickup_time || r.created_at).getTime();
  return orders.map((o) => {
    if (!mine.includes(o)) return { ...o, queue: null };
    const t = when(o);
    const ahead = rows.filter((r) => r.id !== o.id && (when(r) < t || (when(r) === t && r.id < o.id))).length;
    return { ...o, queue: { ahead, position: ahead + 1, est_minutes: (ahead + 1) * AVG_MINUTES_PER_ORDER } };
  });
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
router.post("/", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const { items, paymentMethod } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array is required" });
  }
  if (!["wallet", "cash"].includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod must be wallet or cash" });
  }

  // Optional pre-order: body.pickupTime is a "HH:MM" (24h) string for a slot today
  // (or tomorrow, if the window crosses midnight). Omitted/falsy means ASAP.
  let pickupTime = null;
  if (req.body.pickupTime) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(req.body.pickupTime);
    if (!match) return res.status(400).json({ error: "pickupTime must be in HH:MM 24-hour format" });

    // Truncate seconds so the allowed window matches exactly what a minute-precision
    // <input type="time"> can express — otherwise picking the exact displayed min/max
    // minute could still fail by a few leftover seconds.
    const now = new Date();
    now.setSeconds(0, 0);
    const minAllowed = new Date(now.getTime() + PICKUP_MIN_LEAD_MINUTES * 60000);
    const maxAllowed = new Date(now.getTime() + PICKUP_MAX_LEAD_HOURS * 3600000);

    // "14:05" could mean today or, once the window crosses midnight, tomorrow —
    // try both and accept whichever actually falls inside the allowed window,
    // instead of always assuming "today" (which broke post-midnight slots).
    const buildCandidate = (dayOffset) => {
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(Number(match[1]), Number(match[2]), 0, 0);
      return d;
    };
    const candidate = [0, 1].map(buildCandidate).find((d) => d >= minAllowed && d <= maxAllowed);

    if (!candidate) {
      return res.status(400).json({
        error: `Pickup time must be at least ${PICKUP_MIN_LEAD_MINUTES} minutes and at most ${PICKUP_MAX_LEAD_HOURS} hours from now`,
      });
    }
    pickupTime = candidate;
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
      "INSERT INTO orders (token, user_id, total, payment_method, pickup_time, status) VALUES (?, ?, ?, ?, ?, 'Received')",
      [token, req.user.id, total, paymentMethod, pickupTime]
    );
    for (const item of snapshot) {
      await conn.query(
        "INSERT INTO order_items (order_id, menu_item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)",
        [orderResult.insertId, item.id, item.name, item.price, item.qty]
      );
    }

    await conn.commit();

    const order = { id: orderResult.insertId, token, total, status: "Received", pickup_time: pickupTime, items: snapshot };
    req.app.get("io").to("admins").emit("order:new", order);
    req.app.get("io").emit("queue:changed");
    res.status(201).json(order);
  } catch (err) {
    await conn.rollback();
    const status = err.status || 500;
    console.error(err);
    res.status(status).json({ error: err.message || "Failed to place order" });
  } finally {
    conn.release();
  }
}));

// GET /api/orders/mine  (student/teacher) — my order history
router.get("/mine", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const [orders] = await pool.query("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", [req.user.id]);
  res.json(await attachQueue(await attachFeedback(await attachItems(orders))));
}));

// GET /api/orders  (admin) — live queue
router.get("/", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const [orders] = await pool.query("SELECT * FROM orders ORDER BY id DESC LIMIT 100");
  res.json(await attachFeedback(await attachItems(orders)));
}));

// PATCH /api/orders/:id/cancel  (student/teacher) — cancel while still "Received"
// Restores stock and, for a wallet-paid order, refunds the wallet.
router.patch("/:id/cancel", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[order]] = await conn.query("SELECT * FROM orders WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!order) throw { status: 404, message: "Order not found" };
    if (order.user_id !== req.user.id) throw { status: 403, message: "This isn't your order" };
    if (order.status !== "Received") {
      throw { status: 400, message: "Only an order that's still 'Received' can be cancelled" };
    }

    const [items] = await conn.query("SELECT menu_item_id, qty FROM order_items WHERE order_id = ?", [order.id]);
    for (const item of items) {
      if (item.menu_item_id) {
        await conn.query("UPDATE menu_items SET stock = stock + ? WHERE id = ?", [item.qty, item.menu_item_id]);
      }
    }

    if (order.payment_method === "wallet") {
      await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [order.total, req.user.id]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
        req.user.id,
        `Refund — Order ${order.token} cancelled`,
        order.total,
      ]);
    }

    await conn.query("UPDATE orders SET status = 'Cancelled' WHERE id = ?", [order.id]);
    await conn.commit();

    const updated = { ...order, status: "Cancelled" };
    const io = req.app.get("io");
    io.to("admins").emit("order:update", updated);
    io.to(`user:${order.user_id}`).emit("order:update", updated);
    io.emit("queue:changed");

    res.json(updated);
  } catch (err) {
    await conn.rollback();
    const status = err.status || 500;
    console.error(err);
    res.status(status).json({ error: err.message || "Failed to cancel order" });
  } finally {
    conn.release();
  }
}));

// PATCH /api/orders/:id/advance  (admin) — Received -> Cooking -> Ready
router.patch("/:id/advance", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const [[order]] = await pool.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const nextIndex = Math.min(STATUSES.indexOf(order.status) + 1, STATUSES.length - 1);
  const nextStatus = STATUSES[nextIndex];
  await pool.query("UPDATE orders SET status = ? WHERE id = ?", [nextStatus, order.id]);

  const updated = { ...order, status: nextStatus };
  const io = req.app.get("io");
  io.to("admins").emit("order:update", updated);
  io.to(`user:${order.user_id}`).emit("order:update", updated);
  io.emit("queue:changed");

  res.json(updated);
}));

// POST /api/orders/:id/feedback  (student/teacher) — rate a completed order
// body: { rating: 1-5, comment? }
router.post("/:id/feedback", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
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
}));

module.exports = router;