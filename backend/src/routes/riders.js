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
  res.json({ ...summary, tips_total: Number(tips.total), tips_today: Number(tips.today), rating_avg: Number(rt.avg), rating_count: Number(rt.cnt), reviews, orders: recent });
}));

router.get("/locations", verifyToken, requireRole("teacher"), catchAsync(async (_req, res) => {
  const [rows] = await pool.query(`SELECT u.id AS riderId, u.name, u.external_id, l.latitude, l.longitude, l.accuracy_m, CASE WHEN l.updated_at >= NOW() - INTERVAL 30 SECOND THEN l.active ELSE 0 END AS active, l.updated_at
    FROM users u LEFT JOIN rider_locations l ON l.rider_id = u.id WHERE u.role = 'rider' ORDER BY u.name`);
  res.json(rows.map(r => ({ ...r, latitude: r.latitude == null ? null : Number(r.latitude), longitude: r.longitude == null ? null : Number(r.longitude), accuracy_m: r.accuracy_m == null ? null : Number(r.accuracy_m), active: Boolean(r.active) })));
}));
// Feature: admin rider ratings
const RATING_DAYS = [0, 7, 30]; // 0 = all time
const ratingDays = (v) => (RATING_DAYS.includes(Number(v)) ? Number(v) : 0);

// GET /api/riders/ratings?days=0|7|30  (admin) — one row per rider
router.get("/ratings", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const days = ratingDays(req.query.days);
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.external_id,
            COUNT(o.rider_rating) AS rating_count,
            AVG(o.rider_rating) AS rating_avg,
            COALESCE(SUM(o.rider_rating = 5), 0) AS five_star,
            COALESCE(SUM(o.rider_rating <= 2), 0) AS low_star,
            (SELECT COUNT(*) FROM orders d WHERE d.rider_id = u.id AND d.picked_up_at IS NOT NULL) AS delivered
     FROM users u
     LEFT JOIN orders o ON o.rider_id = u.id AND o.rider_rating IS NOT NULL${days ? " AND o.rider_rated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)" : ""}
     WHERE u.role = 'rider'
     GROUP BY u.id, u.name, u.external_id
     ORDER BY (COUNT(o.rider_rating) = 0), AVG(o.rider_rating) DESC, COUNT(o.rider_rating) DESC, u.name`,
    days ? [days] : []);
  res.json({
    days,
    riders: rows.map((r) => ({
      id: r.id, name: r.name, external_id: r.external_id,
      rating_count: Number(r.rating_count),
      rating_avg: r.rating_avg === null ? null : Math.round(Number(r.rating_avg) * 10) / 10,
      five_star: Number(r.five_star), low_star: Number(r.low_star),
      delivered: Number(r.delivered),
    })),
  });
}));

// GET /api/riders/ratings/:id?days=...  (admin) — that rider's latest reviews
router.get("/ratings/:id", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid rider" });
  const days = ratingDays(req.query.days);
  const [rows] = await pool.query(
    `SELECT o.rider_rating AS rating, o.rider_comment AS comment, o.rider_rated_at AS at, o.token, u.name AS student
     FROM orders o JOIN users u ON u.id = o.user_id
     WHERE o.rider_id = ? AND o.rider_rating IS NOT NULL${days ? " AND o.rider_rated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)" : ""}
     ORDER BY o.rider_rated_at DESC LIMIT 20`,
    days ? [id, days] : [id]);
  res.json(rows);
}));

module.exports = router;
