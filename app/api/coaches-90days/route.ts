import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()

    // This is an ASR-only feature — total_coaches is the ASR master list.
    // Join with bio_test_entries (ASR entries only) to find coaches not tested in 90+ days.
    const result = await db.execute({
      sql: `
        SELECT
          tc.coach_no,
          tc.train_no,
          tc.coach_type   AS code,
          tc.depot,
          MAX(e.date)     AS last_test_date,
          CAST(julianday('now','localtime') - julianday(MAX(e.date)) AS INTEGER) AS days_ago
        FROM total_coaches tc
        LEFT JOIN bio_test_entries e
          ON UPPER(e.coach_no) = UPPER(tc.coach_no)
          AND (UPPER(e.depot) = 'ASR' OR e.depot IS NULL)
        GROUP BY UPPER(tc.coach_no), tc.coach_no, tc.train_no, tc.coach_type, tc.depot
        HAVING last_test_date IS NULL OR days_ago > 90
        ORDER BY
          CASE WHEN last_test_date IS NULL THEN 0 ELSE 1 END ASC,
          days_ago DESC
      `,
      args: [],
    })

    return NextResponse.json({ coaches: result.rows, total: result.rows.length })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || 'DB Error' }, { status: 500 })
  }
}
