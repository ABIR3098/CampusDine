const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "campusdine",
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // return DECIMAL columns as JS numbers, not strings
});

// Fix 8: make MySQL's clock (NOW(), CURDATE(), TIMESTAMP columns) agree with the Node process clock,
// which server.js pins to the canteen timezone. Otherwise a database host in another timezone
// shifts "today" and the stored times.
function mysqlOffset(date = new Date()) {
  const total = -date.getTimezoneOffset(); // minutes east of UTC
  const abs = Math.abs(total);
  return `${total < 0 ? "-" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
if (pool.pool && typeof pool.pool.on === "function") {
  pool.pool.on("connection", (connection) => {
    connection.query(`SET time_zone = '${mysqlOffset()}'`, (err) => {
      if (err) console.warn("⚠️  Could not set the MySQL session time zone:", err.message);
    });
  });
}

module.exports = pool;
