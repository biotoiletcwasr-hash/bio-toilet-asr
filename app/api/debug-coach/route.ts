import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  await initDB()
  const coachNo = (req.nextUrl.searchParams.get('coach_no') || '266035').toUpperCase()
  const rows = await db.execute({
    sql: `SELECT s_no, date, typeof(date) as date_type, result, second_test_date, depot
          FROM bio_test_entries WHERE UPPER(coach_no) = ? ORDER BY s_no DESC LIMIT 10`,
    args: [coachNo],
  })
  return NextResponse.json({ coachNo, rows: rows.rows })
}
