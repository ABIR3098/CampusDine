const crypto = require("crypto");
const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();
router.use(verifyToken, requireRole("student", "teacher"));

router.post("/", catchAsync(async (req, res) => {
  const title = String((req.body && req.body.title) || "Campus group order").trim().slice(0, 100);
  if (!title) return res.status(400).json({ error: "Group title is required" });
  const joinCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  const closesAt = new Date(Date.now() + 30 * 60 * 1000);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [group] = await connection.query(
      "INSERT INTO group_orders (host_user_id, title, join_code, closes_at) VALUES (?, ?, ?, ?)",
      [req.user.id, title, joinCode, closesAt]
    );
    await connection.query(
      "INSERT INTO group_order_members (group_id, user_id) VALUES (?, ?)",
      [group.insertId, req.user.id]
    );
    await connection.commit();
    res.status(201).json({
      id: group.insertId,
      title,
      joinCode,
      closesAt,
      hostUserId: req.user.id,
      status: "OPEN",
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.post("/join", catchAsync(async (req, res) => {
  const joinCode = String((req.body && req.body.joinCode) || "").trim().toUpperCase();
  if (!joinCode) return res.status(400).json({ error: "joinCode is required" });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[group]] = await connection.query(
      "SELECT id, title, join_code, closes_at, status FROM group_orders WHERE join_code = ? FOR UPDATE",
      [joinCode]
    );
    if (!group) {
      await connection.rollback();
      return res.status(404).json({ error: "Group order not found" });
    }
    if (group.status !== "OPEN" || new Date(group.closes_at) <= new Date()) {
      await connection.rollback();
      return res.status(409).json({ error: "This group order is closed" });
    }
    await connection.query(
      "INSERT IGNORE INTO group_order_members (group_id, user_id) VALUES (?, ?)",
      [group.id, req.user.id]
    );
    await connection.commit();
    res.json({ ok: true, groupId: group.id, title: group.title, joinCode: group.join_code });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get("/", catchAsync(async (req, res) => {
  const [groups] = await pool.query(`
    SELECT g.id, g.title, g.join_code AS joinCode, g.closes_at AS closesAt,
      g.status, g.host_user_id AS hostUserId, u.name AS hostName,
      (SELECT COUNT(*) FROM group_order_members m WHERE m.group_id = g.id) AS members
    FROM group_orders g JOIN users u ON u.id = g.host_user_id
    WHERE g.status = 'OPEN' AND g.closes_at > NOW()
      AND EXISTS (SELECT 1 FROM group_order_members m WHERE m.group_id = g.id AND m.user_id = ?)
    ORDER BY g.created_at DESC
  `, [req.user.id]);
  res.json(groups);
}));

router.get("/:id", catchAsync(async (req, res) => {
  const groupId = Number(req.params.id);
  if (!Number.isInteger(groupId) || groupId < 1) return res.status(400).json({ error: "Invalid group ID" });
  const [[group]] = await pool.query("SELECT * FROM group_orders WHERE id = ?", [groupId]);
  if (!group) return res.status(404).json({ error: "Group not found" });
  const [[membership]] = await pool.query(
    "SELECT user_id FROM group_order_members WHERE group_id = ? AND user_id = ?",
    [groupId, req.user.id]
  );
  if (!membership) return res.status(403).json({ error: "Join this group first" });
  const [members] = await pool.query(`
    SELECT m.user_id AS userId, u.name, u.role FROM group_order_members m
    JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.joined_at
  `, [groupId]);
  const [items] = await pool.query(`
    SELECT i.id, i.user_id AS userId, u.name AS addedBy,
      i.menu_item_id AS menuItemId, mi.name AS itemName, i.qty, mi.price
    FROM group_order_items i JOIN users u ON u.id = i.user_id
    JOIN menu_items mi ON mi.id = i.menu_item_id
    WHERE i.group_id = ? ORDER BY i.id
  `, [groupId]);
  res.json({
    group: {
      id: group.id,
      title: group.title,
      joinCode: group.join_code,
      hostUserId: group.host_user_id,
      closesAt: group.closes_at,
      status: group.status,
    },
    members,
    items,
  });
}));

router.post("/:id/items", catchAsync(async (req, res) => {
  const groupId = Number(req.params.id);
  const menuItemId = Number(req.body && req.body.menuItemId);
  const quantity = Number(req.body && req.body.qty);
  if (!Number.isInteger(groupId) || groupId < 1
    || !Number.isInteger(menuItemId) || menuItemId < 1
    || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return res.status(400).json({ error: "Valid group, menu item, and quantity (1-20) are required" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[group]] = await connection.query(
      "SELECT id, status, closes_at FROM group_orders WHERE id = ? FOR UPDATE",
      [groupId]
    );
    if (!group) {
      await connection.rollback();
      return res.status(404).json({ error: "Group not found" });
    }
    if (group.status !== "OPEN" || new Date(group.closes_at) <= new Date()) {
      await connection.rollback();
      return res.status(409).json({ error: "Group order is closed" });
    }
    const [[membership]] = await connection.query(
      "SELECT user_id FROM group_order_members WHERE group_id = ? AND user_id = ?",
      [groupId, req.user.id]
    );
    if (!membership) {
      await connection.rollback();
      return res.status(403).json({ error: "Join the group first" });
    }
    const [[menuItem]] = await connection.query(
      "SELECT id, stock, availability FROM menu_items WHERE id = ? FOR UPDATE",
      [menuItemId]
    );
    if (!menuItem || menuItem.availability !== "available" || Number(menuItem.stock) < quantity) {
      await connection.rollback();
      return res.status(409).json({ error: "Menu item unavailable or insufficient stock" });
    }
    const [[groupQuantity]] = await connection.query(
      "SELECT COALESCE(SUM(qty), 0) AS quantity FROM group_order_items WHERE group_id = ? AND menu_item_id = ?",
      [groupId, menuItemId]
    );
    if (Number(groupQuantity.quantity) + quantity > Math.min(20, Number(menuItem.stock))) {
      await connection.rollback();
      return res.status(409).json({ error: "Group quantity exceeds current stock or the 20-item limit" });
    }
    await connection.query(`
      INSERT INTO group_order_items (group_id, user_id, menu_item_id, qty)
      VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)
    `, [groupId, req.user.id, menuItemId, quantity]);
    await connection.commit();
    res.status(201).json({ ok: true });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.post("/:id/close", catchAsync(async (req, res) => {
  const groupId = Number(req.params.id);
  if (!Number.isInteger(groupId) || groupId < 1) return res.status(400).json({ error: "Invalid group ID" });
  const [result] = await pool.query(`
    UPDATE group_orders SET status = 'CLOSED'
    WHERE id = ? AND host_user_id = ? AND status = 'OPEN'
  `, [groupId, req.user.id]);
  if (!result.affectedRows) return res.status(409).json({ error: "Only the host can close an open group" });
  res.json({ ok: true });
}));

module.exports = router;
