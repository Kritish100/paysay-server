require("dotenv").config({ path: __dirname + "/.env" });
const mysql = require("mysql2");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "+05:45",
});

db.getConnection((err, connection) => {
  if (err) {
    console.error(
      `[CRITICAL] [DATABASE] Connection pool initialization failed: ${err.message}`,
    );
  } else {
    connection.release();
  }
});

module.exports = db;
