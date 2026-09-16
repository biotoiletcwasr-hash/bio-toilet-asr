import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()
    const raw = req.nextUrl.searchParams.get('coach_no')?.trim() || ''
    const coachNo = raw.toUpperCase()
    if (!coachNo) return NextResponse.json({ error: 'coach_no required' }, { status: 400 })

    const rawDepot = req.nextUrl.searchParams.get('depot')?.trim().toUpperCase() || ''
    // Validate depot to prevent injection
    const depotParam = ['ASR', 'FZR', 'JUC'].includes(rawDepot) ? rawDepot : ''

    // For ASR: also match legacy NULL rows (pre-backfill safety net); hardcoded constant, safe
    // For FZR/JUC: parameterized via args
    const isASR = depotParam === 'ASR'
    const isFZRorJUC = depotParam === 'FZR' || depotParam === 'JUC'

    // ASR clause hardcoded (constant), FZR/JUC use ? placeholder
    const depotSQL  = isASR    ? `AND (UPPER(depot) = 'ASR' OR depot IS NULL)`
                    : isFZRorJUC ? `AND UPPER(depot) = ?`
                    : ''
    // Extra args to append when depot clause is parameterized
    const dArg = isFZRorJUC ? [depotParam] : []

    // 1. OVERDUE check — depot-filtered
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
              ${depotSQL}
              AND date = (
                SELECT MAX(date) FROM bio_test_entries
                WHERE UPPER(coach_no) = ? ${depotSQL}
              )
            ORDER BY s_no DESC LIMIT 1`,
      args: [coachNo, ...dArg, coachNo, ...dArg],
    })

    // 2. Coach master info from total_coaches (ASR master list — shown for any depot search)
    const masterRes = await db.execute({
      sql: `SELECT train_no, coach_type as code, depot, extra_1 as status
            FROM total_coaches WHERE UPPER(coach_no) = ? LIMIT 1`,
      args: [coachNo],
    })

    // 3. Last test entry (any result), filtered by depot
    const lastTestRes = await db.execute({
      sql: `SELECT s_no, date, train_no, code, result,
                   second_test_date, second_test_result,
                   CAST(julianday('now','localtime') - julianday(date) AS INTEGER) as days_ago
            FROM bio_test_entries
            WHERE UPPER(coach_no) = ?
            ${depotSQL}
            ORDER BY date DESC, s_no DESC LIMIT 1`,
      args: [coachNo, ...dArg],
    })

    // 4. Full test history, filtered by depot
    const historyRes = await db.execute({
      sql: `SELECT s_no, date, train_no, result, second_test_date, second_test_result,
                   CAST(julianday('now','localtime') - julianday(date) AS INTEGER) as days_ago
            FROM bio_test_entries
            WHERE UPPER(coach_no) = ?
            ${depotSQL}
            ORDER BY date DESC, s_no DESC`,
      args: [coachNo, ...dArg],
    })

    // 5. Resampling remarks (not depot-scoped — shared tracking across depots)
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
      const lastResult = lastTest.result as string
      if (lastResult === 'FAIL' && !lastTest.second_test_date) {
        status = 'PENDING'
      } else {
        status = (lastTest.days_ago as number) > 90 ? 'PENDING' : 'TESTED'
      }
    }

    return NextResponse.json({ coachNo, status, master, lastTest, overdue, history, remarks })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || 'Search failed' }, { status: 500 })
  }
}
