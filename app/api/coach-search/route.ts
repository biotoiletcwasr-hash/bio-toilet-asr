import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()
    const raw = req.nextUrl.searchParams.get('coach_no')?.trim() || ''
    const coachNo = raw.toUpperCase()
    if (!coachNo) return NextResponse.json({ error: 'coach_no required' }, { status: 400 })

    // 1. OVERDUE check: most recent entry must also be FAIL (not just any old FAIL)
    const overdueRes = await db.execute({
      sql: `SELECT s_no, date, train_no, code, bio_tank_no,
                   date(date, '+30 days') as due_date,
                   CAST(julianday('now','localtime') - julianday(date(date,'+30 days')) AS INTEGER) as days_overdue
            FROM bio_test_entries
            WHERE UPPER(coach_no) = ?
              AND result = 'FAIL'
              AND (second_test_date IS NULL OR second_test_date = '')
              AND (second_test_result IS NULL OR UPPER(second_test_result) != 'NA')
              AND date(date, '+30 days') < date('now','localtime')
              AND s_no = (SELECT MAX(s_no) FROM bio_test_entries WHERE UPPER(coach_no) = ?)
            ORDER BY date DESC LIMIT 1`,
      args: [coachNo, coachNo],
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

    // 4. All test history for this coach
    const historyRes = await db.execute({
      sql: `SELECT s_no, date, train_no, result, second_test_date, second_test_result,
                   CAST(julianday('now','localtime') - julianday(date) AS INTEGER) as days_ago
            FROM bio_test_entries
            WHERE UPPER(coach_no) = ?
            ORDER BY date DESC, s_no DESC`,
      args: [coachNo],
    })

    // 5. Resampling remarks for this coach
    const remarksRes = await db.execute({
      sql: `SELECT id, remark_date, location_status, remark, created_at
            FROM resampling_remarks WHERE UPPER(coach_no) = ?
            ORDER BY remark_date DESC, id DESC`,
      args: [coachNo],
    })

    const overdue  = overdueRes.rows[0]  || null
    const master   = masterRes.rows[0]   || null
    const lastTest = lastTestRes.rows[0] || null
    const history  = historyRes.rows
    const remarks  = remarksRes.rows

    let status: string
    if (overdue) {
      status = 'OVERDUE'
    } else if (!lastTest) {
      status = master ? 'PENDING' : 'NOT_IN_LIST'
    } else {
      const daysAgo = lastTest.days_ago as number
      const lastResult = lastTest.result as string
      // Check if latest entry is FAIL with 2nd test pending but not yet 30 days
      if (lastResult === 'FAIL' && !lastTest.second_test_date) {
        status = 'PENDING'  // FAIL but within 30-day window
      } else {
        status = daysAgo > 90 ? 'PENDING' : 'TESTED'
      }
    }

    return NextResponse.json({ coachNo, status, master, lastTest, overdue, history, remarks })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || 'Search failed' }, { status: 500 })
  }
}
