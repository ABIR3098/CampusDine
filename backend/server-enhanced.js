require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");

const authRoutes = require("./src/routes/auth-enhanced");
const menuRoutes = require("./src/routes/menu-enhanced");
const orderRoutes = require("./src/routes/orders-enhanced");
const walletRoutes = require("./src/routes/wallet-enhanced");
const calendarRoutes = require("./src/routes/calendar");
const adminRoutes = require("./src/routes/admin");
const profileRoutes = require("./src/routes/profile");
const ratingsRoutes = require("./src/routes/ratings");
const couponRoutes = require("./src/routes/coupon");
const paymentRoutes = require("./src/routes/payment");
const favoritesRoutes = require("./src/routes/favorites");
const notificationsRoutes = require("./src/routes/notifications");

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

// ════════════════════════════════════════════════
//  Startup check — verifies the DB is reachable and
//  creates demo accounts (only if they don't exist yet)
//  so there's something to log in with immediately.
// ════════════════════════════════════════════════
async function runStartupCheck() {
  console.log("\n🔧 CampusDine startup check চলছে...\n");

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
      console.log("👉 XAMPP/MySQL চালু নেই। XAMPP Control Panel থেকে MySQL Start করো, তারপর আবার চালাও।");
    } else if (e.message.includes("Unknown database")) {
      console.log("👉 'campusdine' database এখনো তৈরি হয়নি। phpMyAdmin-এ database বানিয়ে schema.sql import করো।");
    } else if (e.message.includes("Access denied")) {
      console.log("👉 .env ফাইলে DB_USER / DB_PASSWORD ভুল আছে। XAMPP default হলে DB_USER=root, DB_PASSWORD= (ফাঁকা)।");
    } else {
      console.log("👉 .env ফাইলের DB_HOST, DB_PORT, DB_NAME ঠিক আছে কিনা চেক করো।");
    }
    process.exit(1);
  }

  try {
    const [tables] = await db.query("SHOW TABLES LIKE 'users'");
    if (tables.length === 0) {
      console.error("❌ 'users' টেবিল পাওয়া যায়নি।");
      console.log("👉 phpMyAdmin-এ campusdine database-এ schema.sql import করো, তারপর আবার চালাও।");
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
    console.log(`✅ Demo account তৈরি হয়েছে: ${acc.externalId} / ${acc.password} (${acc.role})`);
  }

  await seedDefaultMenuAndRates(db);

  console.log("\n════════════════════════════════════════");
  console.log("🔑 LOGIN দিয়ে test করো:");
  console.log("   Admin   → ID: admin      Password: admin123");
  console.log("   Student → ID: student1   Password: student123");
  console.log("   Teacher → ID: teacher1   Password: teacher123");
  console.log("════════════════════════════════════════\n");

  await db.end();
}

// ════════════════════════════════════════════════
//  RATE LIMITING
// ════════════════════════════════════════════════
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts
  message: "Too many login attempts, please try again later.",
  skipSuccessfulRequests: true,
});

const walletLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // max 10 wallet operations per hour
  message: "Too many wallet operations, please try again later.",
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // max 3 password reset requests per hour
  message: "Too many password reset requests, please try again later.",
});

// ════════════════════════════════════════════════
//  EXPRESS APP
// ════════════════════════════════════════════════
const app = express();
const server = http.createServer(app);

const corsOriginSetting = process.env.CORS_ORIGIN || "*";
const corsOptions = corsOriginSetting.trim() === "*"
  ? { origin: true }
  : { origin: corsOriginSetting.split(",").map((o) => o.trim()) };

app.use(cors(corsOptions));
app.use(express.json());
app.use(generalLimiter);

const io = new Server(server, { cors: corsOptions });
app.set("io", io);
app.set("uuidv4", uuidv4); // Make UUID available globally

// Socket auth
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
app.get("/health", (req, res) => res.json({ status: "OK", timestamp: new Date().toISOString(), uptime: process.uptime() }));

// API Routes with appropriate rate limiters
app.use("/api/auth/request-password-reset", passwordResetLimiter);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wallet", walletLimiter, walletRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/ratings", ratingsRoutes);
app.use("/api/coupon", couponRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/notifications", notificationsRoutes);

// Serve the frontend
app.use(express.static(FRONTEND_DIR));
app.get("/", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "campusdine.html")));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Something went wrong" });
});

const PORT = process.env.PORT || 5000;

runStartupCheck().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 CampusDine চালু হয়েছে → http://localhost:${PORT}`);
  });
});
