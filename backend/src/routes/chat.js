const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();

let chatColumnsReady = null;
function ensureChatColumns() {
  if (!chatColumnsReady) {
    chatColumnsReady = (async () => {
      const add = async (col, ddl) => {
        const [rows] = await pool.query("SHOW COLUMNS FROM chat_messages LIKE '" + col + "'");
        if (rows.length === 0) await pool.query("ALTER TABLE chat_messages ADD COLUMN " + ddl);
      };
      await add("deleted_at", "deleted_at DATETIME NULL");
      await add("reply_to_id", "reply_to_id INT NULL");
      await pool.query("CREATE TABLE IF NOT EXISTS chat_presence (user_id INT NOT NULL PRIMARY KEY, last_seen DATETIME NOT NULL)");
    })().catch((error) => { chatColumnsReady = null; throw error; });
  }
  return chatColumnsReady;
}
router.use(async (req, res, next) => {
  try { await ensureChatColumns(); hookPresence(req.app.get("io")); next(); }
  catch (error) { console.error("Chat schema check failed:", error); res.status(500).json({ error: "Chat is not ready" }); }
});
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

    const [[firstUnread]] = await connection.query(
      "SELECT MIN(id) AS id FROM chat_messages WHERE conversation_id = ? AND recipient_id = ? AND read_at IS NULL AND deleted_at IS NULL",
      [conversation.id, req.user.id]
    );
    await connection.query(
      "UPDATE chat_messages SET read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND recipient_id = ? AND read_at IS NULL",
      [conversation.id, req.user.id]
    );
    const [messages] = await connection.query(
      `SELECT m.id, m.sender_id, m.recipient_id, CASE WHEN m.deleted_at IS NULL THEN m.message ELSE '' END AS message, m.deleted_at, m.created_at, m.read_at,
              m.reply_to_id, r.sender_id AS reply_sender_id, ru.name AS reply_sender_name,
              CASE WHEN r.deleted_at IS NULL THEN LEFT(r.message, 120) ELSE NULL END AS reply_text,
              (r.id IS NOT NULL AND r.deleted_at IS NOT NULL) AS reply_deleted,
              u.name AS sender_name, u.role AS sender_role
       FROM chat_messages m JOIN users u ON u.id = m.sender_id
       LEFT JOIN chat_messages r ON r.id = m.reply_to_id AND r.conversation_id = m.conversation_id
       LEFT JOIN users ru ON ru.id = r.sender_id
       WHERE m.conversation_id = ? ORDER BY m.id ASC`,
      [conversation.id]
    );
    res.json({ conversationId: conversation.id, messages, firstUnreadId: firstUnread ? firstUnread.id : null });
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

    const [[firstUnread]] = await connection.query(
      "SELECT MIN(id) AS id FROM chat_messages WHERE conversation_id = ? AND recipient_id = ? AND read_at IS NULL AND deleted_at IS NULL",
      [conversation.id, req.user.id]
    );
    await connection.query(
      "UPDATE chat_messages SET read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND recipient_id = ? AND read_at IS NULL",
      [conversation.id, req.user.id]
    );
    const [messages] = await connection.query(
      `SELECT m.id, m.sender_id, m.recipient_id, CASE WHEN m.deleted_at IS NULL THEN m.message ELSE '' END AS message, m.deleted_at, m.created_at, m.read_at,
              m.reply_to_id, r.sender_id AS reply_sender_id, ru.name AS reply_sender_name,
              CASE WHEN r.deleted_at IS NULL THEN LEFT(r.message, 120) ELSE NULL END AS reply_text,
              (r.id IS NOT NULL AND r.deleted_at IS NOT NULL) AS reply_deleted,
              u.name AS sender_name, u.role AS sender_role
       FROM chat_messages m JOIN users u ON u.id = m.sender_id
       LEFT JOIN chat_messages r ON r.id = m.reply_to_id AND r.conversation_id = m.conversation_id
       LEFT JOIN users ru ON ru.id = r.sender_id
       WHERE m.conversation_id = ? ORDER BY m.id ASC`,
      [conversation.id]
    );
    res.json({ conversationId: conversation.id, user, messages, firstUnreadId: firstUnread ? firstUnread.id : null });
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
    let replyToId = Number(req.body.replyTo);
    if (Number.isInteger(replyToId) && replyToId > 0) {
      const [[target]] = await connection.query("SELECT id FROM chat_messages WHERE id = ? AND conversation_id = ?", [replyToId, conversation.id]);
      if (!target) replyToId = null;
    } else replyToId = null;
    const [result] = await connection.query(
      "INSERT INTO chat_messages (conversation_id, sender_id, recipient_id, message, reply_to_id) VALUES (?, ?, ?, ?, ?)",
      [conversation.id, req.user.id, recipientId, message, replyToId]
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

// Remember when each user was last online. Hooks the live socket connections the first time any chat request arrives.
let presenceHooked = false;
function hookPresence(io) {
  if (presenceHooked || !io || !io.sockets) return;
  presenceHooked = true;
  const liveIds = () => [...new Set([...io.sockets.sockets.values()].filter((s) => s.user).map((s) => Number(s.user.id)))];
  const stamp = (ids) => {
    if (!ids.length) return;
    pool.query("INSERT INTO chat_presence (user_id, last_seen) VALUES " + ids.map(() => "(?, NOW())").join(", ") + " ON DUPLICATE KEY UPDATE last_seen = NOW()", ids)
      .catch((error) => console.error("Presence update failed:", error.message));
  };
  const watch = (socket) => {
    if (!socket.user) return;
    const uid = Number(socket.user.id);
    socket.on("disconnect", () => {
      const stillOnline = [...io.sockets.sockets.values()].some((s) => s.id !== socket.id && s.user && Number(s.user.id) === uid);
      if (!stillOnline) stamp([uid]);
    });
  };
  io.sockets.sockets.forEach(watch);
  io.on("connection", watch);
  stamp(liveIds());
  setInterval(() => stamp(liveIds()), 60000).unref();
}

// Online status + "last seen". Admin: online students/teachers, and how long ago the offline ones were seen.
// Everyone else: only whether an admin is online and when an admin was last seen.
router.get("/presence", verifyToken, requireRole("student", "teacher", "admin"), async (req, res) => {
  try {
    const io = req.app.get("io");
    const live = io && io.sockets && io.sockets.sockets ? [...io.sockets.sockets.values()].filter((s) => s.user) : [];
    if (req.user.role === "admin") {
      const online = [...new Set(live.filter((s) => s.user.role !== "admin").map((s) => Number(s.user.id)))];
      const [rows] = await pool.query(
        "SELECT p.user_id, TIMESTAMPDIFF(SECOND, p.last_seen, NOW()) AS ago FROM chat_presence p JOIN users u ON u.id = p.user_id WHERE u.role <> 'admin'"
      );
      const lastSeen = {};
      for (const row of rows) if (!online.includes(Number(row.user_id))) lastSeen[row.user_id] = Math.max(0, Number(row.ago));
      return res.json({ online, lastSeen });
    }
    const adminOnline = live.some((s) => s.user.role === "admin");
    const [[row]] = await pool.query(
      "SELECT TIMESTAMPDIFF(SECOND, MAX(p.last_seen), NOW()) AS ago FROM chat_presence p JOIN users u ON u.id = p.user_id WHERE u.role = 'admin'"
    );
    res.json({ adminOnline, adminAgoSeconds: row && row.ago !== null ? Math.max(0, Number(row.ago)) : null });
  } catch (error) {
    console.error("Failed to load presence:", error);
    res.status(500).json({ error: "Failed to load presence" });
  }
});

module.exports = router;
