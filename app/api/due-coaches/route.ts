import { NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET() {
  try {
    await initDB()

    // Get all FAILED entries where 2nd test hasn't been done
    // and second_test_result is not 'NA' (exempt coaches)
    const result = await db.execute({
      sql: `
        SELECT coach_no, date, train_no, code, bio_tank_no
        FROM bio_test_entries
        WHERE result = 'FAIL'
          AND (second_test_result IS NULL OR (UPPER(TRIM(second_test_result)) != 'NA'))
          AND (second_test_date IS NULL OR second_test_date = '')
        ORDER BY date ASC
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
        code: row.code,
        bio_tank_no: row.bio_tank_no,
        test_date: row.date,
        due_date: dueDateStr,
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
