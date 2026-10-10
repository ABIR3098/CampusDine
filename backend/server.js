require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

const authRoutes = require("./src/routes/auth");
const menuRoutes = require("./src/routes/menu");
const orderRoutes = require("./src/routes/orders");
const walletRoutes = require("./src/routes/wallet");
const calendarRoutes = require("./src/routes/calendar");
const adminRoutes = require("./src/routes/admin");
const couponRoutes = require("./src/routes/coupon");
const chatRoutes = require("./src/routes/chat");

const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const SIGNUP_BONUS = 250;

async function seedDefaultMenuAndRates(db) {
  try {
    const [menuTable] = await db.query("SHOW TABLES LIKE 'menu_items'");
    if (menuTable.length === 0) {
      console.log("⚠️ menu_items table is missing; import the latest schema.sql before continuing.");
      return;
    }

    const [menuRows] = await db.query("SELECT COUNT(*) AS count FROM menu_items");
    if (Number(menuRows[0].count) > 0) {
      await db.query(
        "INSERT INTO meal_rates (role, full_rate, half_rate) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE full_rate = VALUES(full_rate), half_rate = VALUES(half_rate)",
        ["student", 90, 50]
      );
      await db.query(
        "INSERT INTO meal_rates (role, full_rate, half_rate) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE full_rate = VALUES(full_rate), half_rate = VALUES(half_rate)",
        ["teacher", 130, 70]
      );
      return;
    }

    const defaultMenu = [
      ["Khichuri", "খিচুড়ি", "heavy", 60, 40, "Popular", 1],
      ["Tehari", "তেহারি", "heavy", 80, 25, "Popular", 0],
      ["Porota-Vaji", "পরোটা-ভাজি", "heavy", 40, 6, null, 1],
      ["Plain Rice & Dal", "ভাত-ডাল", "heavy", 45, 30, null, 1],
      ["Singara", "সিঙ্গারা", "snacks", 10, 60, "New", 1],
      ["Fuchka", "ফুচকা", "snacks", 30, 4, "Popular", 1],
      ["Chicken Roll", "চিকেন রোল", "snacks", 50, 20, null, 0],
      ["Cha (Tea)", "চা", "drinks", 8, 120, null, 1],
      ["Lassi", "লাচ্ছি", "drinks", 35, 15, "New", 1],
      ["Mineral Water", "পানি", "drinks", 15, 50, null, 1],
    ];

    await db.query(
      `INSERT INTO menu_items (name, name_bn, category, price, stock, tag, is_veg) VALUES ?`,
      [defaultMenu]
    );
    await db.query(
      "INSERT INTO meal_rates (role, full_rate, half_rate) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE full_rate = VALUES(full_rate), half_rate = VALUES(half_rate)",
      ["student", 90, 50]
    );
    await db.query(
      "INSERT INTO meal_rates (role, full_rate, half_rate) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE full_rate = VALUES(full_rate), half_rate = VALUES(half_rate)",
      ["teacher", 130, 70]
    );

    console.log("✅ Demo menu items were added because the menu table was empty.");
  } catch (e) {
    console.warn("⚠️ Failed to seed menu defaults:", e.message);
  }
}

async function ensureCouponSchema(db) {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        discount_type ENUM('PERCENTAGE','FIXED') NOT NULL,
        discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
        min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        max_discount DECIMAL(10,2) NULL,
        usage_limit INT NULL,
        used_count INT NOT NULL DEFAULT 0,
        expiry_date DATETIME NULL,
        description VARCHAR(255) NULL,
        applies_to_all_items TINYINT(1) NOT NULL DEFAULT 1,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const couponColumns = [
      ["min_order_amount", "DECIMAL(10,2) NOT NULL DEFAULT 0"],
      ["max_discount", "DECIMAL(10,2) NULL"],
      ["usage_limit", "INT NULL"],
      ["used_count", "INT NOT NULL DEFAULT 0"],
      ["expiry_date", "DATETIME NULL"],
      ["description", "VARCHAR(255) NULL"],
      ["applies_to_all_items", "TINYINT(1) NOT NULL DEFAULT 1"],
      ["is_active", "TINYINT(1) NOT NULL DEFAULT 1"],
      ["created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"],
    ];
    for (const [column, definition] of couponColumns) {
      const [existing] = await db.query("SHOW COLUMNS FROM coupons LIKE ?", [column]);
      if (existing.length === 0) {
        await db.query(`ALTER TABLE coupons ADD COLUMN ${column} ${definition}`);
      }
    }

    const [discountTypeColumn] = await db.query("SHOW COLUMNS FROM coupons LIKE 'discount_type'");
    if (discountTypeColumn.length > 0 && !discountTypeColumn[0].Type.includes("PERCENTAGE")) {
      await db.query("ALTER TABLE coupons MODIFY discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE'");
      await db.query(`
        UPDATE coupons
        SET discount_type = CASE
          WHEN LOWER(TRIM(discount_type)) IN ('fixed', 'flat') THEN 'FIXED'
          ELSE 'PERCENTAGE'
        END
      `);
      await db.query("ALTER TABLE coupons MODIFY discount_type ENUM('PERCENTAGE','FIXED') NOT NULL DEFAULT 'PERCENTAGE'");
    }

    const [legacyMinimumColumn] = await db.query("SHOW COLUMNS FROM coupons LIKE 'min_order'");
    if (legacyMinimumColumn.length > 0) {
      await db.query("UPDATE coupons SET min_order_amount = min_order WHERE min_order_amount = 0 AND min_order > 0");
    }
    const [legacyExpiryColumn] = await db.query("SHOW COLUMNS FROM coupons LIKE 'expires_at'");
    if (legacyExpiryColumn.length > 0) {
      await db.query("UPDATE coupons SET expiry_date = expires_at WHERE expiry_date IS NULL AND expires_at IS NOT NULL");
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS coupon_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        coupon_id INT NOT NULL,
        item_id INT NOT NULL,
        UNIQUE KEY uniq_coupon_item (coupon_id, item_id),
        FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS coupon_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        coupon_id INT NOT NULL,
        order_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_coupon_order (user_id, coupon_id, order_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (coupon_id) REFERENCES coupons(id),
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `);

    const [discountColumns] = await db.query("SHOW COLUMNS FROM orders LIKE 'discount_amount'");
    if (discountColumns.length === 0) {
      await db.query("ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total");
    }

    const [discountFlagColumns] = await db.query("SHOW COLUMNS FROM orders LIKE 'discount_applied'");
    if (discountFlagColumns.length === 0) {
      await db.query("ALTER TABLE orders ADD COLUMN discount_applied TINYINT(1) NOT NULL DEFAULT 0 AFTER discount_amount");
    }

    const [couponCount] = await db.query("SELECT COUNT(*) AS count FROM coupons");
    if (Number(couponCount[0].count) === 0) {
      const [rows] = await db.query("SELECT id, name FROM menu_items WHERE name IN ('Khichuri', 'Tehari', 'Chicken Roll', 'Cha (Tea)') ORDER BY id");
      const defaultCouponCode = "CAMPUS10";
      const [couponInsert] = await db.query(
        `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, description, applies_to_all_items, is_active)
         VALUES (?, 'PERCENTAGE', 10, 150, 80, '10% off on campus favorites', 0, 1)`,
        [defaultCouponCode]
      );
      if (rows.length > 0) {
        const values = rows.map((row) => [couponInsert.insertId, row.id]);
        await db.query(`INSERT INTO coupon_items (coupon_id, item_id) VALUES ?`, [values]);
      }
      console.log("✅ Seeded a default campus discount coupon: CAMPUS10");
    }
  } catch (error) {
    console.warn("⚠️ Coupon schema/init check failed:", error.message);
  }
}

async function ensureChatSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      sender_id INT NOT NULL,
      recipient_id INT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      KEY idx_chat_conversation_message (conversation_id, id),
      KEY idx_chat_recipient_unread (recipient_id, read_at),
      FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

// ════════════════════════════════════════════════
//  Startup check — verifies the DB is reachable and
//  creates demo accounts (only if they don't exist yet)
//  so there's something to log in with immediately.
// ════════════════════════════════════════════════
async function runStartupCheck() {
  console.log("\n🔧 CampusDine startup check running...\n");

  let db;
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "campusdine",
    });
  } catch (e) {
    console.error("❌ Database connection failed:", e.message);
    if (e.message.includes("ECONNREFUSED")) {
      console.log("👉 XAMPP/MySQL is not running. Start MySQL from the XAMPP Control Panel, then run this again.");
    } else if (e.message.includes("Unknown database")) {
      console.log("👉 The 'campusdine' database does not exist yet. Create it in phpMyAdmin and import schema.sql.");
    } else if (e.message.includes("Access denied")) {
      console.log("👉 DB_USER / DB_PASSWORD in the .env file is wrong. XAMPP defaults are DB_USER=root and an empty DB_PASSWORD.");
    } else {
      console.log("👉 Check that DB_HOST, DB_PORT and DB_NAME in the .env file are correct.");
    }
    process.exit(1);
  }

  try {
    const [tables] = await db.query("SHOW TABLES LIKE 'users'");
    if (tables.length === 0) {
      console.error("❌ The 'users' table was not found.");
      console.log("👉 Import schema.sql into the campusdine database in phpMyAdmin, then run this again.");
      process.exit(1);
    }
  } catch (e) {
    console.error("❌ Table check failed:", e.message);
    process.exit(1);
  }

  const demoAccounts = [
    { name: "Canteen Admin", externalId: "admin", role: "admin", password: "admin123", bonus: 0 },
    { name: "Demo Student", externalId: "student1", role: "student", password: "student123", bonus: SIGNUP_BONUS },
    { name: "Demo Teacher", externalId: "teacher1", role: "teacher", password: "teacher123", bonus: SIGNUP_BONUS },
  ];

  for (const acc of demoAccounts) {
    const [existing] = await db.query("SELECT id FROM users WHERE external_id = ?", [acc.externalId]);
    if (existing.length > 0) continue;

    const hash = await bcrypt.hash(acc.password, 10);
    const [result] = await db.query(
      "INSERT INTO users (name, external_id, role, password_hash, wallet_balance) VALUES (?, ?, ?, ?, ?)",
      [acc.name, acc.externalId, acc.role, hash, acc.bonus]
    );
    if (acc.bonus > 0) {
      await db.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, 'Welcome bonus', ?)", [
        result.insertId,
        acc.bonus,
      ]);
    }
    console.log(`✅ Demo account created: ${acc.externalId} / ${acc.password} (${acc.role})`);
  }

  await seedDefaultMenuAndRates(db);
  await ensureCouponSchema(db);
  await ensureChatSchema(db);

  console.log("\n════════════════════════════════════════");
  console.log("🔑 Test the app with these logins:");
  console.log("   Admin   → ID: admin      Password: admin123");
  console.log("   Student → ID: student1   Password: student123");
  console.log("   Teacher → ID: teacher1   Password: teacher123");
  console.log("════════════════════════════════════════\n");

  await db.end();
}

// ════════════════════════════════════════════════
//  EXPRESS APP
// ════════════════════════════════════════════════
const app = express();
const server = http.createServer(app);

// CORS_ORIGIN=* allows any origin — harmless now that the frontend is
// served from this same server, but kept permissive in case you open the
// HTML file separately or host the frontend elsewhere later.
const corsOriginSetting = process.env.CORS_ORIGIN || "*";
const corsOptions = corsOriginSetting.trim() === "*"
  ? { origin: true }
  : { origin: corsOriginSetting.split(",").map((o) => o.trim()) };

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(server, { cors: corsOptions });
app.set("io", io);

// Socket auth: client connects with { auth: { token } }, gets placed into
// a personal room (user:<id>) and, if admin, the shared "admins" room.
io.use((socket, next) => {
  try {
    const payload = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
    socket.user = payload;
    next();
  } catch (err) {
    next(new Error("Unauthorized socket connection"));
  }
});
io.on("connection", (socket) => {
  socket.join(`user:${socket.user.id}`);
  if (socket.user.role === "admin") socket.join("admins");
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/coupon", couponRoutes);
app.use("/api/chat", chatRoutes);

// Serve the frontend from this same server — one process, one port,
// no separate static server and no cross-origin requests to worry about.
app.use(express.static(FRONTEND_DIR));
app.get("/", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "campusdine.html")));

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;

runStartupCheck().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 CampusDine is running → http://localhost:${PORT}`);
  });
});