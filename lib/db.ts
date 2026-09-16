import { createClient } from '@libsql/client'

if (!process.env.TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL environment variable is required')
}
if (!process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_AUTH_TOKEN environment variable is required')
}

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// ── Module-level init guard ──────────────────────────────────────
// Vercel serverless functions reuse warm instances across requests.
// This flag ensures initDB() runs its full migration pass only ONCE
// per function instance lifetime — not on every API request.
// Cold starts (new instance) always run it once; warm requests skip it entirely.
let _initialized = false

export async function initDB() {
  if (_initialized) return
  _initialized = true

  // ── Step 1: Create all tables (batched — single round trip) ──
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS bio_test_entries (
              id          INTEGER PRIMARY KEY AUTOINCREMENT,
              s_no        INTEGER UNIQUE,
              date        TEXT    NOT NULL,
              train_no    TEXT    NOT NULL,
              coach_no    TEXT    NOT NULL,
              code        TEXT    DEFAULT '',
              bio_tank_no TEXT    DEFAULT '',
              ph          REAL,
              cod         REAL,
              fcfc        REAL,
              result      TEXT    NOT NULL DEFAULT 'PENDING',
              second_test_date   TEXT,
              second_test_result TEXT,
              created_at  TEXT    DEFAULT (datetime('now','localtime'))
            )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS meta (
              key   TEXT PRIMARY KEY,
              value TEXT
            )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS total_coaches (
              id          INTEGER PRIMARY KEY AUTOINCREMENT,
              coach_no    TEXT,
              train_no    TEXT,
              coach_type  TEXT,
              depot       TEXT,
              extra_1     TEXT,
              extra_2     TEXT,
              extra_3     TEXT,
              uploaded_at TEXT DEFAULT (datetime('now','localtime'))
            )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS resampling_remarks (
              id              INTEGER PRIMARY KEY AUTOINCREMENT,
              coach_no        TEXT    NOT NULL,
              train_no        TEXT    DEFAULT '',
              remark_date     TEXT    NOT NULL,
              location_status TEXT    DEFAULT '',
              remark          TEXT    DEFAULT '',
              created_at      TEXT    DEFAULT (datetime('now','localtime'))
            )`,
      args: [],
    },
    // Seed meta defaults (safe with INSERT OR IGNORE)
    { sql: `INSERT OR IGNORE INTO meta (key, value) VALUES ('last_s_no', '0')`, args: [] },
    { sql: `INSERT OR IGNORE INTO meta (key, value) VALUES ('depot_backfill_done', '0')`, args: [] },
    { sql: `INSERT OR IGNORE INTO meta (key, value) VALUES ('pw_salt', '')`, args: [] },
  ])

  // ── Step 2: Column migrations (try/catch — safe if already exists) ──
  try {
    await db.execute(`ALTER TABLE bio_test_entries ADD COLUMN depot TEXT DEFAULT 'ASR'`)
  } catch { /* column already exists — ignore */ }

  // ── Step 3: One-time backfill — check meta flag first to avoid table scans ──
  // Reads ONE row from meta; only runs the UPDATE if not yet done.
  const backfillRow = await db.execute(
    `SELECT value FROM meta WHERE key = 'depot_backfill_done'`
  )
  if (backfillRow.rows[0]?.value !== '1') {
    await db.batch([
      // Turso/libsql does NOT physical-backfill ALTER TABLE defaults,
      // so set depot='ASR' for all rows that still have NULL.
      { sql: `UPDATE bio_test_entries SET depot = 'ASR' WHERE depot IS NULL`, args: [] },
      { sql: `UPDATE total_coaches SET depot = 'ASR' WHERE depot IS NULL OR TRIM(depot) = ''`, args: [] },
      { sql: `UPDATE meta SET value = '1' WHERE key = 'depot_backfill_done'`, args: [] },
    ])
  }

  // ── Step 4: Auth seed — only if salt is empty ──
  // Uses the already-seeded pw_salt row from Step 1; no extra SELECT needed.
  const saltRow = await db.execute(`SELECT value FROM meta WHERE key = 'pw_salt'`)
  if (!saltRow.rows[0]?.value) {
    const salt = 'asr-cia-bio-default'
    const data = new TextEncoder().encode(salt + ':admin')
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data)
    const hashHex = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    await db.batch([
      { sql: `UPDATE meta SET value = ? WHERE key = 'pw_salt'`, args: [salt] },
      { sql: `INSERT OR IGNORE INTO meta (key, value) VALUES ('pw_hash', ?)`, args: [hashHex] },
    ])
  }
}

export async function getNextSNo(): Promise<number> {
  const res = await db.execute(`
    UPDATE meta SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)
    WHERE key = 'last_s_no'
    RETURNING CAST(value AS INTEGER) as next_val
  `)
  return res.rows[0].next_val as number
}
