const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();

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
