import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

/**
 * Normalize any date string to YYYY-MM-DD.
 * Returns null if already correct (no update needed).
 * Handles:
 *   DD-MM-YYYY  →  YYYY-MM-DD
 *   DD/MM/YYYY  →  YYYY-MM-DD
 *   DD.MM.YYYY  →  YYYY-MM-DD
 *   DD.MM.YY   →  YYYY-MM-DD  (assumes 20xx)
 */
function fixDate(val: string | null): string | null {
  if (!val) return null
  const s = val.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return null  // already YYYY-MM-DD

  // DD-MM-YYYY or DD/MM/YYYY
  let m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`

  // DD.MM.YYYY
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`

  // DD.MM.YY  (e.g. 14.09.26 → 2026-09-14)
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{2})$/)
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`

  return null  // unknown format — leave alone
}

// POST /api/fix-dates  — one-time migration to normalize all date formats to YYYY-MM-DD
export async function POST(req: NextRequest) {
  await initDB()

  const all = await db.execute({
    sql: `SELECT id, date, second_test_date FROM bio_test_entries`,
    args: [],
  })

  let fixed = 0
  const errors: string[] = []
  const samples: string[] = []

  for (const row of all.rows) {
    const id = row.id as number
    const newDate = fixDate(row.date as string | null)
    const newSd   = fixDate(row.second_test_date as string | null)

    if (newDate !== null || newSd !== null) {
      if (samples.length < 5) samples.push(`id=${id}: "${row.date}" → "${newDate ?? row.date}"`)
      try {
        if (newDate !== null && newSd !== null) {
          await db.execute({
            sql: `UPDATE bio_test_entries SET date = ?, second_test_date = ? WHERE id = ?`,
            args: [newDate, newSd, id],
          })
        } else if (newDate !== null) {
          await db.execute({
            sql: `UPDATE bio_test_entries SET date = ? WHERE id = ?`,
            args: [newDate, id],
          })
        } else {
          await db.execute({
            sql: `UPDATE bio_test_entries SET second_test_date = ? WHERE id = ?`,
            args: [newSd, id],
          })
        }
        fixed++
      } catch (e: any) {
        errors.push(`id=${id}: ${e.message}`)
      }
    }
  }

  return NextResponse.json({
    total: all.rows.length,
    fixed,
    samples,
    errors,
    message: errors.length ? 'Completed with errors' : 'Done — all dates normalized to YYYY-MM-DD',
  })
}
