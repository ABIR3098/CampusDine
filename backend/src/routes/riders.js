const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const { recordAuditEvent } = require("../utils/audit");
const { publicRiderLocation } = require("../utils/riderLocation");
const { assignPendingTeacherOrders } = require("../utils/riderAssignment");
const riderDispatcher = require("../services/riderDispatcher");
const { acceptAssignedOrder } = require("../utils/riderAccept");

// A rider sends a position about every 8 seconds; looking for waiting orders that often is enough.
const DISPATCH_GAP_MS = 5000;
const router = express.Router();

// POST /orders/assign-pending (admin)
router.post("/orders/assign-pending", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const io = req.app.get("io");
  const assigned = await assignPendingTeacherOrders(pool, {
    onAssigned: ({ orderId, riderId }, connection) => recordAuditEvent(connection, req, "AUTO_RIDER_ASSIGN", "order", orderId, { riderId }),
  });
  for (const { orderId, riderId } of assigned) io.to(`rider:${riderId}`).emit("rider:order-assigned", { orderId });
  res.json({ ok: true, assigned, count: assigned.length });
}));

// GET /orders (rider)
router.get("/orders", verifyToken, requireRole("rider"), catchAsync(async (req, res) => {
  const [orders] = await pool.query(`
    SELECT o.id, o.token, o.total, o.status, o.pickup_time, o.note, o.tip_amount, o.delivery_note,
      o.rider_assignment_status, o.created_at,
      u.name AS customer_name, u.phone AS customer_phone, u.address AS customer_address
    FROM orders o JOIN users u ON u.id = o.user_id
    WHERE o.rider_id = ? AND o.rider_assignment_status IN ('Assigned', 'Accepted')
      AND o.status <> 'Cancelled'
    ORDER BY o.created_at ASC
  `, [Number(req.user.id)]);
  res.json(orders);
}));

// POST /orders/:orderId/accept (rider)
router.post("/orders/:orderId/accept", verifyToken, requireRole("rider"), catchAsync(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "Invalid order ID" });
  const riderId = Number(req.user.id);
  const accepted = await acceptAssignedOrder(pool, { orderId, riderId });
  if (!accepted.ok) return res.status(409).json({ error: "Order is not assigned to you or is no longer available" });
  if (accepted.changed) {
    await recordAuditEvent(pool, req, "RIDER_ACCEPT", "order", orderId, { riderId });
    const io = req.app.get("io");
    io.to("admins").emit("rider:order-accepted", { orderId, riderId });
    // The teacher who ordered sees at once that a rider took the delivery.
    io.to(`user:${accepted.order.user_id}`).emit("order:rider-accepted", { orderId, riderId, riderName: req.user.name });
  }
  res.json({ ok: true, orderId, rider_assignment_status: "Accepted" });
}));

// Rider shares only their own device location. Location is visible to authenticated teachers.
// POST /location (rider)
router.post("/location", verifyToken, requireRole("rider"), catchAsync(async (req, res) => {
  const riderId = Number(req.user.id);
  if (req.body && req.body.active === false) {
    await pool.query("INSERT INTO rider_locations (rider_id, active) VALUES (?, 0) ON DUPLICATE KEY UPDATE active = 0, updated_at = CURRENT_TIMESTAMP", [riderId]);
    req.app.get("io").to("teachers").emit("rider:location", { riderId, active: false, updated_at: new Date().toISOString() });
    return res.json({ ok: true, active: false });
  }
  const latitude = Number(req.body && req.body.latitude);
  const longitude = Number(req.body && req.body.longitude);
  const accuracy = req.body && req.body.accuracy != null ? Number(req.body.accuracy) : null;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: "Valid latitude and longitude are required" });
  }
  await pool.query(`INSERT INTO rider_locations (rider_id, latitude, longitude, accuracy_m, active)
    VALUES (?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude), accuracy_m = VALUES(accuracy_m), active = 1, updated_at = CURRENT_TIMESTAMP`,
    [riderId, latitude, longitude, Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null]);
  const location = { riderId, name: req.user.name, latitude, longitude, accuracy_m: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null, active: true, updated_at: new Date().toISOString() };
  req.app.get("io").to("teachers").emit("rider:location", location);
  res.json({ ok: true, location });
  // This rider may be the first one in range for an order that has been waiting.
  riderDispatcher.dispatchQuietly({ io: req.app.get("io"), req, minGapMs: DISPATCH_GAP_MS });
}));

// GET /orders/summary (rider)
router.get("/orders/summary", verifyToken, requireRole("rider"), catchAsync(async (_req, res) => {
  const riderId = Number(_req.user.id);
  const [counts] = await pool.query(`SELECT status, COUNT(*) AS total FROM orders
    WHERE rider_id = ? AND rider_assignment_status IN ('Assigned','Accepted')
      AND status IN ('Received','Cooking','Ready') GROUP BY status`, [riderId]);
  const summary = { total: 0, received: 0, cooking: 0, ready: 0 };
  for (const row of counts) {
    const key = String(row.status).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(summary, key)) summary[key] = Number(row.total);
    summary.total += Number(row.total);
  }
  const [recent] = await pool.query(`SELECT id, status, created_at, pickup_time, rider_assignment_status, tip_amount, delivery_note FROM orders
    WHERE rider_id = ? AND rider_assignment_status IN ('Assigned','Accepted')
      AND status IN ('Received','Cooking','Ready') ORDER BY created_at DESC LIMIT 20`, [riderId]);
  // Feature: rider tip — tips already paid to this rider
  const [[tips]] = await pool.query(
    `SELECT COALESCE(SUM(tip_amount), 0) AS total,
            COALESCE(SUM(CASE WHEN picked_up_at >= CURDATE() THEN tip_amount ELSE 0 END), 0) AS today
     FROM orders WHERE rider_id = ? AND tip_settled = 1`, [riderId]);
  // Feature: rate your rider — average stars and the latest comments (the student's name is not shown)
  const [[rt]] = await pool.query("SELECT COALESCE(AVG(rider_rating), 0) AS avg, COUNT(rider_rating) AS cnt FROM orders WHERE rider_id = ? AND rider_rating IS NOT NULL", [riderId]);
  const [reviews] = await pool.query(
    "SELECT rider_rating AS rating, rider_comment AS comment, rider_rated_at AS at FROM orders WHERE rider_id = ? AND rider_rating IS NOT NULL ORDER BY rider_rated_at DESC LIMIT 5", [riderId]);
  // Only a number: how many teacher orders still wait for a rider (no customer details).
  const [[waiting]] = await pool.query(`SELECT COUNT(*) AS total FROM orders o JOIN users u ON u.id = o.user_id
    WHERE o.rider_id IS NULL AND o.rider_assignment_status = 'Unassigned' AND u.role = 'teacher'
      AND o.status IN ('Received','Cooking','Ready') AND o.picked_up_at IS NULL`);
  res.json({ ...summary, waiting_orders: Number(waiting.total), tips_total: Number(tips.total), tips_today: Number(tips.today), rating_avg: Number(rt.avg), rating_count: Number(rt.cnt), reviews, orders: recent });
}));

// GET /locations (teacher)
router.get("/locations", verifyToken, requireRole("teacher"), catchAsync(async (_req, res) => {
  const [rows] = await pool.query(`SELECT u.id AS riderId, u.name, u.external_id, l.latitude, l.longitude, l.accuracy_m, CASE WHEN l.updated_at >= NOW() - INTERVAL 30 SECOND THEN l.active ELSE 0 END AS active, l.updated_at
    FROM users u LEFT JOIN rider_locations l ON l.rider_id = u.id WHERE u.role = 'rider' ORDER BY u.name`);
  res.json(rows.map(publicRiderLocation));
}));
module.exports = router;
