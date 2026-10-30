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
      await add("image_id", "image_id INT NULL");
      await add("broadcast_id", "broadcast_id INT NULL");
      await pool.query("CREATE TABLE IF NOT EXISTS chat_broadcasts (id INT AUTO_INCREMENT PRIMARY KEY, admin_id INT NOT NULL, audience VARCHAR(12) NOT NULL, message TEXT NOT NULL, recipient_count INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) DEFAULT CHARSET=utf8mb4");
      await pool.query("CREATE TABLE IF NOT EXISTS chat_reactions (message_id INT NOT NULL, user_id INT NOT NULL, emoji VARCHAR(16) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (message_id, user_id)) DEFAULT CHARSET=utf8mb4");
      await pool.query("CREATE TABLE IF NOT EXISTS chat_images (id INT AUTO_INCREMENT PRIMARY KEY, owner_user_id INT NOT NULL, uploader_id INT NOT NULL, mime VARCHAR(30) NOT NULL, data MEDIUMBLOB NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_chat_images_owner (owner_user_id))");
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
              m.broadcast_id,
              CASE WHEN m.deleted_at IS NULL THEN m.image_id ELSE NULL END AS image_id,
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
    await attachReactions(messages, req.user.id);
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
              m.broadcast_id,
              CASE WHEN m.deleted_at IS NULL THEN m.image_id ELSE NULL END AS image_id,
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
    await attachReactions(messages, req.user.id);
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
    let imageId = Number(req.body.imageId);
    if (Number.isInteger(imageId) && imageId > 0) {
      const [[img]] = await connection.query("SELECT id FROM chat_images WHERE id = ? AND owner_user_id = ?", [imageId, userId]);
      if (!img) imageId = null;
    } else imageId = null;
    const [result] = await connection.query(
      "INSERT INTO chat_messages (conversation_id, sender_id, recipient_id, message, reply_to_id, image_id) VALUES (?, ?, ?, ?, ?, ?)",
      [conversation.id, req.user.id, recipientId, message, replyToId, imageId]
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
    await pool.query("DELETE FROM chat_images WHERE id = (SELECT image_id FROM chat_messages WHERE id = ?)", [id]);
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

// ---- Photos. Upload: raw image bytes (the browser already shrinks them). View: only admins and the student/teacher the chat belongs to. ----
const MAX_PHOTO_BYTES = 900 * 1024;
const photoType = (buf) => {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
};
const photoParser = express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "1mb" });
router.post("/images", verifyToken, requireRole("student", "teacher", "admin"),
  (req, res, next) => photoParser(req, res, (err) => (err ? res.status(413).json({ error: "Photo is too large. Please choose a smaller one." }) : next())),
  async (req, res) => {
    try {
      const buf = req.body;
      if (!Buffer.isBuffer(buf) || buf.length === 0) return res.status(400).json({ error: "No photo received" });
      if (buf.length > MAX_PHOTO_BYTES) return res.status(413).json({ error: "Photo is too large. Please choose a smaller one." });
      const mime = photoType(buf);
      if (!mime) return res.status(400).json({ error: "This file is not a supported photo" });
      let ownerId = req.user.id;
      if (req.user.role === "admin") {
        ownerId = Number(req.query.userId);
        if (!Number.isInteger(ownerId) || ownerId <= 0) return res.status(400).json({ error: "Select a chat recipient" });
        const [[target]] = await pool.query("SELECT id FROM users WHERE id = ? AND role IN ('student', 'teacher')", [ownerId]);
        if (!target) return res.status(404).json({ error: "Chat user not found" });
      }
      const [result] = await pool.execute("INSERT INTO chat_images (owner_user_id, uploader_id, mime, data) VALUES (?, ?, ?, ?)", [ownerId, req.user.id, mime, buf]);
      res.status(201).json({ id: result.insertId });
    } catch (error) {
      console.error("Failed to save chat photo:", error);
      const code = error && error.code;
      if (code === "ER_NET_PACKET_TOO_LARGE") return res.status(413).json({ error: "The database refused this photo (max_allowed_packet is too small). Try a smaller photo." });
      if (code === "ER_NO_SUCH_TABLE") return res.status(500).json({ error: "Photo storage is not ready. Restart the server and try again." });
      if (error && (error.errno === 139 || code === "ER_TOO_BIG_ROWSIZE")) return res.status(500).json({ error: "The database cannot store this photo (increase innodb_log_file_size). Try a smaller photo." });
      res.status(500).json({ error: "Photo upload failed" + (code ? " (" + code + ")" : "") });
    }
  });

router.get("/images/:id", verifyToken, requireRole("student", "teacher", "admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid photo id" });
    const [[row]] = await pool.query("SELECT owner_user_id, mime, data FROM chat_images WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ error: "Photo not found" });
    if (req.user.role !== "admin" && Number(row.owner_user_id) !== Number(req.user.id)) return res.status(403).json({ error: "Not allowed" });
    res.set({ "Content-Type": row.mime, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" });
    res.send(row.data);
  } catch (error) {
    console.error("Failed to load chat photo:", error);
    res.status(500).json({ error: "Failed to load photo" });
  }
});

// ---- Reactions: one emoji per person per message ----
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

async function attachReactions(messages, myId) {
  const live = messages.filter((m) => !m.deleted_at);
  for (const m of messages) m.reactions = [];
  if (!live.length) return;
  const [rows] = await pool.query(
    "SELECT r.message_id, r.user_id, r.emoji, u.name FROM chat_reactions r JOIN users u ON u.id = r.user_id WHERE r.message_id IN (?) ORDER BY r.created_at ASC",
    [live.map((m) => m.id)]
  );
  const byMessage = new Map();
  for (const row of rows) {
    if (!byMessage.has(row.message_id)) byMessage.set(row.message_id, new Map());
    const group = byMessage.get(row.message_id);
    if (!group.has(row.emoji)) group.set(row.emoji, { emoji: row.emoji, count: 0, mine: false, names: [] });
    const g = group.get(row.emoji);
    g.count += 1;
    g.names.push(row.name);
    if (Number(row.user_id) === Number(myId)) g.mine = true;
  }
  for (const m of live) m.reactions = byMessage.has(m.id) ? [...byMessage.get(m.id).values()] : [];
}

router.post("/messages/:id/reaction", verifyToken, requireRole("student", "teacher", "admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid message id" });
    const emoji = req.body && req.body.emoji ? String(req.body.emoji) : null;
    if (emoji !== null && !REACTIONS.includes(emoji)) return res.status(400).json({ error: "Unsupported reaction" });
    const [[row]] = await pool.query(
      "SELECT m.id, c.user_id AS owner_id FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id WHERE m.id = ? AND m.deleted_at IS NULL",
      [id]
    );
    if (!row) return res.status(404).json({ error: "Message not found" });
    if (req.user.role !== "admin" && Number(row.owner_id) !== Number(req.user.id)) return res.status(403).json({ error: "Not allowed" });
    if (emoji === null) {
      await pool.query("DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ?", [id, req.user.id]);
    } else {
      await pool.query(
        "INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE emoji = VALUES(emoji), created_at = CURRENT_TIMESTAMP",
        [id, req.user.id, emoji]
      );
    }
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${row.owner_id}`).emit("chat:reaction", { id });
      io.to("admins").emit("chat:reaction", { id });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to save reaction:", error);
    res.status(500).json({ error: "Failed to save reaction" });
  }
});

// ---- Admin announcements: one message to many chats at once ----
const BROADCAST_ROLES = { students: ["student"], teachers: ["teacher"], all: ["student", "teacher"] };
const BROADCAST_MAX = Math.min(Number(MAX_MESSAGE_LENGTH) || 1000, 1000);

router.get("/broadcast/audience", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT role, COUNT(*) AS n FROM users WHERE role IN ('student', 'teacher') GROUP BY role");
    const out = { students: 0, teachers: 0 };
    for (const r of rows) out[r.role === "student" ? "students" : "teachers"] = Number(r.n);
    res.json(out);
  } catch (error) {
    console.error("Failed to count announcement audience:", error);
    res.status(500).json({ error: "Failed to load audience" });
  }
});

router.get("/broadcast/history", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, audience, message, recipient_count, TIMESTAMPDIFF(SECOND, created_at, NOW()) AS ago FROM chat_broadcasts ORDER BY id DESC LIMIT 10"
    );
    res.json({ broadcasts: rows.map((r) => ({ ...r, ago: Math.max(0, Number(r.ago)) })) });
  } catch (error) {
    console.error("Failed to load announcement history:", error);
    res.status(500).json({ error: "Failed to load history" });
  }
});

router.post("/broadcast", verifyToken, requireRole("admin"), async (req, res) => {
  let connection;
  try {
    const message = String((req.body && req.body.message) || "").trim();
    const audience = String((req.body && req.body.audience) || "");
    const roles = BROADCAST_ROLES[audience];
    if (!roles) return res.status(400).json({ error: "Choose who should get the announcement" });
    if (!message) return res.status(400).json({ error: "Announcement cannot be empty" });
    if (message.length > BROADCAST_MAX) return res.status(400).json({ error: `Announcement must be ${BROADCAST_MAX} characters or fewer` });
    const [[dup]] = await pool.query(
      "SELECT id FROM chat_broadcasts WHERE admin_id = ? AND message = ? AND created_at > (NOW() - INTERVAL 30 SECOND) LIMIT 1",
      [req.user.id, message]
    );
    if (dup) return res.status(429).json({ error: "You just sent this same announcement. Wait a little before sending it again." });

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [bc] = await connection.query("INSERT INTO chat_broadcasts (admin_id, audience, message) VALUES (?, ?, ?)", [req.user.id, audience, message]);
    await connection.query(
      "INSERT INTO chat_conversations (user_id) SELECT id FROM users WHERE role IN (?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP",
      [roles]
    );
    const [sent] = await connection.query(
      "INSERT INTO chat_messages (conversation_id, sender_id, recipient_id, message, broadcast_id) SELECT c.id, ?, u.id, ?, ? FROM users u JOIN chat_conversations c ON c.user_id = u.id WHERE u.role IN (?)",
      [req.user.id, message, bc.insertId, roles]
    );
    if (!sent.affectedRows) {
      await connection.rollback();
      return res.status(400).json({ error: "There is nobody to send this announcement to" });
    }
    await connection.query("UPDATE chat_broadcasts SET recipient_count = ? WHERE id = ?", [sent.affectedRows, bc.insertId]);
    await connection.commit();

    const [people] = await pool.query("SELECT id FROM users WHERE role IN (?)", [roles]);
    const io = req.app.get("io");
    if (io) {
      const payload = { broadcastId: bc.insertId, senderId: req.user.id, senderName: req.user.name, senderRole: "admin", message, createdAt: new Date().toISOString() };
      io.to(people.map((p) => `user:${p.id}`)).emit("chat:message", payload);
      io.to(`user:${req.user.id}`).emit("chat:message", payload);
    }
    res.status(201).json({ id: bc.insertId, recipients: sent.affectedRows });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("Failed to send announcement:", error);
    res.status(500).json({ error: "Failed to send announcement" });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
