/**
 * MySQL connection pool for the MLD module.
 *
 * LedgerTrace lives on MongoDB; the MLD (Master List of Documents) module
 * is a read-only mirror of DOMAS's MySQL catalog. We open a SECOND
 * connection (via mysql2) that talks straight to the DOMAS DB so we don't
 * have to sync data between the two stores.
 *
 * Every MLD_DB_* env var falls back to a sensible dev default so a
 * developer can point at a local MySQL without touching prod .env.
 *
 * Exports:
 *   pool                → mysql2 promise pool (share between requests)
 *   ALLOWED_DEPT_LIKES  → SQL LIKE patterns the whole module is scoped to
 *   scopedWhere()       → returns { sql, params } for the WHERE fragment
 *   isDeptAllowed(dept) → PHP-style regex check, used to authorize a
 *                         single document by id before serving its file
 */

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.MLD_DB_HOST     || 'localhost',
  port:     Number(process.env.MLD_DB_PORT || 3306),
  user:     process.env.MLD_DB_USER     || 'root',
  password: process.env.MLD_DB_PASSWORD || '',
  database: process.env.MLD_DB_DATABASE || 'u586762424_domas',
  waitForConnections: true,
  connectionLimit: 5,
  maxIdle: 5,
  idleTimeout: 60_000,
  // MLD tables use timestamps stored in IST; keep them intact.
  timezone: '+05:30',
});

/**
 * Departments the LedgerTrace MLD page is allowed to expose. Read from
 * MLD_ALLOWED_DEPARTMENTS (comma-separated SQL LIKE patterns). Defaults
 * to Accounts + Finance because LedgerTrace's remit is accounts payable.
 *
 * Examples:
 *   MLD_ALLOWED_DEPARTMENTS=%accounts%,%finance%
 *   MLD_ALLOWED_DEPARTMENTS=%accounts%,%finance%,%treasury%
 */
const ALLOWED_DEPT_LIKES = (
  process.env.MLD_ALLOWED_DEPARTMENTS || '%accounts%,%finance%'
)
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * Build the shared WHERE clause + params list. Every list / stats / detail
 * query pipes through this so the two ideas — "what MLD sees" and "what
 * we return to the client" — can never drift.
 */
function scopedWhere() {
  const clauses = ALLOWED_DEPT_LIKES.map(() => 'LOWER(department) LIKE ?').join(' OR ');
  return {
    sql: `(${clauses})`,
    params: [...ALLOWED_DEPT_LIKES],
  };
}

/**
 * PHP-side gate on a single document. Called from the per-document
 * routes (view / file / download) after the row is fetched by id, so a
 * user can't URL-guess into a document from a different department.
 */
function isDeptAllowed(dept) {
  const d = String(dept || '').trim().toLowerCase();
  if (!d) return false;
  for (const pattern of ALLOWED_DEPT_LIKES) {
    // Convert a SQL LIKE pattern to a JS regex: '%' -> '.*'. Every other
    // char is escaped so a dept containing a regex metachar can't false-
    // match.
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*');
    const re = new RegExp('^' + escaped + '$', 'i');
    if (re.test(d)) return true;
  }
  return false;
}

module.exports = { pool, ALLOWED_DEPT_LIKES, scopedWhere, isDeptAllowed };
