// Schema + first-run seed for: loyalty points / streak, combo deals and happy hours.
// Same approach as the other ensure*Schema functions in server.js: CREATE TABLE IF NOT EXISTS and
// "SHOW COLUMNS then ALTER", so it is safe to run on every start and upgrades an existing database.

async function addColumn(db, table, column, definition) {
  const [existing] = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (existing.length === 0) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`✅ Added ${table}.${column} column`);
  }
}

async function ensureOffersSchema(db) {
  try {
    // ── Order breakdown columns ──
    // discount_amount (already there) stays "coupon discount". These hold the rest of the breakdown.
    await addColumn(db, "orders", "promo_discount", "DECIMAL(10,2) NOT NULL DEFAULT 0");   // happy hour + combo
    await addColumn(db, "orders", "reward_discount", "DECIMAL(10,2) NOT NULL DEFAULT 0");  // loyalty reward
    await addColumn(db, "orders", "points_used", "INT NOT NULL DEFAULT 0");
    await addColumn(db, "orders", "promo_label", "VARCHAR(255) NULL");                      // e.g. "Combo: Khichuri Combo · Happy Hour: Snacks"
    await addColumn(db, "orders", "loyalty_awarded_at", "DATETIME NULL");                   // set once points were given (Ready) — makes awarding idempotent

    // ── Loyalty ──
    await db.query(`
      CREATE TABLE IF NOT EXISTS loyalty_accounts (
        user_id INT PRIMARY KEY,
        points INT NOT NULL DEFAULT 0,
        lifetime_points INT NOT NULL DEFAULT 0,
        streak INT NOT NULL DEFAULT 0,
        best_streak INT NOT NULL DEFAULT 0,
        last_order_date DATE NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    // Every point movement is a row here; (order_id, kind) is unique, which is what makes
    // "award points when an order is Ready" and "refund points when it is cancelled" idempotent.
    await db.query(`
      CREATE TABLE IF NOT EXISTS loyalty_ledger (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        kind VARCHAR(20) NOT NULL,          -- EARN | STREAK_BONUS | REDEEM | REFUND
        points INT NOT NULL,                -- positive = earned, negative = spent
        balance_after INT NOT NULL,
        label VARCHAR(150) NOT NULL,
        order_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_ledger_order_kind (order_id, kind),
        KEY idx_ledger_user (user_id, id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS loyalty_rewards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        name_bn VARCHAR(100) NULL,
        type VARCHAR(12) NOT NULL,          -- DISCOUNT (flat taka off) | FREE_ITEM (one free unit of item_id)
        points_cost INT NOT NULL,
        discount_value DECIMAL(10,2) NULL,
        item_id INT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE
      )
    `);

    // ── Combo deals ──
    await db.query(`
      CREATE TABLE IF NOT EXISTS combo_deals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        name_bn VARCHAR(100) NULL,
        description VARCHAR(255) NULL,
        price DECIMAL(10,2) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS combo_deal_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        combo_id INT NOT NULL,
        item_id INT NOT NULL,
        qty INT NOT NULL DEFAULT 1,
        UNIQUE KEY uniq_combo_item (combo_id, item_id),
        FOREIGN KEY (combo_id) REFERENCES combo_deals(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE
      )
    `);

    // ── Happy hours ──
    await db.query(`
      CREATE TABLE IF NOT EXISTS happy_hours (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        name_bn VARCHAR(100) NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,             -- end < start means the window runs past midnight
        days VARCHAR(20) NULL,              -- "1,2,3" (0 = Sunday … 6 = Saturday); NULL/empty = every day
        category VARCHAR(12) NULL,          -- heavy | snacks | drinks; NULL = all (unless items are listed)
        discount_type VARCHAR(12) NOT NULL DEFAULT 'PERCENTAGE',   -- PERCENTAGE | FIXED (taka off each unit)
        discount_value DECIMAL(10,2) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS happy_hour_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        happy_hour_id INT NOT NULL,
        item_id INT NOT NULL,
        UNIQUE KEY uniq_hh_item (happy_hour_id, item_id),
        FOREIGN KEY (happy_hour_id) REFERENCES happy_hours(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE
      )
    `);

    await seedOffers(db);
  } catch (error) {
    console.warn("⚠️ Offers / loyalty schema check failed:", error.message);
  }
}

// One-time demo data (a marker in app_meta stops anything an admin deletes from coming back on restart).
async function seedOffers(db) {
  await db.query("CREATE TABLE IF NOT EXISTS app_meta (meta_key VARCHAR(60) PRIMARY KEY, meta_value VARCHAR(255))");
  const [done] = await db.query("SELECT 1 FROM app_meta WHERE meta_key = 'offers_seed_v1'");
  if (done.length > 0) return;

  const idOf = async (name) => {
    const [rows] = await db.query("SELECT id FROM menu_items WHERE name = ? LIMIT 1", [name]);
    return rows.length ? rows[0].id : null;
  };

  // Rewards: 100 points → ৳20 off, or a free Cha / Singara.
  await db.query(
    "INSERT INTO loyalty_rewards (name, name_bn, type, points_cost, discount_value) VALUES (?, ?, 'DISCOUNT', 100, 20)",
    ["৳20 off your order", "অর্ডারে ৳২০ ছাড়"]
  );
  const cha = await idOf("Cha (Tea)");
  if (cha) {
    await db.query(
      "INSERT INTO loyalty_rewards (name, name_bn, type, points_cost, item_id) VALUES (?, ?, 'FREE_ITEM', 100, ?)",
      ["Free Cha (Tea)", "ফ্রি চা", cha]
    );
  }
  const singara = await idOf("Singara");
  if (singara) {
    await db.query(
      "INSERT INTO loyalty_rewards (name, name_bn, type, points_cost, item_id) VALUES (?, ?, 'FREE_ITEM', 100, ?)",
      ["Free Singara", "ফ্রি সিঙ্গারা", singara]
    );
  }

  // Combo: Khichuri (৳60) + Borhani (৳30) = ৳90 normally, ৳75 as a combo.
  const khichuri = await idOf("Khichuri");
  const borhani = await idOf("Borhani");
  if (khichuri && borhani) {
    const [combo] = await db.query(
      "INSERT INTO combo_deals (name, name_bn, description, price) VALUES (?, ?, ?, 75)",
      ["Khichuri Combo", "খিচুড়ি কম্বো", "Khichuri + Borhani"]
    );
    await db.query("INSERT INTO combo_deal_items (combo_id, item_id, qty) VALUES (?, ?, 1), (?, ?, 1)",
      [combo.insertId, khichuri, combo.insertId, borhani]);
  }

  // Happy hour: snacks 15% off, every day 3–5 PM.
  await db.query(
    `INSERT INTO happy_hours (name, name_bn, start_time, end_time, days, category, discount_type, discount_value)
     VALUES (?, ?, '15:00:00', '17:00:00', NULL, 'snacks', 'PERCENTAGE', 15)`,
    ["Snacks Happy Hour", "স্ন্যাকস হ্যাপি আওয়ার"]
  );

  await db.query("INSERT INTO app_meta (meta_key, meta_value) VALUES ('offers_seed_v1', '1')");
  console.log("✅ Seeded demo rewards, a combo deal and a happy hour (edit them in Admin → Offers)");
}

module.exports = { ensureOffersSchema };
