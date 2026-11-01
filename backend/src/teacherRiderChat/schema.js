"use strict";
// Tables for the teacher <-> rider chat. They are created the first time the chat is used,
// the same way the support chat does it, so no manual migration is needed.

// One thread per teacher + rider pair.
const THREADS_TABLE = `CREATE TABLE IF NOT EXISTS teacher_rider_threads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  rider_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_teacher_rider_pair (teacher_id, rider_id),
  KEY idx_teacher_rider_rider (rider_id)
) DEFAULT CHARSET=utf8mb4`;

let ready = null;
function ensureTeacherRiderTables(pool) {
  if (!ready) {
    ready = (async () => {
      await pool.query(THREADS_TABLE);
    })().catch((error) => { ready = null; throw error; });
  }
  return ready;
}

module.exports = { THREADS_TABLE, ensureTeacherRiderTables };
