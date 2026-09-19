import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()
    const url   = new URL(req.url)
    const depot = (url.searchParams.get('depot') || '').trim().toUpperCase()

    // Build depot filter and args for the OUTER query and INNER subquery.
    // ASR (and blank/legacy):  match rows where depot = 'ASR' OR depot IS NULL
    // FZR / JUC:               match rows where UPPER(depot) = UPPER(?)
    // No depot specified:      no filter at all
    let outerDepotFilter = ''
    let innerDepotFilter = ''
    const args: (string | number)[] = []

    if (depot === 'ASR') {
      outerDepotFilter = `AND (UPPER(e.depot) = 'ASR' OR e.depot IS NULL)`
      innerDepotFilter = `AND (UPPER(e2.depot) = 'ASR' OR e2.depot IS NULL)`
      // no extra args — the depot value is inlined as a literal
    } else if (depot) {
      outerDepotFilter = `AND UPPER(e.depot) = UPPER(?)`
      innerDepotFilter = `AND UPPER(e2.depot) = UPPER(?)`
      // The inner subquery arg must come BEFORE the outer depot arg
      // because ? placeholders are positional. We push two copies.
      args.push(depot, depot)
    }
    // else: no depot filter, args stays []

    const result = await db.execute({
      sql: `
        SELECT e.coach_no, e.date, e.train_no, e.code, e.bio_tank_no
        FROM bio_test_entries e
        WHERE e.result = 'FAIL'
          AND (e.second_test_result IS NULL OR UPPER(TRIM(e.second_test_result)) != 'NA')
          AND (e.second_test_date IS NULL OR e.second_test_date = '')
          ${outerDepotFilter}
          AND e.date = (
            SELECT MAX(e2.date) FROM bio_test_entries e2
            WHERE UPPER(e2.coach_no) = UPPER(e.coach_no)
            ${innerDepotFilter}
          )
        ORDER BY e.date ASC, UPPER(e.coach_no), e.bio_tank_no
      `,
      args,
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in7Days = new Date(today)
    in7Days.setDate(in7Days.getDate() + 7)

    const overdue: any[] = []
    const upcoming: any[] = []

    for (const row of result.rows) {
      const testDate = new Date(row.date as string)
      testDate.setHours(0, 0, 0, 0)
      const dueDate = new Date(testDate)
      dueDate.setDate(dueDate.getDate() + 30)

      const dueDateStr = dueDate.toISOString().split('T')[0]
      const entry = {
        coach_no:    row.coach_no,
        train_no:    row.train_no,
        code:        row.code,
        bio_tank_no: row.bio_tank_no,
        test_date:   row.date,
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
