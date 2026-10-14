const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const normPhone = (p) => String(p).replace(/[\s-]/g, "");

router.get("/", verifyToken, async (req, res) => {
  const [rows] = await pool.query("SELECT id, name, external_id, email, phone, role, wallet_balance, created_at FROM users WHERE id = ?", [req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "User not found" });
  res.json({ user: rows[0] });
});

router.put("/", verifyToken, async (req, res) => {
  const fields = [], values = [];
  if (req.body.name !== undefined) { const n = String(req.body.name).trim(); if (!n || n.length > 100) return res.status(400).json({ error: "Name must be 1-100 characters" }); fields.push("name = ?"); values.push(n); }
  if (req.body.email !== undefined) { const e = String(req.body.email || "").trim(); if (e && !/^\S+@\S+\.\S+$/.test(e)) return res.status(400).json({ error: "Invalid email format" }); fields.push("email = ?"); values.push(e || null); }
  if (req.body.phone !== undefined) { const p = req.body.phone ? normPhone(req.body.phone) : ""; if (p && !/^\+?\d{10,15}$/.test(p)) return res.status(400).json({ error: "Invalid phone number" }); fields.push("phone = ?"); values.push(p || null); }
  if (!fields.length) return res.status(400).json({ error: "No fields to update" });
  try { await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, [...values, req.user.id]); }
  catch (err) { if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That email is already used by another account" }); throw err; }
  res.json({ success: true, message: "Profile updated successfully" });
});

router.post("/change-password", verifyToken, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Current and new password are required" });
  if (String(newPassword).length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: "Passwords do not match" });
  const [rows] = await pool.query("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
  if (!rows.length || !(await bcrypt.compare(String(currentPassword), rows[0].password_hash))) return res.status(401).json({ error: "Current password is incorrect" });
  await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(String(newPassword), 10), req.user.id]);
  res.json({ success: true, message: "Password changed successfully" });
});

// Account statistics (this endpoint existed only inside a commented-out block before)
router.get("/stats", verifyToken, async (req, res) => {
  const [[o]] = await pool.query("SELECT COUNT(*) AS total, COALESCE(SUM(total - refund_amount), 0) AS spent FROM orders WHERE user_id = ? AND NOT (status IN ('Cancelled','Refunded') AND payment_method <> 'wallet')", [req.user.id]);
  const [[p]] = await pool.query("SELECT COUNT(*) AS c FROM orders WHERE user_id = ? AND status IN ('Received','Confirmed','Cooking')", [req.user.id]);
  const [[f]] = await pool.query("SELECT COUNT(*) AS c FROM user_favorites WHERE user_id = ?", [req.user.id]);
  const [[fav]] = await pool.query("SELECT oi.name, SUM(oi.qty) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = ? AND o.status NOT IN ('Cancelled','Refunded') GROUP BY oi.name ORDER BY n DESC LIMIT 1", [req.user.id]);
  res.json({ stats: { totalOrders: o.total, totalSpent: o.spent, pendingOrders: p.c, favoriteItems: f.c, mostOrdered: fav ? fav.name : null } });
});

module.exports = router;
