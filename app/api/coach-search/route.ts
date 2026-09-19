import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

// DB stores dates as YYYY-DD-MM (e.g. "2026-15-09") OR YYYY-MM-DD.
// Detect YYYY-DD-MM when pos 6-7 > 12, then swap to YYYY-MM-DD.
const NORM = (col: string) =>
  `CASE WHEN CAST(SUBSTR(${col}, 6, 2) AS INTEGER) > 12
        THEN SUBSTR(${col}, 1, 4) || '-' || SUBSTR(${col}, 9, 2) || '-' || SUBSTR(${col}, 6, 2)
        ELSE ${col} END`

// JS-side parser for days_ago / status computation
function parseDate(s: string | null): Date | null {
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const [, y, a, b] = m
  // YYYY-DD-MM: day part (a) > 12 → swap
  if (parseInt(a) > 12) return new Date(`${y}-${b}-${a}T00:00:00Z`)
  return new Date(`${y}-${a}-${b}T00:00:00Z`)
}

function normStr(s: string | null): string | null {
  const d = parseDate(s)
  return d && !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null
}

function daysAgo(s: string | null): number | null {
  const d = parseDate(s)
  if (!d || isNaN(d.getTime())) return null
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / 86_400_000)
}

export async function GET(req: NextRequest) {
  try {
    await initDB()
    const raw     = req.nextUrl.searchParams.get('coach_no')?.trim() || ''
    const coachNo = raw.toUpperCase()
    if (!coachNo) return NextResponse.json({ error: 'coach_no required' }, { status: 400 })

    const rawDepot  = req.nextUrl.searchParams.get('depot')?.trim().toUpperCase() || ''
    const depotParam = ['ASR', 'FZR', 'JUC'].includes(rawDepot) ? rawDepot : ''

    const isASR      = depotParam === 'ASR'
    const isFZRorJUC = depotParam === 'FZR' || depotParam === 'JUC'

    const depotSQL = isASR      ? `AND (UPPER(depot) = 'ASR' OR depot IS NULL)`
                   : isFZRorJUC ? `AND UPPER(depot) = ?`
                   : ''
    const dArg = isFZRorJUC ? [depotParam] : []

    const nd = NORM('date')  // normalized date expression

    // 1. All FAIL entries for this coach (depot-filtered) — sorted by real date DESC
    const failRows = await db.execute({
      sql: `SELECT s_no, date, train_no, code, bio_tank_no,
                   second_test_date, second_test_result
            FROM bio_test_entries
            WHERE UPPER(coach_no) = ?
              AND result = 'FAIL'
              AND (second_test_date IS NULL OR second_test_date = '')
              AND (second_test_result IS NULL OR UPPER(TRIM(second_test_result)) != 'NA')
              ${depotSQL}
            ORDER BY ${nd} DESC, s_no DESC`,
      args: [coachNo, ...dArg],
    })

    // 2. Last FAIL that is the LATEST entry for this coach
    //    (only flag OVERDUE/PENDING if the most-recent entry is a FAIL)
    const latestEntryRes = await db.execute({
      sql: `SELECT MAX(${nd}) as max_norm_date
            FROM bio_test_entries
            WHERE UPPER(coach_no) = ? ${depotSQL}`,
      args: [coachNo, ...dArg],
    })
    const maxNormDate = latestEntryRes.rows[0]?.max_norm_date as string | null

    // 3. Coach master info
    const masterRes = await db.execute({
      sql: `SELECT train_no, coach_type as code, depot, extra_1 as status
            FROM total_coaches WHERE UPPER(coach_no) = ? LIMIT 1`,
      args: [coachNo],
    })

    // 4. Last test entry (any result), sorted by real date
    const lastTestRes = await db.execute({
      sql: `SELECT s_no, date, train_no, code, result,
                   second_test_date, second_test_result
            FROM bio_test_entries
            WHERE UPPER(coach_no) = ? ${depotSQL}
            ORDER BY ${nd} DESC, s_no DESC LIMIT 1`,
      args: [coachNo, ...dArg],
    })

    // 5. Full history
    const historyRes = await db.execute({
      sql: `SELECT s_no, date, train_no, result, second_test_date, second_test_result
            FROM bio_test_entries
            WHERE UPPER(coach_no) = ? ${depotSQL}
            ORDER BY ${nd} DESC, s_no DESC`,
      args: [coachNo, ...dArg],
    })

    // 6. Resampling remarks
    const remarksRes = await db.execute({
      sql: `SELECT id, remark_date, location_status, remark, created_at
            FROM resampling_remarks WHERE UPPER(coach_no) = ?
            ORDER BY remark_date DESC, id DESC`,
      args: [coachNo],
    })

    const master   = masterRes.rows[0]   || null
    const lastTestRow = lastTestRes.rows[0] || null
    const remarks  = remarksRes.rows

    // Normalize last test
    const lastTest = lastTestRow ? {
      s_no:               lastTestRow.s_no,
      date:               normStr(lastTestRow.date as string),
      train_no:           lastTestRow.train_no,
      code:               lastTestRow.code,
      result:             lastTestRow.result,
      second_test_date:   normStr(lastTestRow.second_test_date as string | null),
      second_test_result: lastTestRow.second_test_result,
      days_ago:           daysAgo(lastTestRow.date as string),
    } : null

    // Normalize history
    const history = historyRes.rows.map(h => ({
      s_no:               h.s_no,
      date:               normStr(h.date as string),
      train_no:           h.train_no,
      result:             h.result,
      second_test_date:   normStr(h.second_test_date as string | null),
      second_test_result: h.second_test_result,
      days_ago:           daysAgo(h.date as string),
    }))

    // Find the latest FAIL entry that is also the latest overall entry
    const today = new Date(); today.setUTCHours(0, 0, 0, 0)
    let overdue: { s_no: number; date: string; due_date: string; days_overdue: number } | null = null

    for (const row of failRows.rows) {
      const normDateStr = normStr(row.date as string)
      if (!normDateStr) continue
      // Only consider if this is the latest entry for this coach
      if (normDateStr !== maxNormDate) continue

      const testDate = parseDate(row.date as string)
      if (!testDate || isNaN(testDate.getTime())) continue

      const dueDate = new Date(testDate)
      dueDate.setUTCDate(dueDate.getUTCDate() + 30)

      if (today >= dueDate) {
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000)
        overdue = {
          s_no:         row.s_no as number,
          date:         normDateStr,
          due_date:     dueDate.toISOString().split('T')[0],
          days_overdue: daysOverdue,
        }
        break  // take first (latest) match
      }
    }

    // Status
    let status: string
    if (overdue) {
      status = 'OVERDUE'
    } else if (!lastTest) {
      status = master ? 'PENDING' : 'NOT_IN_LIST'
    } else if (lastTest.result === 'FAIL' && !lastTest.second_test_date) {
      status = 'PENDING'
    } else {
      status = (lastTest.days_ago ?? 0) > 90 ? 'PENDING' : 'TESTED'
    }

    return NextResponse.json({ coachNo, status, master, lastTest, overdue, history, remarks })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || 'Search failed' }, { status: 500 })
  }
}
