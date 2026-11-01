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

// Exposed for unit tests only
router._test = { loadPeer };

module.exports = router;
