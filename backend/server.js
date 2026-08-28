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

const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const SIGNUP_BONUS = 250;

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

  console.log("\n════════════════════════════════════════");
  console.log("🔑 LOGIN দিয়ে test করো:");
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
    console.log(`🚀 CampusDine চালু হয়েছে → http://localhost:${PORT}`);
  });
});
