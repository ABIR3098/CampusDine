const mysql = require("mysql2/promise");
require("dotenv").config();
const { OFFSET } = require("./utils/dates");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "campusdine",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4", // Bangla item names and emoji in notifications
  decimalNumbers: true, // DECIMAL -> JS number
  dateStrings: ["DATE"], // DATE columns stay "YYYY-MM-DD" (no timezone off-by-one)
  timezone: OFFSET, // how JS Dates are read/written
});

// Keep NOW()/CURDATE() in the same timezone the app uses for "today".
pool.pool.on("connection", (conn) => conn.query("SET time_zone = ?", [OFFSET]));

// Runs fn(conn) inside a transaction; always commits/rolls back and releases.
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* connection already gone */ }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,
  query: pool.query.bind(pool),
  getConnection: pool.getConnection.bind(pool),
  withTransaction,
};
