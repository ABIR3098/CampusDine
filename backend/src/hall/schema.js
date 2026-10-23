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

  // (more tables are added by the next steps)
  console.log("✅ Hall schema ready");
}

module.exports = { ensureHallSchema };
