// src/db.js
// Singleton pg Pool — all modules import this one instance.
'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // max connections in the pool
  idleTimeoutMillis: 30_000,  // close idle connections after 30 s
  connectionTimeoutMillis: 5_000,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : false,
});

// Surface connection errors early so the process doesn't silently degrade
pool.on('error', (err) => {
  console.error('[pg-pool] unexpected error on idle client', err);
  process.exit(1);
});

// Validate DATABASE_URL on startup
if (!process.env.DATABASE_URL) {
  console.error('[db] ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

/**
 * Thin helper that runs a single query and returns its result rows.
 * @param {string} text   Parameterised SQL string
 * @param {any[]}  params Positional parameters ($1, $2 …)
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[pg] query: ${text.substring(0, 80)} | rows: ${result.rowCount} | ${Date.now() - start} ms`);
  }
  return result;
}

/**
 * Obtain a dedicated client for manual transaction control.
 * Always release the client in a finally block.
 */
async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
