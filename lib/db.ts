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

export async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bio_test_entries (
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
    )
  `)

  // Auto-increment sequence helper table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `)
  await db.execute(`
    INSERT OR IGNORE INTO meta (key, value) VALUES ('last_s_no', '0')
  `)

  // Total Coaches table (replaced monthly via Settings upload)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS total_coaches (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      coach_no    TEXT,
      train_no    TEXT,
      coach_type  TEXT,
      depot       TEXT,
      extra_1     TEXT,
      extra_2     TEXT,
      extra_3     TEXT,
      uploaded_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  // Auth: seed default admin/admin if not set
  const pwRow = await db.execute(`SELECT value FROM meta WHERE key = 'pw_salt'`)
  if (!pwRow.rows.length || !pwRow.rows[0].value) {
    const salt = 'asr-cia-bio-default'
    // SHA-256 of "asr-cia-bio-default:admin" — computed at runtime
    const data = new TextEncoder().encode(salt + ':admin')
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data)
    const hashHex = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    await db.batch([
      { sql: `INSERT OR IGNORE INTO meta (key, value) VALUES ('pw_salt', ?)`, args: [salt] },
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
