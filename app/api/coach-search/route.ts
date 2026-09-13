import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()
    const raw = req.nextUrl.searchParams.get('coach_no')?.trim() || ''
    const coachNo = raw.toUpperCase()
    if (!coachNo) return NextResponse.json({ error: 'coach_no required' }, { status: 400 })

    // 1. Check OVERDUE: FAIL, no 2nd test, 30-day window passed
    const overdueRes = await db.execute({
      sql: `SELECT s_no, date, train_no, code, bio_tank_no,
                   date(date, '+30 days') as due_date,
                   CAST(julianday('now','localtime') - julianday(date(date,'+30 days')) AS INTEGER) as days_overdue
            FROM bio_test_entries
            WHERE UPPER(coach_no) = ?
              AND result = 'FAIL'
              AND second_test_date IS NULL
              AND (second_test_result IS NULL OR UPPER(second_test_result) != 'NA')
              AND date(date, '+30 days') < date('now','localtime')
            ORDER BY date DESC LIMIT 1`,
      args: [coachNo],
    })

    // 2. Coach master info from total_coaches
    const masterRes = await db.execute({
      sql: `SELECT train_no, coach_type as code, depot, extra_1 as status
            FROM total_coaches WHERE UPPER(coach_no) = ? LIMIT 1`,
      args: [coachNo],
    })

    // 3. Last test entry (any result)
    const lastTestRes = await db.execute({
      sql: `SELECT s_no, date, train_no, code, result,
                   second_test_date, second_test_result,
                   CAST(julianday('now','localtime') - julianday(date) AS INTEGER) as days_ago
            FROM bio_test_entries
            WHERE UPPER(coach_no) = ?
            ORDER BY date DESC, s_no DESC LIMIT 1`,
      args: [coachNo],
    })

    const overdue  = overdueRes.rows[0]  || null
    const master   = masterRes.rows[0]   || null
    const lastTest = lastTestRes.rows[0] || null

    let status: string
    if (overdue) {
      status = 'OVERDUE'
    } else if (!lastTest) {
      status = master ? 'PENDING' : 'NOT_IN_LIST'
    } else {
      const daysAgo = lastTest.days_ago as number
      status = daysAgo > 90 ? 'PENDING' : 'TESTED'
    }

    return NextResponse.json({ coachNo, status, master, lastTest, overdue })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || 'Search failed' }, { status: 500 })
  }
}
