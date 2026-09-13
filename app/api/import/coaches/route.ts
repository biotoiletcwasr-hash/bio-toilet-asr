import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

// POST: Receives pre-parsed rows from client-side Excel parsing
// Body: { rows: any[][], sheetName: string }
// Columns: 0=S.No | 1=Train No | 2=Coach No | 3=Rly | 4=Code | 5=Status
export async function POST(req: NextRequest) {
  try {
    await initDB()
    const body = await req.json()
    const rows: any[][] = body.rows || []
    const sheetName: string = body.sheetName || 'Unknown'

    if (!rows.length) {
      return NextResponse.json({ error: 'No rows received' }, { status: 400 })
    }

    const insertStatements: { sql: string; args: any[] }[] = []
    let skipped = 0

    // Row 0 = header, Row 1+ = data
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row[0] == null) continue

      const coachNo = row[2] != null ? String(row[2]).trim() : ''
      if (!coachNo) { skipped++; continue }

      const trainNo = row[1] != null ? String(row[1]).trim() : ''
      const rly     = row[3] != null ? String(row[3]).trim() : ''
      const code    = row[4] != null ? String(row[4]).trim() : ''
      const status  = row[5] != null ? String(row[5]).trim() : ''

      insertStatements.push({
        sql: `INSERT INTO total_coaches (coach_no, train_no, coach_type, depot, extra_1, extra_2, extra_3)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [coachNo, trainNo, code, rly, status, '', ''],
      })
    }

    // DELETE then INSERT in chunks of 100
    await db.execute(`DELETE FROM total_coaches`)

    const CHUNK = 100
    for (let i = 0; i < insertStatements.length; i += CHUNK) {
      await db.batch(insertStatements.slice(i, i + CHUNK))
    }

    return NextResponse.json({
      inserted: insertStatements.length,
      skipped,
      sheetUsed: sheetName,
    })
  } catch (err: any) {
    console.error('coaches import error:', err)
    return NextResponse.json({ error: err?.message || 'Import failed' }, { status: 500 })
  }
}

// GET: Coach list stats
export async function GET() {
  try {
    await initDB()
    const res = await db.execute(
      `SELECT COUNT(*) as total, MAX(uploaded_at) as last_updated FROM total_coaches`
    )
    return NextResponse.json(res.rows[0])
  } catch (err: any) {
    return NextResponse.json({ error: 'DB Error' }, { status: 500 })
  }
}
