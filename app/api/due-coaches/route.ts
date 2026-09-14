import { NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET() {
  try {
    await initDB()

    // Show coaches where ANY entry on their LATEST TEST DATE is FAIL without 2nd test.
    // Uses MAX(date) per coach so multi-tank coaches (e.g. Tank1–4 each a row) are correctly
    // flagged even if the last-entered tank row happens to be PASS.
    // A coach is dismissed only when a NEWER test date exists where ALL tanks pass
    // (i.e. no FAIL entry on that newer date).
    const result = await db.execute({
      sql: `
        SELECT e.coach_no, e.date, e.train_no, e.code, e.bio_tank_no
        FROM bio_test_entries e
        WHERE e.result = 'FAIL'
          AND (e.second_test_result IS NULL OR UPPER(TRIM(e.second_test_result)) != 'NA')
          AND (e.second_test_date IS NULL OR e.second_test_date = '')
          AND e.date = (
            SELECT MAX(e2.date) FROM bio_test_entries e2
            WHERE UPPER(e2.coach_no) = UPPER(e.coach_no)
          )
        ORDER BY e.date ASC, UPPER(e.coach_no), e.bio_tank_no
      `,
      args: [],
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
        coach_no: row.coach_no,
        train_no: row.train_no,
        code:     row.code,
        bio_tank_no: row.bio_tank_no,
        test_date: row.date,
        due_date:  dueDateStr,
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
