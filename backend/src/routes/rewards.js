const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const { withTransaction } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { REWARDS } = require("../utils/loyalty");

const router = express.Router();
router.use(verifyToken);

// Community impact — meals saved from waste by last-hour deals (visible to everyone).
router.get("/impact", async (req, res) => {
  const base = "FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.original_price IS NOT NULL AND o.status NOT IN ('Cancelled','Refunded')";
  const [[all]] = await pool.query(`SELECT COALESCE(SUM(oi.qty), 0) AS meals, COALESCE(SUM((oi.original_price - oi.price) * oi.qty), 0) AS saved ${base}`);
  const [[mine]] = await pool.query(`SELECT COALESCE(SUM(oi.qty), 0) AS meals, COALESCE(SUM((oi.original_price - oi.price) * oi.qty), 0) AS saved ${base} AND o.user_id = ?`, [req.user.id]);
  res.json({ mealsSaved: Number(all.meals), moneySaved: Number(all.saved), mine: { mealsSaved: Number(mine.meals), moneySaved: Number(mine.saved) } });
});

router.use(requireRole("student", "teacher"));

router.get("/", async (req, res) => {
  const [rows] = await pool.query("SELECT points, lifetime_points, streak, best_streak, last_date FROM loyalty WHERE user_id = ?", [req.user.id]);
  const l = rows[0] || { points: 0, lifetime_points: 0, streak: 0, best_streak: 0, last_date: null };
  const [log] = await pool.query("SELECT points, reason, created_at FROM points_log WHERE user_id = ? ORDER BY id DESC LIMIT 10", [req.user.id]);
  const [coupons] = await pool.query("SELECT code, discount_value, min_order_amount, expiry_date FROM coupons WHERE owner_user_id = ? AND is_active = 1 AND used_count = 0 AND expiry_date > NOW() ORDER BY expiry_date", [req.user.id]);
  res.json({
    points: l.points, lifetimePoints: l.lifetime_points, streak: l.streak, bestStreak: l.best_streak, lastDate: l.last_date,
    nextMilestone: [5, 10, 20].find((m) => m > l.streak) || null,
    rewards: REWARDS.map((r) => ({ ...r, canRedeem: l.points >= r.cost })), log, coupons,
  });
});

// POST { rewardId } — spend points, get a private single-use coupon (valid 30 days).
router.post("/redeem", async (req, res) => {
  const reward = REWARDS.find((r) => r.id === req.body.rewardId);
  if (!reward) return res.status(400).json({ error: "Unknown reward" });
  const out = await withTransaction(async (conn) => {
    const [lrows] = await conn.query("SELECT points FROM loyalty WHERE user_id = ? FOR UPDATE", [req.user.id]);
    const l = lrows[0] || { points: 0 };
    if (l.points < reward.cost) throw { status: 400, message: `You need ${reward.cost} points (you have ${l.points})` };
    const code = `RW${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    await conn.query("UPDATE loyalty SET points = points - ? WHERE user_id = ?", [reward.cost, req.user.id]);
    await conn.query("INSERT INTO points_log (user_id, points, reason) VALUES (?, ?, ?)", [req.user.id, -reward.cost, `Redeemed ৳${reward.discount} coupon`]);
    await conn.query("INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, usage_limit, expiry_date, description, is_active, owner_user_id) VALUES (?, 'FIXED', ?, ?, 1, DATE_ADD(NOW(), INTERVAL 30 DAY), 'Loyalty reward', 1, ?)", [code, reward.discount, reward.minOrder, req.user.id]);
    return { code, discount: reward.discount, minOrder: reward.minOrder, pointsLeft: l.points - reward.cost };
  });
  res.status(201).json(out);
});

module.exports = router;
