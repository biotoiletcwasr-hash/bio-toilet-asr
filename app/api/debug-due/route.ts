import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  await initDB()
  const url   = new URL(req.url)
  const depot = (url.searchParams.get('depot') || 'ASR').trim().toUpperCase()

  const raw = await db.execute({
    sql: `SELECT s_no, date, coach_no, result, second_test_date, second_test_result, depot,
          (SELECT MAX(e2.date) FROM bio_test_entries e2
           WHERE UPPER(e2.coach_no) = UPPER(bio_test_entries.coach_no)
             AND (UPPER(e2.depot) = ? OR e2.depot IS NULL)) AS max_date
          FROM bio_test_entries
          WHERE result = 'FAIL'
            AND (second_test_date IS NULL OR second_test_date = '')
            AND (second_test_result IS NULL OR UPPER(TRIM(second_test_result)) != 'NA')
            AND (UPPER(depot) = ? OR depot IS NULL)
          ORDER BY date DESC LIMIT 30`,
    args: [depot, depot],
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const rows = raw.rows.map(r => ({
    s_no: r.s_no,
    date: r.date,
    coach_no: r.coach_no,
    depot: r.depot,
    second_test_date: r.second_test_date,
    max_date: r.max_date,
    is_latest: r.date === r.max_date,
    due_date: (() => {
      const d = new Date(r.date as string)
      d.setDate(d.getDate() + 30)
      return d.toISOString().split('T')[0]
    })(),
  }))

  return NextResponse.json({
    today: today.toISOString().split('T')[0],
    total_fail_no_2nd_test: raw.rows.length,
    latest_only: rows.filter(r => r.is_latest),
    not_latest: rows.filter(r => !r.is_latest).length,
  })
}
