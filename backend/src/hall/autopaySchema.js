// Auto-pay: who turned it on, and what happened each time it ran.
// Run from hall/index.js every time the server starts (safe to repeat).
async function ensureHallAutoPaySchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS hall_autopay (
    user_id INT NOT NULL PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,        -- canteen clock
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS hall_autopay_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ym CHAR(7) NOT NULL,                 -- the month that was paid for, "2026-10"
    status VARCHAR(12) NOT NULL,         -- paid | nothing (nothing was due) | short (wallet too low)
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,   -- what was taken (0 unless paid)
    due DECIMAL(10,2) NOT NULL DEFAULT 0,      -- what was owed at that moment
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,  -- wallet balance at that moment
    created_at DATETIME NOT NULL,        -- canteen clock
    KEY idx_autopay_user_ym (user_id, ym),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
}

module.exports = { ensureHallAutoPaySchema };
