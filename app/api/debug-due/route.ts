import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()
    const url   = new URL(req.url)
    const depot = (url.searchParams.get('depot') || 'ASR').trim().toUpperCase()

    // Step 1: All FAIL entries with no second test date/result=NA
    const failRows = await db.execute({
      sql: `SELECT s_no, date, coach_no, result, second_test_date, second_test_result, depot
            FROM bio_test_entries
            WHERE result = 'FAIL'
              AND (second_test_date IS NULL OR second_test_date = '')
              AND (second_test_result IS NULL OR UPPER(TRIM(second_test_result)) != 'NA')
              AND (UPPER(depot) = ? OR depot IS NULL)
            ORDER BY date DESC LIMIT 30`,
      args: [depot],
    })

    // Step 2: For each, find max date for that coach
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const results = []
    for (const r of failRows.rows) {
      const mx = await db.execute({
        sql: `SELECT MAX(date) as max_date FROM bio_test_entries
              WHERE UPPER(coach_no) = UPPER(?) AND (UPPER(depot) = ? OR depot IS NULL)`,
        args: [r.coach_no as string, depot],
      })
      const maxDate = mx.rows[0].max_date as string
      const isLatest = r.date === maxDate

      const testDate = new Date(r.date as string)
      testDate.setHours(0, 0, 0, 0)
      const dueDate = new Date(testDate)
      dueDate.setDate(dueDate.getDate() + 30)
      const dueDateStr = dueDate.toISOString().split('T')[0]

      results.push({
        s_no: r.s_no,
        coach_no: r.coach_no,
        date: r.date,
        depot: r.depot,
        max_date: maxDate,
        is_latest: isLatest,
        due_date: dueDateStr,
        status: isLatest
          ? (todayStr >= dueDateStr ? 'OVERDUE' : dueDate <= new Date(today.getTime() + 7*86400000) ? 'UPCOMING_7D' : 'NOT_DUE_YET')
          : 'NOT_LATEST_ENTRY',
      })
    }

    return NextResponse.json({
      today: todayStr,
      depot,
      total_fail_eligible: failRows.rows.length,
      overdue: results.filter(r => r.status === 'OVERDUE').length,
      upcoming_7d: results.filter(r => r.status === 'UPCOMING_7D').length,
      not_due_yet: results.filter(r => r.status === 'NOT_DUE_YET').length,
      not_latest: results.filter(r => r.status === 'NOT_LATEST_ENTRY').length,
      entries: results,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
