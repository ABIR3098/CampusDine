require("dotenv").config();
require("./src/utils/asyncErrors"); // MUST load before any router: stops one bad request from crashing the process
const path = require("path");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const db = require("./src/db");
const { loadSettings } = require("./src/utils/settings");

const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const SIGNUP_BONUS = 250;
const isProd = process.env.NODE_ENV === "production";

// ── Startup: verify config + DB, upgrade older databases in place, seed demo data ──
async function ensureColumn(table, column, ddl) {
  const [c] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (!c.length) { await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`); console.log(`✅ migration: ${table}.${column}`); }
}

// Runs fn once per database (remembered in app_settings), so admin edits are never overwritten.
async function seedOnce(key, fn) {
  const [r] = await db.query("SELECT 1 FROM app_settings WHERE k = ?", [`seed_${key}`]);
  if (r.length) return;
  await fn();
  await db.query("INSERT INTO app_settings (k, v) VALUES (?, '1')", [`seed_${key}`]);
}

<<<<<<< Updated upstream
const NEW_TABLES = ["app_settings", "order_shares", "class_schedule", "group_orders", "group_members", "group_items", "treats", "loyalty", "points_log"];
=======
// Feature: order note + sold-out/hide. Adds the new columns to databases created before this change
// (same SHOW COLUMNS / ALTER TABLE approach as the coupon schema check above).
async function ensureNoteAndAvailabilitySchema(db) {
  try {
    const [noteColumn] = await db.query("SHOW COLUMNS FROM orders LIKE 'note'");
    if (noteColumn.length === 0) {
      await db.query("ALTER TABLE orders ADD COLUMN note VARCHAR(255) NULL");
      console.log("✅ Added orders.note column");
    }
    const [availabilityColumn] = await db.query("SHOW COLUMNS FROM menu_items LIKE 'availability'");
    if (availabilityColumn.length === 0) {
      await db.query("ALTER TABLE menu_items ADD COLUMN availability VARCHAR(12) NOT NULL DEFAULT 'available'");
      console.log("✅ Added menu_items.availability column");
    }
  } catch (error) {
    console.warn("⚠️ Order note / availability schema check failed:", error.message);
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
>>>>>>> Stashed changes

async function runStartupCheck() {
  console.log("\n🔧 CampusDine startup check চলছে...\n");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error("❌ JWT_SECRET is missing or too short (need 16+ characters). Set it in backend/.env");
    process.exit(1);
  }
  try {
    await db.query("SELECT 1");
  } catch (e) {
    console.error("❌ Database connection failed:", e.message);
    if (e.message.includes("ECONNREFUSED")) console.log("👉 XAMPP/MySQL চালু নেই। XAMPP Control Panel থেকে MySQL Start করো, তারপর আবার চালাও।");
    else if (e.message.includes("Unknown database")) console.log("👉 'campusdine' database এখনো তৈরি হয়নি। phpMyAdmin-এ database বানিয়ে schema.sql import করো।");
    else if (e.message.includes("Access denied")) console.log("👉 .env ফাইলে DB_USER / DB_PASSWORD ভুল আছে। XAMPP default হলে DB_USER=root, DB_PASSWORD= (ফাঁকা)।");
    else console.log("👉 .env ফাইলের DB_HOST, DB_PORT, DB_NAME ঠিক আছে কিনা চেক করো।");
    process.exit(1);
  }
  try {
    const [[cs]] = await db.query("SELECT @@character_set_database AS cs");
    if (!String(cs.cs).startsWith("utf8mb4")) console.warn(`⚠️  Database charset is "${cs.cs}". Bangla names/emoji may show as ???. Fix: ALTER DATABASE ${process.env.DB_NAME || "campusdine"} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;  (then convert existing tables)`);
  } catch (e) { /* non-fatal */ }
  try {
    const [tables] = await db.query("SHOW TABLES LIKE 'users'");
    if (!tables.length) { console.error("❌ 'users' টেবিল পাওয়া যায়নি।"); console.log("👉 campusdine database-এ schema.sql import করো, তারপর আবার চালাও।"); process.exit(1); }

    // Bring databases created from older versions of schema.sql up to date.
    await ensureColumn("orders", "idempotency_key", "idempotency_key VARCHAR(100) NULL");
    const [idx] = await db.query("SHOW INDEX FROM orders WHERE Key_name = 'uniq_order_idempotency'");
    if (!idx.length) await db.query("ALTER TABLE orders ADD UNIQUE KEY uniq_order_idempotency (user_id, idempotency_key)");
    await ensureColumn("orders", "refund_amount", "refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0");
    await ensureColumn("orders", "total_amount", "total_amount DECIMAL(10,2) NULL");
    await ensureColumn("orders", "discount_amount", "discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0");
    await ensureColumn("orders", "discount_applied", "discount_applied BOOLEAN NOT NULL DEFAULT FALSE");
    await ensureColumn("order_items", "quantity", "quantity INT NULL");
    await ensureColumn("wallet_transactions", "hidden_at", "hidden_at TIMESTAMP NULL");
    await ensureColumn("menu_items", "is_active", "is_active BOOLEAN NOT NULL DEFAULT TRUE");
    await ensureColumn("users", "reset_otp_attempts", "reset_otp_attempts INT NOT NULL DEFAULT 0");
    const [[st]] = await db.query("SHOW COLUMNS FROM orders LIKE 'status'");
    if (!String(st.Type).includes("Confirmed")) {
      await db.query("ALTER TABLE orders MODIFY status ENUM('Received','Cooking','Ready','Confirmed','Cancelled','Refunded') NOT NULL DEFAULT 'Received'");
      console.log("✅ migration: orders.status now allows Confirmed");
    }
    await db.query(`CREATE TABLE IF NOT EXISTS notification_log (
      id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, order_id INT,
      notification_type VARCHAR(30) NOT NULL DEFAULT 'order', status VARCHAR(30), message VARCHAR(255),
      read_at TIMESTAMP NULL, sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notif_user (user_id, sent_at), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
    await ensureColumn("notification_log", "message", "message VARCHAR(255) NULL");
    await ensureColumn("notification_log", "read_at", "read_at TIMESTAMP NULL");

    // ---- v2.2 upgrades: new tables come straight from schema.sql, new columns are added in place ----
    const schemaPath = path.join(__dirname, "schema.sql");
    if (fs.existsSync(schemaPath)) {
      for (const m of fs.readFileSync(schemaPath, "utf8").replace(/\r\n/g, "\n").matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \([\s\S]*?\n\);/g)) {
        if (NEW_TABLES.includes(m[1])) await db.query(m[0]);
      }
    }
    await db.query("INSERT IGNORE INTO app_settings (k, v) VALUES ('slot_lock', '1')");
    await ensureColumn("orders", "pickup_slot", "pickup_slot VARCHAR(5) NULL");
    await ensureColumn("orders", "picked_up_at", "picked_up_at TIMESTAMP NULL");
    await ensureColumn("orders", "ready_at", "ready_at TIMESTAMP NULL");
    await ensureColumn("orders", "surplus_savings", "surplus_savings DECIMAL(10,2) NOT NULL DEFAULT 0");
    await ensureColumn("orders", "kind", "kind VARCHAR(10) NOT NULL DEFAULT 'own'");
    await ensureColumn("orders", "group_id", "group_id INT NULL");
    await ensureColumn("orders", "label", "label VARCHAR(160) NULL");
    await ensureColumn("orders", "points_awarded", "points_awarded BOOLEAN NOT NULL DEFAULT FALSE");
    await ensureColumn("order_items", "original_price", "original_price DECIMAL(10,2) NULL");
    await ensureColumn("menu_items", "is_veg", "is_veg BOOLEAN NOT NULL DEFAULT FALSE");
    await ensureColumn("menu_items", "is_halal", "is_halal BOOLEAN NOT NULL DEFAULT TRUE");
    await ensureColumn("menu_items", "spice_level", "spice_level TINYINT NOT NULL DEFAULT 0");
    await ensureColumn("menu_items", "has_nuts", "has_nuts BOOLEAN NOT NULL DEFAULT FALSE");
    await ensureColumn("menu_items", "iftar_only", "iftar_only BOOLEAN NOT NULL DEFAULT FALSE");
    await ensureColumn("menu_items", "surplus_eligible", "surplus_eligible BOOLEAN NOT NULL DEFAULT TRUE");
    await ensureColumn("coupons", "owner_user_id", "owner_user_id INT NULL");
    await ensureColumn("users", "weekly_budget", "weekly_budget DECIMAL(10,2) NULL");

    await seedOnce("dietary_tags", async () => {
      const tags = { "Khichuri": [1, 1], "Tehari": [0, 2], "Porota-Vaji": [1, 1], "Plain Rice & Dal": [1, 0], "Singara": [1, 1], "Fuchka": [1, 3], "Chicken Roll": [0, 2], "Cha (Tea)": [1, 0], "Lassi": [1, 0], "Mineral Water": [1, 0] };
      for (const [name, [veg, spice]] of Object.entries(tags)) await db.query("UPDATE menu_items SET is_veg = ?, spice_level = ? WHERE name = ?", [veg, spice, name]);
    });
    await seedOnce("iftar_items", async () => {
      const items = [
        ["Piyaju (4 pcs)", "পেঁয়াজু", "snacks", 20, 80, 1, 1], ["Beguni (2 pcs)", "বেগুনি", "snacks", 16, 60, 1, 1], ["Jilapi", "জিলাপি", "snacks", 25, 40, 1, 0],
        ["Muri-Chola", "মুড়ি-ছোলা", "snacks", 30, 50, 1, 2], ["Haleem", "হালিম", "heavy", 90, 30, 0, 2], ["Rooh Afza Sharbat", "রুহ আফজা শরবত", "drinks", 20, 100, 1, 0], ["Dates (3 pcs)", "খেজুর", "snacks", 15, 100, 1, 0],
      ];
      for (const [name, bn, cat, price, stock, veg, spice] of items) await db.query("INSERT INTO menu_items (name, name_bn, category, price, stock, tag, is_veg, spice_level, iftar_only) VALUES (?, ?, ?, ?, ?, 'Iftar', ?, ?, 1)", [name, bn, cat, price, stock, veg, spice]);
    });
  } catch (e) {
    console.error("❌ Table check failed:", e.message);
    process.exit(1);
  }

  // Demo accounts have publicly-known passwords: never create them in production unless asked.
  if (!isProd || process.env.SEED_DEMO === "true") {
    const demo = [
      { name: "Canteen Admin", externalId: "admin", role: "admin", password: "admin123", bonus: 0 },
      { name: "Demo Student", externalId: "student1", role: "student", password: "student123", bonus: SIGNUP_BONUS },
      { name: "Demo Teacher", externalId: "teacher1", role: "teacher", password: "teacher123", bonus: SIGNUP_BONUS },
    ];
    for (const a of demo) {
      const [existing] = await db.query("SELECT id FROM users WHERE external_id = ?", [a.externalId]);
      if (existing.length) continue;
      const [r] = await db.query("INSERT INTO users (name, external_id, role, password_hash, wallet_balance) VALUES (?, ?, ?, ?, ?)", [a.name, a.externalId, a.role, await bcrypt.hash(a.password, 10), a.bonus]);
      if (a.bonus > 0) await db.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, 'Welcome bonus', ?)", [r.insertId, a.bonus]);
      console.log(`✅ Demo account তৈরি হয়েছে: ${a.externalId} / ${a.password} (${a.role})`);
    }
    console.log("\n════════════════════════════════════════\n🔑 LOGIN দিয়ে test করো:\n   Admin   → ID: admin      Password: admin123\n   Student → ID: student1   Password: student123\n   Teacher → ID: teacher1   Password: teacher123\n════════════════════════════════════════\n");
  } else {
    const [[a]] = await db.query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
    if (!a.c) console.warn("⚠️  Production mode and no admin user exists. Create one manually, or start once with SEED_DEMO=true and change the password.");
  }
<<<<<<< Updated upstream
  await db.query("INSERT IGNORE INTO meal_rates (role, full_rate, half_rate) VALUES ('student', 90, 50), ('teacher', 130, 70)");
  await db.query(`INSERT IGNORE INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, expiry_date, description, is_active)
                  VALUES ('CAMPUS10', 'PERCENTAGE', 10, 50, 100, 1000, DATE_ADD(NOW(), INTERVAL 1 YEAR), '10% off for campus orders', 1)`);
=======

  await seedDefaultMenuAndRates(db);
  await ensureCouponSchema(db);
  await ensureChatSchema(db);
  await ensureNoteAndAvailabilitySchema(db);

  console.log("\n════════════════════════════════════════");
  console.log("🔑 Test the app with these logins:");
  console.log("   Admin   → ID: admin      Password: admin123");
  console.log("   Student → ID: student1   Password: student123");
  console.log("   Teacher → ID: teacher1   Password: teacher123");
  console.log("════════════════════════════════════════\n");

  await db.end();
>>>>>>> Stashed changes
}

// ── Express app ──
const app = express();
const server = http.createServer(app);
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1); // needed behind Render/Railway so rate limits see real IPs

const corsSetting = (process.env.CORS_ORIGIN || "*").trim();
const corsOptions = corsSetting === "*" ? { origin: true } : { origin: corsSetting.split(",").map((o) => o.trim()) };
if (isProd && corsSetting === "*") console.warn("⚠️  CORS_ORIGIN=* in production. Set it to your real frontend URL.");

app.disable("x-powered-by");
app.use((req, res, next) => { res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN", "Referrer-Policy": "same-origin" }); next(); });
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));

const limiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit: isProd ? limit : Math.max(limit, 5000),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: message },
    skip: (req) =>
      process.env.NODE_ENV === "test" ||
      process.env.DISABLE_RATE_LIMIT === "1" ||
      (!isProd && (req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "::ffff:127.0.0.1")),
  });
app.use("/api", limiter(15 * 60 * 1000, 600, "Too many requests. Please slow down."));
app.use("/api/auth/login", limiter(15 * 60 * 1000, Number(process.env.LOGIN_LIMIT || 20), "Too many login attempts. Try again in 15 minutes."));
app.use("/api/auth/register", limiter(60 * 60 * 1000, Number(process.env.REGISTER_LIMIT || 20), "Too many sign-ups from this network. Try again later."));
app.use(["/api/auth/request-password-reset", "/api/auth/verify-otp-and-reset", "/api/auth/reset-password"], limiter(60 * 60 * 1000, 10, "Too many password-reset attempts. Try again in an hour."));
app.use("/api/wallet/topup", limiter(60 * 60 * 1000, 20, "Too many top-ups this hour."));
app.use("/api/treats/lookup", limiter(5 * 60 * 1000, 30, "Too many lookups. Slow down."));

const io = new Server(server, { cors: corsOptions });
app.set("io", io);
io.use((socket, next) => {
  try { socket.user = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET); next(); }
  catch (err) { next(new Error("Unauthorized socket connection")); }
});
io.on("connection", (socket) => {
  socket.join(`user:${socket.user.id}`);
  if (socket.user.role === "admin") socket.join("admins");
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
// Public, non-secret settings for the frontend (keeps the receiving number out of the HTML).
app.get("/api/config", async (req, res) => {
  const S = await loadSettings(db);
  res.json({
    receivingNumber: process.env.PAYMENT_RECEIVING_NUMBER || "", demoTopup: process.env.ALLOW_DEMO_TOPUP !== "false", maxTopup: Number(process.env.MAX_WALLET_TOPUP || 9999),
    ramadanMode: S.ramadan_mode, maghribTime: S.maghrib_time, openTime: S.open_time, closeTime: S.close_time,
    surplus: { enabled: S.surplus_enabled, percent: S.surplus_percent, minutes: S.surplus_minutes },
  });
});

app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/menu", require("./src/routes/menu"));
app.use("/api/orders", require("./src/routes/orders"));
app.use("/api/wallet", require("./src/routes/wallet"));
app.use("/api/calendar", require("./src/routes/calendar"));
app.use("/api/admin", require("./src/routes/admin"));
app.use("/api/profile", require("./src/routes/profile"));
app.use("/api/ratings", require("./src/routes/ratings"));
app.use("/api/coupons", require("./src/routes/coupon"));
app.use("/api/favorites", require("./src/routes/favorites"));
app.use("/api/payment", require("./src/routes/payment"));
app.use("/api/notifications", require("./src/routes/notifications"));
app.use("/api/slots", require("./src/routes/slots"));
app.use("/api/schedule", require("./src/routes/schedule"));
app.use("/api/groups", require("./src/routes/groups"));
app.use("/api/treats", require("./src/routes/treats"));
app.use("/api/rewards", require("./src/routes/rewards"));
app.use("/api/budget", require("./src/routes/budget"));

app.use("/api", (req, res) => res.status(404).json({ error: `No such endpoint: ${req.method} ${req.originalUrl}` }));
app.use(express.static(FRONTEND_DIR));
app.get("/", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "campusdine.html")));

// Central error handler: honours {status,message} thrown from routes; hides internals on 5xx.
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || (err.type === "entity.parse.failed" ? 400 : 500);
  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(status).json({ error: status >= 500 ? "Something went wrong" : err.message || "Request failed" });
});

// Last line of defence: log and keep serving instead of taking every user offline.
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught exception:", err));

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  runStartupCheck().then(() => server.listen(PORT, () => console.log(`🚀 CampusDine চালু হয়েছে → http://localhost:${PORT}`)));
}
module.exports = { app, server };
