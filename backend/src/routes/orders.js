const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const { buildPayload, parseCode } = require("../utils/tokenQr");
const { restaurantOf, isRestaurantId } = require("../catalog");
const { loadItemRestaurants } = require("../restaurants");
const { resolvePickupTime } = require("../utils/pickup");
const pricing = require("../pricing");
const loyalty = require("../loyalty");
const { assignOrderToBestRider } = require("../utils/riderAssignment");
const { recordFraudEvent } = require("../utils/fraud");
const { pingWatchers } = require("../stockAlerts");
const { recordAuditEvent } = require("../utils/audit");

const router = express.Router();
const STATUSES = ["Received", "Cooking", "Ready"];

async function attachItems(orders) {
  if (orders.length === 0) return orders;
  const ids = orders.map((o) => o.id);
  const [items] = await pool.query(
    `SELECT * FROM order_items WHERE order_id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  // Feature: restaurants — an order belongs to the restaurant its items come from (one order = one restaurant)
  const extra = await loadItemRestaurants();
  return orders.map((o) => {
    const own = items.filter((i) => i.order_id === o.id);
    return {
      ...o,
      restaurant: restaurantOf(own[0] && own[0].name, own[0] && own[0].menu_item_id, extra),
      items: own.map((i) => ({ name: i.name, price: i.price, qty: i.qty })),
      qr: buildPayload(o.token), // signed text shown as a QR code on the ticket
    };
  });
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
  const { items, paymentMethod, couponCode, couponId } = req.body;
  const rewardId = Number(req.body.rewardId) > 0 ? Number(req.body.rewardId) : null; // loyalty reward to spend points on
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array is required" });
  }
  if (items.some((item) => !item || !Number.isInteger(Number(item.id)) || Number(item.id) <= 0 || !Number.isInteger(Number(item.qty)) || Number(item.qty) <= 0)) {
    return res.status(400).json({ error: "Each item must have a valid ID and positive quantity" });
  }
  /* Fix: merge duplicate cart lines */
  const mergedItems = new Map();
  for (const item of items) {
    const id = Number(item.id);
    mergedItems.set(id, (mergedItems.get(id) || 0) + Number(item.qty));
  }
  const requestedItems = [...mergedItems].map(([id, qty]) => ({ id, qty }));
  if (!["wallet", "cash"].includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod must be wallet or cash" });
  }

  // Feature: optional note for the kitchen (e.g. "less spicy") — trimmed, at most 200 characters
  const orderNote = typeof req.body.note === "string" ? (req.body.note.trim().slice(0, 200) || null) : null;
  // Feature: delivery instructions (e.g. "gate-e dibe") — trimmed, at most 200 characters
  const deliveryNote = typeof req.body.deliveryNote === "string" ? (req.body.deliveryNote.trim().slice(0, 200) || null) : null;

  const couponRequested = Boolean(couponId || couponCode);
  const normalizedCode = String(couponCode || "").trim().toUpperCase();

  // Optional pre-order: body.pickupTime is a "HH:MM" (24h) string for a slot today (or tomorrow, if the
  // window crosses midnight). Omitted/falsy means ASAP. Happy hours are judged at the pickup moment.
  let pickupTime = null;
  try { pickupTime = resolvePickupTime(req.body.pickupTime); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock and re-read menu prices/stock server-side — never trust client prices
    const ids = requestedItems.map((i) => i.id);
    const [menuRows] = await conn.query(
      `SELECT * FROM menu_items WHERE id IN (${ids.map(() => "?").join(",")}) FOR UPDATE`,
      ids
    );

    const snapshot = [];
    for (const reqItem of requestedItems) {
      const menuItem = menuRows.find((m) => m.id === reqItem.id);
      if (!menuItem) throw { status: 404, message: `Menu item ${reqItem.id} not found` };
      // Feature: sold-out / hidden items cannot be ordered even if some stock is left
      if (menuItem.availability === "sold_out") throw { status: 409, message: `${menuItem.name} is sold out` };
      if (menuItem.availability === "hidden") throw { status: 409, message: `${menuItem.name} is not available right now` };
      if (menuItem.stock < reqItem.qty) throw { status: 409, message: `${menuItem.name} is out of stock` };
      snapshot.push({ id: menuItem.id, name: menuItem.name, price: menuItem.price, qty: reqItem.qty, category: menuItem.category });
    }

    // Feature: restaurants — one order can only contain items from a single restaurant
    const extraRestaurants = await loadItemRestaurants();
    const restaurantsInCart = new Set(snapshot.map((i) => restaurantOf(i.name, i.id, extraRestaurants)));
    if (restaurantsInCart.size > 1) {
      throw { status: 400, message: "One order can only contain items from a single restaurant" };
    }

    // Feature: offers — combos → happy hour → coupon → loyalty reward (see src/pricing.js).
    // The same function backs the cart preview, so the price shown is the price charged.
    const priced = await pricing.priceOrder(conn, {
      userId: req.user.id, snapshot, couponId, couponCode, rewardId,
      when: pickupTime || new Date(), lock: true,
    });
    const appliedCoupon = priced.coupon;
    const discountAmount = priced.couponDiscount;
    const total = priced.total;
    const pointsUsed = priced.reward ? Number(priced.reward.points_cost) : 0;

    // Feature: rider tip — a fixed amount, paid from the wallet now, handed to the rider at pickup
    const TIP_OPTIONS = [0, 5, 10, 20];
    const tip = Number(req.body.tip || 0);
    if (!TIP_OPTIONS.includes(tip)) throw { status: 400, message: "Invalid tip amount" };
    if (tip > 0 && paymentMethod !== "wallet") throw { status: 400, message: "Tips are paid from your wallet" };

    if (paymentMethod === "wallet") {
      const [[user]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [req.user.id]);
      if (user.wallet_balance < total + tip) throw { status: 402, message: "Insufficient wallet balance" };
      await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [total + tip, req.user.id]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
        req.user.id,
        "Order payment",
        -total,
      ]);
      if (tip > 0) {
        await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [req.user.id, "Rider tip", -tip]);
      }
    }

    for (const item of snapshot) {
      await conn.query("UPDATE menu_items SET stock = stock - ? WHERE id = ?", [item.qty, item.id]);
    }

    // Token: the row is inserted with a temporary unique token and then renamed to C-<100 + order id>.
    // (The old "MAX(id) + 1" way could hand two simultaneous orders the same token and one would fail.)
    const tempToken = `T-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase().slice(0, 20);
    const deliveryLocation = req.body.deliveryLocation || {};
    const deliveryLat = Number(deliveryLocation.latitude);
    const deliveryLng = Number(deliveryLocation.longitude);
    const hasValidDeliveryLocation = Number.isFinite(deliveryLat) && deliveryLat >= -90 && deliveryLat <= 90
      && Number.isFinite(deliveryLng) && deliveryLng >= -180 && deliveryLng <= 180;
    const [orderResult] = await conn.query(
      "INSERT INTO orders (token, user_id, total, discount_amount, discount_applied, promo_discount, reward_discount, points_used, promo_label, payment_method, pickup_time, note, delivery_note, delivery_lat, delivery_lng, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Received')",
      [tempToken, req.user.id, total, discountAmount, appliedCoupon ? 1 : 0, priced.promoDiscount, priced.rewardDiscount, pointsUsed, priced.promoLabel, paymentMethod, pickupTime, orderNote, deliveryNote, hasValidDeliveryLocation ? deliveryLat : null, hasValidDeliveryLocation ? deliveryLng : null]
    );
    const token = `C-${String(100 + orderResult.insertId).padStart(3, "0")}`;
    await conn.query("UPDATE orders SET token = ? WHERE id = ?", [token, orderResult.insertId]);
    if (tip > 0) await conn.query("UPDATE orders SET tip_amount = ? WHERE id = ?", [tip, orderResult.insertId]);
    for (const item of snapshot) {
      await conn.query(
        "INSERT INTO order_items (order_id, menu_item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)",
        [orderResult.insertId, item.id, item.name, item.price, item.qty]
      );
    }

    if (appliedCoupon) {
      await conn.query(
        "INSERT INTO coupon_usage (user_id, coupon_id, order_id) VALUES (?, ?, ?)",
        [req.user.id, appliedCoupon.id, orderResult.insertId]
      );
      await conn.query(
        "UPDATE coupons SET used_count = used_count + 1 WHERE id = ?",
        [appliedCoupon.id]
      );
    }

    // Spend the loyalty points (account row is already locked by priceOrder)
    let pointsBalance = null;
    if (priced.reward) {
      pointsBalance = await loyalty.redeemForOrder(conn, { userId: req.user.id, reward: priced.reward, orderId: orderResult.insertId, token });
    }

    const assignedRiderId = await assignOrderToBestRider(conn, orderResult.insertId);
    if (assignedRiderId) {
      await recordAuditEvent(conn, req, "AUTO_RIDER_ASSIGN", "order", orderResult.insertId, { riderId: assignedRiderId });
    }
    await conn.commit();

    const order = {
      id: orderResult.insertId, token, qr: buildPayload(token), total, discount_amount: discountAmount,
      promo_discount: priced.promoDiscount, reward_discount: priced.rewardDiscount, points_used: pointsUsed,
      promo_label: priced.promoLabel, subtotal: priced.subtotal, points_earnable: priced.pointsEarnable, points_balance: pointsBalance,
      status: "Received", pickup_time: pickupTime, note: orderNote, delivery_note: deliveryNote,
      rider_id: assignedRiderId,
      tip_amount: tip,
      rider_assignment_status: assignedRiderId ? "Assigned" : "Unassigned",
      items: snapshot.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
    };
    req.app.get("io").to("admins").emit("order:new", order);
    if (assignedRiderId) {
      req.app.get("io").to(`rider:${assignedRiderId}`).emit("rider:order-assigned", { orderId: order.id });
    }
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
  const mine = await attachQueue(await attachFeedback(await attachItems(orders)));
  // Feature: rate your rider — show the rider's name on each order
  const riderIds = [...new Set(mine.map((o) => o.rider_id).filter(Boolean))];
  if (riderIds.length) {
    const [riders] = await pool.query(`SELECT id, name FROM users WHERE id IN (${riderIds.map(() => "?").join(",")})`, riderIds);
    const names = Object.fromEntries(riders.map((r) => [r.id, r.name]));
    for (const o of mine) o.rider_name = o.rider_id ? names[o.rider_id] || null : null;
  }
  res.json(mine);
}));

// GET /api/orders  (admin) — live queue
// Optional ?restaurant=<id> keeps only that restaurant's orders.
router.get("/", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const restaurant = req.query.restaurant;
  if (restaurant && !isRestaurantId(restaurant)) return res.status(400).json({ error: "Unknown restaurant" });
  // With a restaurant filter, look at more recent orders first, since other restaurants' orders are dropped
  const [orders] = await pool.query("SELECT * FROM orders ORDER BY id DESC LIMIT ?", [restaurant ? 400 : 100]);
  const withItems = await attachItems(orders);
  const kept = restaurant ? withItems.filter((o) => o.restaurant === restaurant).slice(0, 100) : withItems;
  res.json(await attachFeedback(kept));
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
      if (Number(order.tip_amount) > 0 && !order.tip_settled) {
        await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [order.tip_amount, req.user.id]);
        await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
          req.user.id,
          `Tip refund — Order ${order.token} cancelled`,
          order.tip_amount,
        ]);
        await conn.query("UPDATE orders SET tip_settled = 1 WHERE id = ?", [order.id]);
      }
    }

    await loyalty.refundForOrder(conn, order); // points spent on this order go back to the customer

    /* Fix: give the coupon back when the order is cancelled */
    const [usedCoupons] = await conn.query("SELECT coupon_id FROM coupon_usage WHERE order_id = ?", [order.id]);
    for (const row of usedCoupons) {
      await conn.query("UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?", [row.coupon_id]);
    }
    if (usedCoupons.length) await conn.query("DELETE FROM coupon_usage WHERE order_id = ?", [order.id]);

    await conn.query("UPDATE orders SET status = 'Cancelled' WHERE id = ?", [order.id]);
    await recordAuditEvent(conn, req, "ORDER_CANCEL_AND_REFUND", "order", order.id, {
      walletRefund: order.payment_method === "wallet",
      amount: Number(order.total),
    });
    await conn.commit();

    const updated = { ...order, status: "Cancelled" };
    const io = req.app.get("io");
    io.to("admins").emit("order:update", updated);
    io.to(`user:${order.user_id}`).emit("order:update", updated);
    io.emit("queue:changed");
    try { await pingWatchers(io, items.map((i) => i.menu_item_id).filter(Boolean)); } catch (e) { console.error("Notify-me ping failed:", e.message); }

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

// POST /api/orders/verify  (admin) — check a scanned QR (or a hand-typed token) at the counter.
// body: { code, collect?: true }
//   without collect: just look the order up and say whether it can be handed over
//   with collect:    also mark it as collected, so the same QR can't be used twice
router.post("/verify", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const { code, collect } = req.body || {};
  const parsed = parseCode(code);
  if (!parsed.token) return res.status(400).json({ error: "Scan a QR code or type a token" });
  if (parsed.signed && !parsed.valid) {
    return res.status(400).json({ error: "This QR code is not a genuine CampusDine token", code: "BAD_SIGNATURE" });
  }

  const [[order]] = await pool.query(
    `SELECT o.id, o.user_id, o.rider_id, o.token, o.total, o.status, o.payment_method, o.pickup_time, o.note, o.delivery_note, o.created_at, o.picked_up_at,
            u.name AS customer_name, u.external_id AS customer_id, u.role AS customer_role,
            u.account_type, u.hall_name, u.room_number, u.hall_id
     FROM orders o JOIN users u ON u.id = o.user_id
     WHERE o.token = ?`,
    [parsed.token]
  );
  if (!order) return res.status(404).json({ error: `No order found for token ${parsed.token}`, code: "NOT_FOUND" });

  const [items] = await pool.query("SELECT name, price, qty FROM order_items WHERE order_id = ?", [order.id]);

  let problem = null;
  if (order.status === "Cancelled") problem = { code: "CANCELLED", message: "This order was cancelled" };
  else if (order.picked_up_at) problem = { code: "ALREADY_COLLECTED", message: "This order was already collected" };
  else if (order.status !== "Ready") problem = { code: "NOT_READY", message: `Not ready yet — status is ${order.status}` };

  if (collect) {
    if (problem) return res.status(409).json({ error: problem.message, code: problem.code, order: { ...order, items } });
    const connection = await pool.getConnection();
    let pickedUpAt;
    try {
      await connection.beginTransaction();
      const [updated] = await connection.query(
        "UPDATE orders SET picked_up_at = NOW(), rider_assignment_status = CASE WHEN rider_id IS NULL THEN rider_assignment_status ELSE 'Completed' END WHERE id = ? AND status = 'Ready' AND picked_up_at IS NULL",
        [order.id]
      );
      if (!updated.affectedRows) {
        await connection.rollback();
        return res.status(409).json({ error: "This order is not ready or was already collected", code: "ALREADY_COLLECTED", order: { ...order, items } });
      }
      await recordAuditEvent(connection, req, "ORDER_PICKUP_VERIFIED", "order", order.id, { riderId: order.rider_id });
      const [[tipRow]] = await connection.query("SELECT tip_amount, tip_settled, rider_id, user_id FROM orders WHERE id = ? FOR UPDATE", [order.id]);
      if (tipRow && Number(tipRow.tip_amount) > 0 && !tipRow.tip_settled) {
        const amount = Number(tipRow.tip_amount);
        const payee = tipRow.rider_id ? tipRow.rider_id : tipRow.user_id;
        const tipLabel = tipRow.rider_id ? `Tip received — Order ${order.token}` : `Tip refund — Order ${order.token} (no rider)`;
        await connection.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, payee]);
        await connection.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [payee, tipLabel, amount]);
        await connection.query("UPDATE orders SET tip_settled = 1 WHERE id = ?", [order.id]);
      }
      const [[fresh]] = await connection.query("SELECT picked_up_at FROM orders WHERE id = ?", [order.id]);
      pickedUpAt = fresh.picked_up_at;
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    const done = { ...order, picked_up_at: pickedUpAt, items };
    req.app.get("io").to(`user:${order.user_id}`).emit("order:update", { id: order.id, token: order.token, status: order.status, picked_up_at: pickedUpAt });
    return res.json({ ok: true, collected: true, order: done });
  }

  res.json({ ok: !problem, problem, order: { ...order, items } });
}));

// PATCH /api/orders/:id/advance  (admin) — Received -> Cooking -> Ready
router.patch("/:id/advance", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const connection = await pool.getConnection();
  let order;
  let nextStatus;
  try {
    await connection.beginTransaction();
    [[order]] = await connection.query("SELECT * FROM orders WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: "Order not found" });
    }
    const statusIndex = STATUSES.indexOf(order.status);
    if (statusIndex < 0 || statusIndex >= STATUSES.length - 1) {
      await connection.rollback();
      return res.status(409).json({ error: "This order cannot be advanced" });
    }
    nextStatus = STATUSES[statusIndex + 1];
    await connection.query("UPDATE orders SET status = ? WHERE id = ?", [nextStatus, order.id]);
    await recordAuditEvent(connection, req, "ORDER_STATUS_CHANGE", "order", order.id, { from: order.status, to: nextStatus });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const updated = { ...order, status: nextStatus };
  const io = req.app.get("io");
  io.to("admins").emit("order:update", updated);
  io.to(`user:${order.user_id}`).emit("order:update", updated);
  io.emit("queue:changed");

  // Feature: loyalty — points + streak are earned when the order becomes Ready
  if (nextStatus === "Ready") {
    try {
      const award = await loyalty.awardForOrder(pool, order.id);
      if (award) {
        io.to(`user:${order.user_id}`).emit("loyalty:update", award);
        updated.loyalty = { points: award.points, bonus: award.bonus, streak: award.streak, balance: award.balance };
      }
    } catch (err) {
      console.error("Loyalty award failed:", err); // never block the kitchen over points
    }
  }

  res.json(updated);
}));

// POST /api/orders/:id/feedback  (student/teacher) — rate a completed order
// body: { rating: 1-5, comment? }
// POST /api/orders/:id/rate-rider  (student/teacher) — one rating per delivered order
router.post("/:id/rate-rider", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const rating = Number(req.body && req.body.rating);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid order" });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be from 1 to 5" });
  const comment = typeof req.body.comment === "string" ? (req.body.comment.trim().slice(0, 200) || null) : null;

  const [[order]] = await pool.query("SELECT id, user_id, rider_id, picked_up_at, rider_rating FROM orders WHERE id = ?", [id]);
  if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: "Order not found" });
  if (!order.rider_id) return res.status(400).json({ error: "This order did not have a rider" });
  if (!order.picked_up_at) return res.status(409).json({ error: "You can rate the rider after the order is delivered" });
  if (order.rider_rating) return res.status(409).json({ error: "You already rated this rider" });

  const [result] = await pool.query(
    "UPDATE orders SET rider_rating = ?, rider_comment = ?, rider_rated_at = NOW() WHERE id = ? AND rider_rating IS NULL",
    [rating, comment, id]);
  if (!result.affectedRows) return res.status(409).json({ error: "You already rated this rider" });
  res.json({ ok: true, rating, comment });
}));

router.post("/:id/feedback", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const { rating } = req.body;
  const comment = String(req.body.comment || "").trim();
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: "rating must be an integer from 1 to 5" });
  }
  if (comment.length > 500) {
    return res.status(400).json({ error: "Comment must be 500 characters or fewer" });
  }

  const [[order]] = await pool.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: "This isn't your order" });
  if (order.status !== "Ready") {
    await recordFraudEvent(pool, {
      userId: req.user.id,
      eventType: "PREMATURE_REVIEW_ATTEMPT",
      severity: "LOW",
      details: { orderId: Number(order.id), status: order.status },
      ipAddress: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").slice(0, 64),
    });
    return res.status(400).json({ error: "You can only rate an order once it's Ready" });
  }

  const [[existing]] = await pool.query("SELECT id FROM order_feedback WHERE order_id = ?", [order.id]);

  await pool.query(
    `INSERT INTO order_feedback (order_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
    [order.id, req.user.id, r, comment || null]
  );

  // Tell every admin who's online so their Feedback tab updates without a reload
  const io = req.app.get("io");
  if (io) {
    io.to("admins").emit("feedback:new", {
      kind: "order",
      token: order.token,
      rating: r,
      userName: req.user.name,
      updated: Boolean(existing),
    });
  }

  res.json({ orderId: order.id, rating: r, comment: comment || null });
}));

module.exports = router;