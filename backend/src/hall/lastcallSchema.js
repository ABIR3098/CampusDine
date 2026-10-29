// Last-call plates: leftover plates sold cheaply at the end of a meal (less food waste), claimed with the wallet.
// Run from hall/index.js every time the server starts (safe to repeat).
async function ensureHallLastCallSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS hall_lastcalls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    the_date DATE NOT NULL,
    slot VARCHAR(12) NOT NULL,
    plates INT NOT NULL,                      -- how many leftover plates were put up
    price DECIMAL(10,2) NOT NULL,             -- price of one plate
    note VARCHAR(160) NULL,
    status VARCHAR(8) NOT NULL DEFAULT 'open', -- open | closed
    created_by INT NOT NULL,
    university_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL,             -- canteen clock
    KEY idx_lastcall_date (the_date, slot)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS hall_lastcall_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lastcall_id INT NOT NULL,
    user_id INT NOT NULL,
    code VARCHAR(12) NOT NULL,                -- shown at the counter, e.g. LC-7KQ2MX
    price DECIMAL(10,2) NOT NULL,             -- what was taken from the wallet
    status VARCHAR(10) NOT NULL DEFAULT 'claimed', -- claimed | served | cancelled (refunded)
    created_at DATETIME NOT NULL,
    served_at DATETIME NULL,
    UNIQUE KEY uniq_lastcall_code (code),
    KEY idx_lastcall_claim (lastcall_id, user_id),
    FOREIGN KEY (lastcall_id) REFERENCES hall_lastcalls(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
}

module.exports = { ensureHallLastCallSchema };
