const { Pool } = require('pg');
const logger = require('./logger');
require('dotenv').config();

// Koneksi ke PostgreSQL (yang kamu kelola lewat pgAdmin4).
// Semua nilai diambil dari file .env
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'biro_umum_db',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  max: Number(process.env.PGPOOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS) || 15000,
  query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS) || 20000,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
});

pool.on('connect', () => {
  logger.info('DB connected', { database: process.env.PGDATABASE, host: process.env.PGHOST || 'localhost', port: Number(process.env.PGPORT) || 5432 });
});

pool.on('error', (err) => {
  logger.error('DB connection error', err);
});

module.exports = pool;
