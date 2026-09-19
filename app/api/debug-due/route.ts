import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()
    const url   = new URL(req.url)
    const depot = (url.searchParams.get('depot') || 'ASR').trim().toUpperCase()

    // Just return raw FAIL entries — no JS date math at all
    const failRows = await db.execute({
      sql: `SELECT s_no, date, coach_no, second_test_date, second_test_result, depot,
                   (SELECT MAX(e2.date) FROM bio_test_entries e2
                    WHERE UPPER(e2.coach_no) = UPPER(bio_test_entries.coach_no)
                      AND (UPPER(e2.depot) = 'ASR' OR e2.depot IS NULL)) AS max_date
            FROM bio_test_entries
            WHERE result = 'FAIL'
              AND (second_test_date IS NULL OR second_test_date = '')
              AND (second_test_result IS NULL OR UPPER(TRIM(second_test_result)) != 'NA')
              AND (UPPER(depot) = 'ASR' OR depot IS NULL)
            ORDER BY date DESC LIMIT 20`,
      args: [],
    })

    return NextResponse.json({
      count: failRows.rows.length,
      rows: failRows.rows,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? `${err.message} | ${(err as any).stack?.split('\n')[1]}` : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
