const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const { recordAuditEvent } = require("../utils/audit");
const router = express.Router();

router.post("/orders/assign-pending", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const { assignOrderToBestRider } = require("../utils/riderAssignment");
  const connection = await pool.getConnection();
  const assigned = [];
  try {
    const [pending] = await connection.query(`
      SELECT id FROM orders
      WHERE rider_id IS NULL AND rider_assignment_status = 'Unassigned'
        AND status IN ('Received', 'Cooking', 'Ready')
      ORDER BY created_at ASC LIMIT 100
    `);
    for (const order of pending) {
      await connection.beginTransaction();
      try {
        const riderId = await assignOrderToBestRider(connection, Number(order.id));
        if (riderId) {
          await recordAuditEvent(connection, req, "AUTO_RIDER_ASSIGN", "order", order.id, { riderId });
        }
        await connection.commit();
        if (riderId) {
          assigned.push({ orderId: Number(order.id), riderId });
          req.app.get("io").to(`rider:${riderId}`).emit("rider:order-assigned", { orderId: Number(order.id) });
        }
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    connection.release();
  }
  res.json({ ok: true, assigned, count: assigned.length });
}));

router.get("/orders", verifyToken, requireRole("rider"), catchAsync(async (req, res) => {
  const [orders] = await pool.query(`
    SELECT o.id, o.token, o.total, o.status, o.pickup_time, o.note,
      o.rider_assignment_status, o.created_at,
      u.name AS customer_name, u.phone AS customer_phone, u.address AS customer_address
    FROM orders o JOIN users u ON u.id = o.user_id
    WHERE o.rider_id = ? AND o.rider_assignment_status IN ('Assigned', 'Accepted')
      AND o.status <> 'Cancelled'
    ORDER BY o.created_at ASC
  `, [Number(req.user.id)]);
  res.json(orders);
}));

router.post("/orders/:orderId/accept", verifyToken, requireRole("rider"), catchAsync(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "Invalid order ID" });
  const [result] = await pool.query(`
    UPDATE orders SET rider_assignment_status = 'Accepted'
    WHERE id = ? AND rider_id = ? AND rider_assignment_status = 'Assigned' AND status <> 'Cancelled'
  `, [orderId, Number(req.user.id)]);
  if (!result.affectedRows) return res.status(409).json({ error: "Order is not assigned to you or is no longer available" });
  req.app.get("io").to("admins").emit("rider:order-accepted", { orderId, riderId: Number(req.user.id) });
  res.json({ ok: true, orderId, rider_assignment_status: "Accepted" });
}));

// Rider shares only their own device location. Location is visible to authenticated teachers.
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
}));

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
  const [recent] = await pool.query(`SELECT id, status, created_at, pickup_time, rider_assignment_status FROM orders
    WHERE rider_id = ? AND rider_assignment_status IN ('Assigned','Accepted')
      AND status IN ('Received','Cooking','Ready') ORDER BY created_at DESC LIMIT 20`, [riderId]);
  res.json({ ...summary, orders: recent });
}));

router.get("/locations", verifyToken, requireRole("teacher"), catchAsync(async (_req, res) => {
  const [rows] = await pool.query(`SELECT u.id AS riderId, u.name, u.external_id, l.latitude, l.longitude, l.accuracy_m, CASE WHEN l.updated_at >= NOW() - INTERVAL 30 SECOND THEN l.active ELSE 0 END AS active, l.updated_at
    FROM users u LEFT JOIN rider_locations l ON l.rider_id = u.id WHERE u.role = 'rider' ORDER BY u.name`);
  res.json(rows.map(r => ({ ...r, latitude: r.latitude == null ? null : Number(r.latitude), longitude: r.longitude == null ? null : Number(r.longitude), accuracy_m: r.accuracy_m == null ? null : Number(r.accuracy_m), active: Boolean(r.active) })));
}));
module.exports = router;
