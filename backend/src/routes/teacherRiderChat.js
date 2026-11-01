const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const rules = require("../teacherRiderChat/rules");
const { ensureTeacherRiderTables } = require("../teacherRiderChat/schema");

// Direct chat between a teacher and a rider (not tied to one order).
// Teachers can write to any rider. A rider can start a chat only with a teacher whose order they carry;
// after that, either side can keep talking.
const router = express.Router();

router.use(verifyToken, requireRole(...rules.CHAT_ROLES));
router.use(async (req, res, next) => {
  try { await ensureTeacherRiderTables(pool); next(); }
  catch (error) { console.error("Teacher-rider chat schema check failed:", error); res.status(500).json({ error: "Rider chat is not ready" }); }
});

const fail = (res, error, text) => { console.error(text + ":", error); res.status(500).json({ error: text }); };

// The person on the other side must exist and must have the matching role.
async function loadPeer(db, me, peerId) {
  const [[peer]] = await db.query(
    "SELECT id, name, role, external_id FROM users WHERE id = ? AND role = ?",
    [peerId, rules.peerRoleOf(me.role)]
  );
  return peer || null;
}

// GET /threads - my chats, newest first, with the last message and how many are unread
router.get("/threads", async (req, res) => {
  try {
    // Column names come from the logged-in role only, never from the request.
    const mine = req.user.role === "teacher" ? "teacher_id" : "rider_id";
    const theirs = req.user.role === "teacher" ? "rider_id" : "teacher_id";
    const [rows] = await pool.query(
      `SELECT t.id AS thread_id, u.id AS peer_id, u.name, u.role, u.external_id, t.updated_at,
              (SELECT message FROM teacher_rider_messages WHERE thread_id = t.id ORDER BY id DESC LIMIT 1) AS last_message,
              (SELECT deleted_at IS NOT NULL FROM teacher_rider_messages WHERE thread_id = t.id ORDER BY id DESC LIMIT 1) AS last_deleted,
              (SELECT COUNT(*) FROM teacher_rider_messages WHERE thread_id = t.id AND recipient_id = ? AND read_at IS NULL AND deleted_at IS NULL) AS unread_count
       FROM teacher_rider_threads t JOIN users u ON u.id = t.${theirs}
       WHERE t.${mine} = ? ORDER BY t.updated_at DESC`,
      [req.user.id, req.user.id]
    );
    const threads = rows.map((r) => ({
      thread_id: r.thread_id, peer_id: r.peer_id, name: r.name, role: r.role, external_id: r.external_id,
      updated_at: r.updated_at, last_message: rules.previewOf(r.last_message, Number(r.last_deleted) === 1),
      unread_count: Number(r.unread_count) || 0,
    }));
    res.json({ threads });
  } catch (error) { fail(res, error, "Failed to load rider chats"); }
});

// GET /directory?q= - find someone to start a chat with (2+ letters of the name or ID).
// A teacher finds any rider. A rider only finds teachers whose order they carry (or carried).
router.get("/directory", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 60);
    if (q.length < 2) return res.json({ users: [] });
    const like = "%" + q.replace(/[%_\\]/g, (c) => "\\" + c) + "%";
    const isTeacher = req.user.role === "teacher";
    const params = [rules.peerRoleOf(req.user.role), like, like];
    let sql = "SELECT id, name, role, external_id FROM users WHERE role = ? AND (name LIKE ? OR external_id LIKE ?)";
    if (!isTeacher) { sql += " AND id IN (SELECT user_id FROM orders WHERE rider_id = ?)"; params.push(req.user.id); }
    const [users] = await pool.query(sql + " ORDER BY name LIMIT 10", params);
    res.json({ users });
  } catch (error) { fail(res, error, "Failed to search people"); }
});

// GET /contacts - people I already share an order with, most recent order first.
// A teacher sees the riders who carried their orders, a rider sees the teachers they delivered to.
router.get("/contacts", async (req, res) => {
  try {
    const isTeacher = req.user.role === "teacher";
    const me = isTeacher ? "o.user_id" : "o.rider_id";
    const them = isTeacher ? "o.rider_id" : "o.user_id";
    const [users] = await pool.query(
      `SELECT u.id, u.name, u.role, u.external_id, MAX(o.id) AS last_order_id
       FROM orders o JOIN users u ON u.id = ${them}
       WHERE ${me} = ? AND ${them} IS NOT NULL AND u.role = ?
       GROUP BY u.id, u.name, u.role, u.external_id ORDER BY last_order_id DESC LIMIT 10`,
      [req.user.id, rules.peerRoleOf(req.user.role)]
    );
    res.json({ users });
  } catch (error) { fail(res, error, "Failed to load contacts"); }
});

// GET /:peerId/messages - one conversation. Opening it marks the messages sent to me as read.
router.get("/:peerId/messages", async (req, res) => {
  try {
    const peerId = rules.parseId(req.params.peerId);
    if (!peerId) return res.status(400).json({ error: "Invalid user ID" });
    const peer = await loadPeer(pool, req.user, peerId);
    if (!peer) return res.status(404).json({ error: "Chat user not found" });
    const pair = rules.pairOf(req.user, peer);
    const [[thread]] = await pool.query(
      "SELECT id FROM teacher_rider_threads WHERE teacher_id = ? AND rider_id = ?",
      [pair.teacherId, pair.riderId]
    );
    if (!thread) return res.json({ threadId: null, peer, messages: [], firstUnreadId: null });

    const [[firstUnread]] = await pool.query(
      "SELECT MIN(id) AS id FROM teacher_rider_messages WHERE thread_id = ? AND recipient_id = ? AND read_at IS NULL AND deleted_at IS NULL",
      [thread.id, req.user.id]
    );
    await pool.query(
      "UPDATE teacher_rider_messages SET read_at = CURRENT_TIMESTAMP WHERE thread_id = ? AND recipient_id = ? AND read_at IS NULL",
      [thread.id, req.user.id]
    );
    const [messages] = await pool.query(
      `SELECT m.id, m.sender_id, m.recipient_id, CASE WHEN m.deleted_at IS NULL THEN m.message ELSE '' END AS message,
              m.deleted_at, m.created_at, m.read_at, u.name AS sender_name, u.role AS sender_role
       FROM (SELECT * FROM teacher_rider_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 300) m
       JOIN users u ON u.id = m.sender_id ORDER BY m.id ASC`,
      [thread.id]
    );
    // Tell the other side their messages were seen.
    const io = req.app.get("io");
    if (io && firstUnread && firstUnread.id) io.to(`user:${peer.id}`).emit("teacher-rider-chat:read", { threadId: thread.id, readerId: Number(req.user.id) });
    res.json({ threadId: thread.id, peer, messages, firstUnreadId: firstUnread && firstUnread.id ? firstUnread.id : null });
  } catch (error) { fail(res, error, "Failed to load messages"); }
});

// POST /:peerId/messages - send a message. The thread is created by the first message.
router.post("/:peerId/messages", async (req, res) => {
  let connection;
  try {
    const peerId = rules.parseId(req.params.peerId);
    if (!peerId) return res.status(400).json({ error: "Invalid user ID" });
    const cleaned = rules.cleanMessage(req.body && req.body.message);
    if (cleaned.error) return res.status(400).json({ error: cleaned.error });

    connection = await pool.getConnection();
    const peer = await loadPeer(connection, req.user, peerId);
    if (!peer) return res.status(404).json({ error: "Chat user not found" });
    const pair = rules.pairOf(req.user, peer);

    // A rider may open a new chat only with a teacher whose order they carry. A teacher can always write first.
    if (req.user.role === "rider") {
      const [[existing]] = await connection.query(
        "SELECT id FROM teacher_rider_threads WHERE teacher_id = ? AND rider_id = ?", [pair.teacherId, pair.riderId]
      );
      if (!existing) {
        const [[linked]] = await connection.query(
          "SELECT id FROM orders WHERE user_id = ? AND rider_id = ? LIMIT 1", [pair.teacherId, pair.riderId]
        );
        if (!linked) return res.status(403).json({ error: "You can start a chat only with a teacher whose order you deliver" });
      }
    }

    await connection.beginTransaction();
    await connection.query(
      "INSERT INTO teacher_rider_threads (teacher_id, rider_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP",
      [pair.teacherId, pair.riderId]
    );
    const [[thread]] = await connection.query(
      "SELECT id FROM teacher_rider_threads WHERE teacher_id = ? AND rider_id = ? FOR UPDATE", [pair.teacherId, pair.riderId]
    );
    const [result] = await connection.query(
      "INSERT INTO teacher_rider_messages (thread_id, sender_id, recipient_id, message) VALUES (?, ?, ?, ?)",
      [thread.id, req.user.id, peer.id, cleaned.text]
    );
    await connection.query("UPDATE teacher_rider_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [thread.id]);
    await connection.commit();

    const payload = {
      id: result.insertId,
      threadId: thread.id,
      senderId: Number(req.user.id),
      recipientId: Number(peer.id),
      senderName: req.user.name,
      senderRole: req.user.role,
      message: cleaned.text,
      createdAt: new Date().toISOString(),
    };
    // Both people get it live: the other side sees the message arrive, my other open tabs stay in sync.
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${req.user.id}`).emit("teacher-rider-chat:message", payload);
      io.to(`user:${peer.id}`).emit("teacher-rider-chat:message", payload);
    }
    res.status(201).json({ message: payload });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    fail(res, error, "Failed to send message");
  } finally {
    if (connection) connection.release();
  }
});

// DELETE /messages/:id - remove one of MY messages for both sides. The row stays, its text is blanked on read.
router.delete("/messages/:id", async (req, res) => {
  try {
    const id = rules.parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid message id" });
    const [[row]] = await pool.query(
      "SELECT recipient_id, thread_id FROM teacher_rider_messages WHERE id = ? AND sender_id = ? AND deleted_at IS NULL",
      [id, req.user.id]
    );
    if (!row) return res.status(404).json({ error: "Message not found" });
    await pool.query("UPDATE teacher_rider_messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${req.user.id}`).emit("teacher-rider-chat:deleted", { id, threadId: row.thread_id });
      io.to(`user:${row.recipient_id}`).emit("teacher-rider-chat:deleted", { id, threadId: row.thread_id });
    }
    res.json({ ok: true });
  } catch (error) { fail(res, error, "Failed to delete message"); }
});

// Exposed for unit tests only
router._test = { loadPeer };

module.exports = router;
