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

// Exposed for unit tests only
router._test = { loadPeer };

module.exports = router;
