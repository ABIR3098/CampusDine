const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const { recordAuditEvent } = require("../utils/audit");

const router = express.Router();

router.get("/riders/shift/me", verifyToken, requireRole("rider"), catchAsync(async (req, res) => {
  const [[shift]] = await pool.query(`
    SELECT id, status, max_orders AS maxOrders FROM rider_shifts
    WHERE rider_id = ? AND status = 'ON_DUTY' ORDER BY id DESC LIMIT 1
  `, [Number(req.user.id)]);
  res.json(shift || { status: "OFF_DUTY" });
}));

router.post("/riders/shift/start", verifyToken, requireRole("rider"), catchAsync(async (req, res) => {
  const requestedMaxOrders = req.body && req.body.maxOrders;
  const maxOrders = requestedMaxOrders === undefined ? 3 : Number(requestedMaxOrders);
  if (!Number.isInteger(maxOrders) || maxOrders < 1 || maxOrders > 10) {
    return res.status(400).json({ error: "maxOrders must be an integer from 1 to 10" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("SELECT id FROM users WHERE id = ? AND role = 'rider' FOR UPDATE", [Number(req.user.id)]);
    const [[existing]] = await connection.query(
      "SELECT id FROM rider_shifts WHERE rider_id = ? AND status = 'ON_DUTY' LIMIT 1",
      [Number(req.user.id)]
    );
    if (existing) {
      await connection.rollback();
      return res.status(409).json({ error: "Your shift is already active" });
    }
    const [result] = await connection.query(
      "INSERT INTO rider_shifts (rider_id, status, max_orders, started_at) VALUES (?, 'ON_DUTY', ?, NOW())",
      [Number(req.user.id), maxOrders]
    );
    await recordAuditEvent(connection, req, "RIDER_SHIFT_START", "rider", req.user.id, { maxOrders });
    await connection.commit();
    res.status(201).json({ ok: true, shiftId: result.insertId, status: "ON_DUTY", maxOrders });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.post("/riders/shift/end", verifyToken, requireRole("rider"), catchAsync(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "UPDATE rider_shifts SET status = 'OFF_DUTY', ended_at = NOW() WHERE rider_id = ? AND status = 'ON_DUTY'",
      [Number(req.user.id)]
    );
    await connection.query("UPDATE rider_locations SET active = 0 WHERE rider_id = ?", [Number(req.user.id)]);
    if (result.affectedRows) {
      await recordAuditEvent(connection, req, "RIDER_SHIFT_END", "rider", req.user.id);
    }
    await connection.commit();
    res.json({ ok: true, ended: result.affectedRows });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get("/riders/shifts", verifyToken, requireRole("teacher", "admin"), catchAsync(async (_req, res) => {
  const [shifts] = await pool.query(`
    SELECT s.id, s.rider_id AS riderId, u.name, u.external_id AS externalId,
      s.status, s.max_orders AS maxOrders,
      (SELECT COUNT(*) FROM orders o
       WHERE o.rider_id = s.rider_id AND o.rider_assignment_status IN ('Assigned', 'Accepted')
         AND o.status <> 'Cancelled') AS activeOrders
    FROM rider_shifts s JOIN users u ON u.id = s.rider_id
    WHERE s.status = 'ON_DUTY' ORDER BY s.started_at
  `);
  res.json(shifts);
}));

router.get("/riders/assignable-orders", verifyToken, requireRole("teacher", "admin"), catchAsync(async (_req, res) => {
  const [orders] = await pool.query(`
    SELECT id, token, status, created_at, rider_id, rider_assignment_status
    FROM orders
    WHERE status IN ('Received', 'Cooking', 'Ready')
      AND (rider_id IS NULL OR rider_assignment_status = 'Assigned')
    ORDER BY created_at ASC LIMIT 200
  `);
  res.json(orders);
}));

router.post("/orders/:id/assign-rider", verifyToken, requireRole("teacher", "admin"), catchAsync(async (req, res) => {
  const orderId = Number(req.params.id);
  const riderId = Number(req.body && req.body.riderId);
  if (!Number.isInteger(orderId) || orderId < 1 || !Number.isInteger(riderId) || riderId < 1) {
    return res.status(400).json({ error: "Valid order and rider IDs are required" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[order]] = await connection.query(
      "SELECT id, status, rider_id, rider_assignment_status FROM orders WHERE id = ? FOR UPDATE",
      [orderId]
    );
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: "Order not found" });
    }
    if (!["Received", "Cooking", "Ready"].includes(order.status)
      || (order.rider_id != null && order.rider_assignment_status !== "Assigned")) {
      await connection.rollback();
      return res.status(409).json({ error: "Order is no longer available for assignment" });
    }

    const [[shift]] = await connection.query(`
      SELECT id, max_orders FROM rider_shifts
      WHERE rider_id = ? AND status = 'ON_DUTY' FOR UPDATE
    `, [riderId]);
    if (!shift) {
      await connection.rollback();
      return res.status(409).json({ error: "Rider is not on duty" });
    }
    const [[load]] = await connection.query(`
      SELECT COUNT(*) AS active_orders FROM orders
      WHERE rider_id = ? AND id <> ?
        AND rider_assignment_status IN ('Assigned', 'Accepted') AND status <> 'Cancelled'
    `, [riderId, orderId]);
    if (Number(load.active_orders) >= Number(shift.max_orders)) {
      await connection.rollback();
      return res.status(409).json({ error: "Rider has reached their active-order capacity" });
    }

    await connection.query(`
      UPDATE orders SET rider_id = ?, rider_assignment_status = 'Assigned'
      WHERE id = ? AND status IN ('Received', 'Cooking', 'Ready')
        AND (rider_id IS NULL OR rider_assignment_status = 'Assigned')
    `, [riderId, orderId]);
    await recordAuditEvent(connection, req, "MANUAL_RIDER_ASSIGN", "order", orderId, { riderId });
    await connection.commit();
    req.app.get("io").to(`rider:${riderId}`).emit("rider:order-assigned", { orderId });
    res.json({ ok: true, orderId, riderId, status: "Assigned" });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get("/analytics", verifyToken, requireRole("admin"), catchAsync(async (_req, res) => {
  const [[today]] = await pool.query(`
    SELECT COUNT(*) AS order_count,
      COALESCE(SUM(CASE WHEN status <> 'Cancelled' THEN total ELSE 0 END), 0) AS revenue,
      COALESCE(SUM(status = 'Cancelled'), 0) AS cancelled
    FROM orders
    WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
  `);
  const [popular] = await pool.query(`
    SELECT oi.name, SUM(oi.qty) AS quantity
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status <> 'Cancelled' AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY oi.name ORDER BY quantity DESC LIMIT 8
  `);
  const [busyHours] = await pool.query(`
    SELECT HOUR(created_at) AS hour, COUNT(*) AS order_count
    FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY HOUR(created_at) ORDER BY order_count DESC LIMIT 8
  `);
  const [riders] = await pool.query(`
    SELECT u.name, COUNT(o.id) AS delivered
    FROM users u LEFT JOIN orders o
      ON o.rider_id = u.id AND o.rider_assignment_status = 'Completed' AND o.status <> 'Cancelled'
    WHERE u.role = 'rider'
    GROUP BY u.id, u.name ORDER BY delivered DESC LIMIT 20
  `);
  res.json({
    today: {
      orders: Number(today.order_count),
      revenue: Number(today.revenue),
      cancelled: Number(today.cancelled),
    },
    popular,
    busyHours,
    riders,
  });
}));

router.get("/fraud-events", verifyToken, requireRole("admin"), catchAsync(async (_req, res) => {
  const [events] = await pool.query(`
    SELECT f.id, f.event_type, f.severity, f.details_json, f.ip_address, f.created_at,
      u.name AS user_name, u.external_id
    FROM fraud_events f LEFT JOIN users u ON u.id = f.user_id
    ORDER BY f.id DESC LIMIT 200
  `);
  res.json(events);
}));

router.get("/audit", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const requestedLimit = Number(req.query.limit || 100);
  const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(300, requestedLimit)) : 100;
  const [events] = await pool.query(`
    SELECT a.id, a.actor_role, a.action, a.entity_type, a.entity_id, a.details_json,
      a.ip_address, a.created_at, u.name AS actor_name
    FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
    ORDER BY a.id DESC LIMIT ?
  `, [limit]);
  res.json(events);
}));

router.get("/riders/route", verifyToken, requireRole("rider"), catchAsync(async (req, res) => {
  const [[origin]] = await pool.query(
    "SELECT latitude, longitude FROM rider_locations WHERE rider_id = ? AND active = 1 AND updated_at >= NOW() - INTERVAL 90 SECOND",
    [Number(req.user.id)]
  );
  if (!origin || origin.latitude == null || origin.longitude == null) {
    return res.status(409).json({ error: "Start GPS sharing before optimizing your route" });
  }

  const [orders] = await pool.query(`
    SELECT id, token, status, delivery_lat, delivery_lng
    FROM orders
    WHERE rider_id = ? AND rider_assignment_status IN ('Assigned', 'Accepted')
      AND status <> 'Cancelled' AND delivery_lat IS NOT NULL AND delivery_lng IS NOT NULL
  `, [Number(req.user.id)]);

  const radians = (degrees) => degrees * Math.PI / 180;
  const distanceKm = (lat1, lng1, lat2, lng2) => {
    const deltaLat = radians(lat2 - lat1);
    const deltaLng = radians(lng2 - lng1);
    const a = Math.sin(deltaLat / 2) ** 2
      + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const remaining = [...orders];
  const route = [];
  let latitude = Number(origin.latitude);
  let longitude = Number(origin.longitude);
  while (remaining.length) {
    remaining.sort((a, b) => distanceKm(latitude, longitude, Number(a.delivery_lat), Number(a.delivery_lng))
      - distanceKm(latitude, longitude, Number(b.delivery_lat), Number(b.delivery_lng)));
    const next = remaining.shift();
    const distanceFromPreviousKm = distanceKm(latitude, longitude, Number(next.delivery_lat), Number(next.delivery_lng));
    route.push({ ...next, distanceFromPreviousKm: Number(distanceFromPreviousKm.toFixed(2)) });
    latitude = Number(next.delivery_lat);
    longitude = Number(next.delivery_lng);
  }

  res.json({
    algorithm: "nearest-neighbour straight-line estimate; not road routing",
    route,
  });
}));

module.exports = router;
