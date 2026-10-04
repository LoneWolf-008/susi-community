import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'susi_community',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Test koneksi
pool.getConnection()
  .then(conn => {
    console.log('Terhubung ke MySQL:', process.env.DB_NAME);
    conn.release();
  })
  .catch(err => {
    console.error('Gagal konek MySQL:', err.message);
  });