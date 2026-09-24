import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

/** Convert DD-MM-YYYY or DD/MM/YYYY → YYYY-MM-DD. Returns null if already OK. */
function fixDate(val: string | null): string | null {
  if (!val) return null
  const s = val.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return null  // already correct
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

// POST /api/fix-dates  — one-time migration to fix wrongly formatted dates
export async function POST(req: NextRequest) {
  await initDB()

  const all = await db.execute({
    sql: `SELECT id, date, second_test_date FROM bio_test_entries`,
    args: [],
  })

  let fixed = 0
  const errors: string[] = []

  for (const row of all.rows) {
    const id = row.id as number
    const newDate = fixDate(row.date as string | null)
    const newSd   = fixDate(row.second_test_date as string | null)

    if (newDate !== null || newSd !== null) {
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
    errors,
    message: errors.length ? 'Completed with errors' : 'Done',
  })
}
