// Hall tables. The server runs this on every start (safe to repeat: CREATE TABLE IF NOT EXISTS).
// Each step of the Hall feature adds its own tables here.
async function ensureHallSchema(db) {
  // Step 2 — the three meal slots: when each one closes for changes, and what it costs
  await db.query(`CREATE TABLE IF NOT EXISTS hall_slots (
    slot VARCHAR(12) PRIMARY KEY,                    -- breakfast | lunch | dinner
    label VARCHAR(30) NOT NULL,
    cutoff_days_before TINYINT NOT NULL DEFAULT 0,   -- 0 = closes on the meal's own day, 1 = the day before ...
    cutoff_time TIME NOT NULL,                       -- ... at this time (canteen clock)
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    guest_price DECIMAL(10,2) NOT NULL DEFAULT 0
  )`);
  await db.query(`INSERT IGNORE INTO hall_slots (slot, label, cutoff_days_before, cutoff_time, price, guest_price) VALUES
    ('breakfast', 'Breakfast', 1, '21:00:00', 30, 30),
    ('lunch',     'Lunch',     0, '09:00:00', 60, 60),
    ('dinner',    'Dinner',    0, '15:00:00', 60, 60)`);

  // Step 3 — each person's on/off choice per date and meal. A missing row means "same as the last
  // choice before it" (see states.js), so a row only exists where somebody (or the cut-off job) decided.
  await db.query(`CREATE TABLE IF NOT EXISTS hall_meal_state (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    the_date DATE NOT NULL,
    slot VARCHAR(12) NOT NULL,
    status ENUM('on','off') NOT NULL,
    source ENUM('manual','auto') NOT NULL DEFAULT 'manual',   -- manual = clicked, auto = filled at cut-off
    changed_at DATETIME NOT NULL,                              -- canteen clock
    UNIQUE KEY uniq_user_date_slot (user_id, the_date, slot),
    KEY idx_date_slot (the_date, slot),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  // every change, so the admin can see who turned a meal off and when
  await db.query(`CREATE TABLE IF NOT EXISTS hall_meal_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    the_date DATE NOT NULL,
    slot VARCHAR(12) NOT NULL,
    old_status ENUM('on','off') NULL,   -- what it was effectively before (NULL = never set)
    new_status ENUM('on','off') NOT NULL,
    created_at DATETIME NOT NULL,       -- canteen clock
    KEY idx_log_date (the_date, slot),
    KEY idx_log_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // (more tables are added by the next steps)
  console.log("✅ Hall schema ready");
}

module.exports = { ensureHallSchema };
