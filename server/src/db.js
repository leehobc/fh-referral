// MariaDB / MySQL connection pool (mysql2 works with MariaDB).
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "fh_user",
  password: process.env.DB_PASSWORD || "fh_password",
  database: process.env.DB_NAME || "fh_referral",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

// Small helper so routes can call db.query(sql, params) and get rows back.
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Retry loop — on Synology the DB container may start a few seconds
// after the API container. Wait for it instead of crashing.
async function waitForDb(retries = 30, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (e) {
      console.log(`DB not ready (attempt ${i + 1}/${retries}): ${e.code || e.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Database did not become ready in time.");
}

module.exports = { pool, query, waitForDb };
