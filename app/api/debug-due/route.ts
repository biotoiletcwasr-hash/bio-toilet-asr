import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()
    const url   = new URL(req.url)
    const depot = (url.searchParams.get('depot') || 'ASR').trim().toUpperCase()

    // Step 1: All FAIL entries with no second test
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

    const todayStr = new Date().toISOString().split('T')[0]  // YYYY-MM-DD

    const results = []
    for (const r of failRows.rows) {
      const dateVal = r.date as string | null

      // Get max date for this coach
      const mx = await db.execute({
        sql: `SELECT MAX(date) as max_date FROM bio_test_entries
              WHERE UPPER(coach_no) = UPPER(?) AND (UPPER(depot) = ? OR depot IS NULL)`,
        args: [r.coach_no as string, depot],
      })
      const maxDate = mx.rows[0].max_date as string | null
      const isLatest = dateVal === maxDate

      // Compute due date safely (pure string math on YYYY-MM-DD)
      let dueDateStr = null
      let status = 'INVALID_DATE'
      if (dateVal && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        const d = new Date(dateVal + 'T00:00:00Z')
        d.setUTCDate(d.getUTCDate() + 30)
        dueDateStr = d.toISOString().split('T')[0]

        if (!isLatest) {
          status = 'NOT_LATEST_ENTRY'
        } else if (todayStr >= dueDateStr) {
          status = 'OVERDUE'
        } else {
          const in7 = new Date(todayStr + 'T00:00:00Z')
          in7.setUTCDate(in7.getUTCDate() + 7)
          const in7Str = in7.toISOString().split('T')[0]
          status = dueDateStr <= in7Str ? 'UPCOMING_7D' : 'NOT_DUE_YET'
        }
      }

      results.push({
        s_no: r.s_no,
        coach_no: r.coach_no,
        date: dateVal,
        depot: r.depot,
        max_date: maxDate,
        is_latest: isLatest,
        due_date: dueDateStr,
        status,
      })
    }

    return NextResponse.json({
      today: todayStr,
      depot,
      total_fail_eligible: failRows.rows.length,
      overdue:     results.filter(r => r.status === 'OVERDUE').length,
      upcoming_7d: results.filter(r => r.status === 'UPCOMING_7D').length,
      not_due_yet: results.filter(r => r.status === 'NOT_DUE_YET').length,
      not_latest:  results.filter(r => r.status === 'NOT_LATEST_ENTRY').length,
      invalid_date:results.filter(r => r.status === 'INVALID_DATE').length,
      entries: results,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
