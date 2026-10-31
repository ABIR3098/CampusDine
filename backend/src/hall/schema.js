// Hall tables. The server runs this on every start (safe to repeat: CREATE TABLE IF NOT EXISTS).
// Each step of the Hall feature adds its own tables here.
async function addColumnIfMissing(db, table, column, definition) {
  const [cols] = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (cols.length === 0) await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function addIndexIfMissing(db, table, indexName, definition) {
  const [idx] = await db.query(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, [indexName]);
  if (idx.length === 0) await db.query(`ALTER TABLE ${table} ADD ${definition}`);
}

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

  // Step 6 — the fixed weekly menu: one line of food per weekday and meal (the same every week)
  await db.query(`CREATE TABLE IF NOT EXISTS hall_menu (
    dow TINYINT NOT NULL,              -- 0 = Sunday ... 6 = Saturday
    slot VARCHAR(12) NOT NULL,
    items VARCHAR(255) NOT NULL,
    PRIMARY KEY (dow, slot)
  )`);
  // sample menu — INSERT IGNORE never overwrites what the admin has edited
  await db.query(`INSERT IGNORE INTO hall_menu (dow, slot, items) VALUES
    (0,'breakfast','Porota, Mixed veg, Egg, Banana'),   (0,'lunch','Rice, Dal, Chicken curry'),       (0,'dinner','Rice, Dal, Fish curry, Lemon'),
    (1,'breakfast','Khichuri, Egg fry'),        (1,'lunch','Rice, Dal, Beef curry, Salad'),          (1,'dinner','Rice, Dal, Egg curry'),
    (2,'breakfast','Ruti, Vaji, Banana'),       (2,'lunch','Rice, Dal, Fish curry'),          (2,'dinner','Rice, Dal, Chicken curry, Salad'),
    (3,'breakfast','Porota, Dal, Egg'),              (3,'lunch','Rice, Dal, Chicken curry'),       (3,'dinner','Rice, Dal, Mixed veg, Egg'),
    (4,'breakfast','Suji, Banana'),             (4,'lunch','Rice, Dal, Beef curry, Mixed veg'),          (4,'dinner','Rice, Dal, Fish curry'),
    (5,'breakfast','Porota, Egg curry, Banana'),        (5,'lunch','Tehari, Borhani'),                (5,'dinner','Rice, Dal, Chicken curry'),
    (6,'breakfast','Khichuri, Egg'),            (6,'lunch','Rice, Dal, Fish curry, Salad'),          (6,'dinner','Rice, Dal, Mixed veg, Egg')`);

  // Step 7 — feasts: a special meal on one date (shown to everyone, charged on top of the normal price)
  await db.query(`CREATE TABLE IF NOT EXISTS hall_feasts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    the_date DATE NOT NULL,
    slot VARCHAR(12) NOT NULL,
    title VARCHAR(80) NOT NULL,
    items VARCHAR(255) NOT NULL,
    extra_price DECIMAL(10,2) NOT NULL DEFAULT 0,   -- added to the meal's price for everyone who has that meal ON
    UNIQUE KEY uniq_feast (the_date, slot)
  )`);

  // Feast RSVP — a student answers "going" or "not going" for one feast
  await db.query(`CREATE TABLE IF NOT EXISTS hall_feast_rsvps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    feast_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('going','not_going') NOT NULL,
    updated_at DATETIME NOT NULL,                    -- canteen clock
    FOREIGN KEY (feast_id) REFERENCES hall_feasts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await addIndexIfMissing(db, "hall_feast_rsvps", "uniq_feast_rsvp", "UNIQUE KEY uniq_feast_rsvp (feast_id, user_id)");
  await addIndexIfMissing(db, "hall_feast_rsvps", "idx_rsvp_feast_status", "KEY idx_rsvp_feast_status (feast_id, status)");

  await addColumnIfMissing(db, "hall_feasts", "capacity", "INT NULL");   // most people who can say "going"; NULL = no limit

  // Step 8 — guest meals: extra plates a person books for their own guests (billed to that person)
  await db.query(`CREATE TABLE IF NOT EXISTS hall_guests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    the_date DATE NOT NULL,
    slot VARCHAR(12) NOT NULL,
    guest_count TINYINT NOT NULL,
    UNIQUE KEY uniq_guest (user_id, the_date, slot),
    KEY idx_guest_date (the_date, slot),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Step 9 — price fixed at cut-off. When a meal locks, what it costs the person is written down here, so a
  // later change of price / feast never changes a bill that is already earned. NULL = not locked yet.
  await addColumnIfMissing(db, "hall_meal_state", "charged", "DECIMAL(10,2) NULL");   // the person's own plate (0 when OFF)
  await addColumnIfMissing(db, "hall_guests", "charged", "DECIMAL(10,2) NULL");       // all of the person's guest plates

  // Guest names: who the guest plates are for, as JSON text [{ name, phone }] (the admin sees it in the report)
  await addColumnIfMissing(db, "hall_guests", "guest_names", "TEXT NULL");

  // Step 11 — paying the bill from the wallet. Each payment is one row; paid so far = their sum for that month.
  await db.query(`CREATE TABLE IF NOT EXISTS hall_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ym CHAR(7) NOT NULL,                 -- "2026-10"
    amount DECIMAL(10,2) NOT NULL,
    created_at DATETIME NOT NULL,        -- canteen clock
    KEY idx_pay_user_month (user_id, ym),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Step 13 — meal tokens: a serial number per person per meal per day, served in order
  await db.query(`CREATE TABLE IF NOT EXISTS hall_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    the_date DATE NOT NULL,
    slot VARCHAR(12) NOT NULL,
    user_id INT NOT NULL,
    serial INT NOT NULL,                              -- 1, 2, 3 ... within that date + meal
    plates TINYINT NOT NULL,                          -- own plate (if ON) + guest plates
    status ENUM('waiting','served') NOT NULL DEFAULT 'waiting',
    created_at DATETIME NOT NULL,
    served_at DATETIME NULL,
    UNIQUE KEY uniq_token_user (the_date, slot, user_id),
    UNIQUE KEY uniq_token_serial (the_date, slot, serial),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  console.log("✅ Hall schema ready");
}

module.exports = { ensureHallSchema };
