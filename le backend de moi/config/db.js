const mysql = require('mysql2/promise'); // Must use promise version

const isSslEnabled = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tunprojects',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000, // 10 seconds
  ssl: isSslEnabled ? { rejectUnauthorized: false } : undefined
});

// Test connection
pool.getConnection()
  .then(connection => {
    console.log(`Connected to MySQL database (${process.env.DB_HOST}/${process.env.DB_NAME})`);
    connection.release();
  })
  .catch(err => {
    console.error('Database connection failed:', err);
  });

module.exports = pool;