import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

// DB stores dates as YYYY-DD-MM (e.g. "2026-30-08" = 30 Aug 2026)
// This parses either YYYY-DD-MM or YYYY-MM-DD into a JS Date (UTC)
function parseDate(s: string | null): Date | null {
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  // If second segment > 12 it must be a day → YYYY-DD-MM
  if (parseInt(m[2]) > 12) {
    return new Date(`${m[1]}-${m[3]}-${m[2]}T00:00:00Z`)
  }
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`)
}

// Normalize any DB date to YYYY-MM-DD string for consistent display/comparison
function normStr(s: string | null): string | null {
  const d = parseDate(s)
  if (!d || isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  try {
    await initDB()
    const url   = new URL(req.url)
    const depot = (url.searchParams.get('depot') || '').trim().toUpperCase()

    let outerDepotFilter = ''
    let innerDepotFilter = ''
    const args: (string | number)[] = []

    if (depot === 'ASR') {
      outerDepotFilter = `AND (UPPER(e.depot) = 'ASR' OR e.depot IS NULL)`
      innerDepotFilter = `AND (UPPER(e2.depot) = 'ASR' OR e2.depot IS NULL)`
    } else if (depot) {
      outerDepotFilter = `AND UPPER(e.depot) = UPPER(?)`
      innerDepotFilter = `AND UPPER(e2.depot) = UPPER(?)`
      args.push(depot, depot)
    }

    // SQLite expression: convert YYYY-DD-MM → YYYY-MM-DD so MAX() sorts correctly
    const normExpr = (col: string) =>
      `CASE WHEN CAST(SUBSTR(${col}, 6, 2) AS INTEGER) > 12
            THEN SUBSTR(${col}, 1, 4) || '-' || SUBSTR(${col}, 9, 2) || '-' || SUBSTR(${col}, 6, 2)
            ELSE ${col} END`

    const result = await db.execute({
      sql: `
        SELECT e.coach_no, e.date, e.train_no, e.code, e.bio_tank_no
        FROM bio_test_entries e
        WHERE e.result = 'FAIL'
          AND (e.second_test_result IS NULL OR UPPER(TRIM(e.second_test_result)) != 'NA')
          AND (e.second_test_date IS NULL OR e.second_test_date = '')
          ${outerDepotFilter}
          AND ${normExpr('e.date')} = (
            SELECT MAX(${normExpr('e2.date')})
            FROM bio_test_entries e2
            WHERE UPPER(e2.coach_no) = UPPER(e.coach_no)
            ${innerDepotFilter}
          )
        ORDER BY ${normExpr('e.date')} ASC, UPPER(e.coach_no), e.bio_tank_no
      `,
      args,
    })

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const in7Days = new Date(today)
    in7Days.setUTCDate(in7Days.getUTCDate() + 7)

    const overdue: any[] = []
    const upcoming: any[] = []

    for (const row of result.rows) {
      const testDate = parseDate(row.date as string)
      if (!testDate || isNaN(testDate.getTime())) continue

      const dueDate = new Date(testDate)
      dueDate.setUTCDate(dueDate.getUTCDate() + 30)

      const dueDateStr = dueDate.toISOString().split('T')[0]
      const entry = {
        coach_no:    row.coach_no,
        train_no:    row.train_no,
        code:        row.code,
        bio_tank_no: row.bio_tank_no,
        test_date:   normStr(row.date as string),  // always YYYY-MM-DD to frontend
        due_date:    dueDateStr,
      }

      if (today >= dueDate) {
        overdue.push(entry)
      } else if (dueDate > today && dueDate <= in7Days) {
        upcoming.push(entry)
      }
    }

    return NextResponse.json({ overdue, upcoming })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'DB Error' }, { status: 500 })
  }
}
