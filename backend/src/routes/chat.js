const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();
const MAX_MESSAGE_LENGTH = 4000;

async function getAdminId(connection) {
  const [[admin]] = await connection.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
  return admin ? admin.id : null;
}

router.get("/conversations", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const [conversations] = await pool.query(
      `SELECT c.id AS conversation_id, u.id AS user_id, u.name, u.role,
              c.updated_at,
              (SELECT CASE WHEN deleted_at IS NULL THEN message ELSE 'Message deleted' END FROM chat_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) AS last_message,
              SUM(CASE WHEN m.recipient_id = ? AND m.read_at IS NULL THEN 1 ELSE 0 END) AS unread_count
       FROM chat_conversations c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN chat_messages m ON m.conversation_id = c.id
       GROUP BY c.id, u.id, u.name, u.role, c.updated_at
       ORDER BY c.updated_at DESC`,
      [req.user.id]
    );
    res.json({ conversations });
  } catch (error) {
    console.error("Failed to load chat conversations:", error);
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

router.get("/messages", verifyToken, requireRole("student", "teacher"), async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [[conversation]] = await connection.query(
      "SELECT id FROM chat_conversations WHERE user_id = ?",
      [req.user.id]
    );
    if (!conversation) return res.json({ conversationId: null, messages: [] });

    await connection.query(
      "UPDATE chat_messages SET read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND recipient_id = ? AND read_at IS NULL",
      [conversation.id, req.user.id]
    );
    const [messages] = await connection.query(
      `SELECT m.id, m.sender_id, m.recipient_id, CASE WHEN m.deleted_at IS NULL THEN m.message ELSE '' END AS message, m.deleted_at, m.created_at, m.read_at,
              u.name AS sender_name, u.role AS sender_role
       FROM chat_messages m JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? ORDER BY m.id ASC`,
      [conversation.id]
    );
    res.json({ conversationId: conversation.id, messages });
  } catch (error) {
    console.error("Failed to load chat messages:", error);
    res.status(500).json({ error: "Failed to load messages" });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/:userId/messages", verifyToken, requireRole("admin"), async (req, res) => {
  let connection;
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user ID" });
    connection = await pool.getConnection();
    const [[user]] = await connection.query(
      "SELECT id, name, role FROM users WHERE id = ? AND role IN ('student', 'teacher')",
      [userId]
    );
    if (!user) return res.status(404).json({ error: "Chat user not found" });

    const [[conversation]] = await connection.query(
      "SELECT id FROM chat_conversations WHERE user_id = ?",
      [userId]
    );
    if (!conversation) return res.json({ conversationId: null, user, messages: [] });

    await connection.query(
      "UPDATE chat_messages SET read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND recipient_id = ? AND read_at IS NULL",
      [conversation.id, req.user.id]
    );
    const [messages] = await connection.query(
      `SELECT m.id, m.sender_id, m.recipient_id, CASE WHEN m.deleted_at IS NULL THEN m.message ELSE '' END AS message, m.deleted_at, m.created_at, m.read_at,
              u.name AS sender_name, u.role AS sender_role
       FROM chat_messages m JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? ORDER BY m.id ASC`,
      [conversation.id]
    );
    res.json({ conversationId: conversation.id, user, messages });
  } catch (error) {
    console.error("Failed to load admin chat:", error);
    res.status(500).json({ error: "Failed to load messages" });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/messages", verifyToken, requireRole("student", "teacher", "admin"), async (req, res) => {
  let connection;
  try {
    const message = String(req.body.message || "").trim();
    if (!message) return res.status(400).json({ error: "Message cannot be empty" });
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
    }

    connection = await pool.getConnection();
    const isAdmin = req.user.role === "admin";
    let userId;
    let recipientId;

    if (isAdmin) {
      userId = Number(req.body.userId);
      if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Select a chat recipient" });
      const [[recipient]] = await connection.query(
        "SELECT id FROM users WHERE id = ? AND role IN ('student', 'teacher')",
        [userId]
      );
      if (!recipient) return res.status(404).json({ error: "Chat user not found" });
      recipientId = userId;
    } else {
      userId = req.user.id;
      recipientId = await getAdminId(connection);
      if (!recipientId) return res.status(503).json({ error: "Admin chat is unavailable" });
    }

    await connection.beginTransaction();
    await connection.query(
      "INSERT INTO chat_conversations (user_id) VALUES (?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP",
      [userId]
    );
    const [[conversation]] = await connection.query(
      "SELECT id FROM chat_conversations WHERE user_id = ? FOR UPDATE",
      [userId]
    );
    const [result] = await connection.query(
      "INSERT INTO chat_messages (conversation_id, sender_id, recipient_id, message) VALUES (?, ?, ?, ?)",
      [conversation.id, req.user.id, recipientId, message]
    );
    await connection.query("UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [conversation.id]);
    await connection.commit();

    const payload = {
      id: result.insertId,
      conversationId: conversation.id,
      senderId: req.user.id,
      recipientId,
      senderName: req.user.name,
      senderRole: req.user.role,
      message,
      createdAt: new Date().toISOString(),
    };
    const io = req.app.get("io");
    io.to(`user:${req.user.id}`).emit("chat:message", payload);
    io.to(`user:${recipientId}`).emit("chat:message", payload);
    res.status(201).json({ message: payload });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("Failed to send chat message:", error);
    res.status(500).json({ error: "Failed to send message" });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/order/:orderId/messages", verifyToken, requireRole("student", "teacher", "rider"), catchAsync(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "Invalid order ID" });
  const [[order]] = await pool.query("SELECT id, user_id, rider_id FROM orders WHERE id = ?", [orderId]);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (Number(req.user.id) !== Number(order.user_id) && Number(req.user.id) !== Number(order.rider_id)) {
    return res.status(403).json({ error: "Only the order customer and assigned rider can access this chat" });
  }

  await pool.query(`
    UPDATE direct_order_messages SET read_at = NOW()
    WHERE order_id = ? AND recipient_id = ? AND read_at IS NULL
  `, [orderId, req.user.id]);
  const [messages] = await pool.query(`
    SELECT m.id, m.sender_id, m.recipient_id, m.message, m.created_at,
      u.name AS sender_name, u.role AS sender_role
    FROM (
      SELECT id, sender_id, recipient_id, message, created_at
      FROM direct_order_messages WHERE order_id = ? ORDER BY id DESC LIMIT 200
    ) m JOIN users u ON u.id = m.sender_id
    ORDER BY m.id ASC
  `, [orderId]);
  res.json({ orderId, messages });
}));

router.post("/order/:orderId/messages", verifyToken, requireRole("student", "teacher", "rider"), catchAsync(async (req, res) => {
  const orderId = Number(req.params.orderId);
  const message = String((req.body && req.body.message) || "").trim();
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "Invalid order ID" });
  if (!message || message.length > 1000) {
    return res.status(400).json({ error: "Message must contain 1-1000 characters" });
  }
  const [[order]] = await pool.query("SELECT id, user_id, rider_id FROM orders WHERE id = ?", [orderId]);
  if (!order) return res.status(404).json({ error: "Order not found" });

  let recipientId;
  if (Number(req.user.id) === Number(order.user_id) && order.rider_id != null) {
    recipientId = Number(order.rider_id);
  } else if (Number(req.user.id) === Number(order.rider_id)) {
    recipientId = Number(order.user_id);
  } else {
    return res.status(403).json({ error: "Only the order customer and assigned rider can message each other" });
  }
  if (!recipientId) return res.status(409).json({ error: "A rider has not been assigned to this order yet" });

  const [result] = await pool.query(`
    INSERT INTO direct_order_messages (order_id, sender_id, recipient_id, message)
    VALUES (?, ?, ?, ?)
  `, [orderId, req.user.id, recipientId, message]);
  const payload = {
    id: result.insertId,
    orderId,
    sender_id: Number(req.user.id),
    recipient_id: recipientId,
    message,
    sender_name: req.user.name,
    sender_role: req.user.role,
    created_at: new Date().toISOString(),
  };
  const io = req.app.get("io");
  io.to(`user:${recipientId}`).emit("order-chat:message", payload);
  io.to(`user:${req.user.id}`).emit("order-chat:message", payload);
  res.status(201).json({ message: payload });
}));

// Delete (hide) one of MY messages for everyone. The row stays, its text is blanked on read.
router.delete("/messages/:id", verifyToken, requireRole("student", "teacher", "admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid message id" });
    const [[row]] = await pool.query("SELECT recipient_id FROM chat_messages WHERE id = ? AND sender_id = ? AND deleted_at IS NULL", [id, req.user.id]);
    if (!row) return res.status(404).json({ error: "Message not found" });
    await pool.query("UPDATE chat_messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${req.user.id}`).emit("chat:deleted", { id });
      io.to(`user:${row.recipient_id}`).emit("chat:deleted", { id });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete chat message:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

module.exports = router;
