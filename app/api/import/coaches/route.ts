import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import * as XLSX from 'xlsx'

// POST: Upload "Total Coaches" sheet
// Columns: 0=S.No | 1=Train No | 2=Coach No | 3=Rly | 4=Code | 5=Status
export async function POST(req: NextRequest) {
  try {
    await initDB()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: true })

    const sheetName =
      workbook.SheetNames.find(n =>
        n.toLowerCase().includes('total') || n.toLowerCase().includes('coach')
      ) || workbook.SheetNames[0]

    const ws = workbook.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

    // Build all statements: DELETE first, then all INSERTs
    // All sent in ONE db.batch() call = single Turso round-trip = no timeout
    const allStatements: { sql: string; args?: any[] }[] = [
      { sql: `DELETE FROM total_coaches` },
    ]

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

      allStatements.push({
        sql: `INSERT INTO total_coaches (coach_no, train_no, coach_type, depot, extra_1, extra_2, extra_3)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [coachNo, trainNo, code, rly, status, '', ''],
      })
    }

    const inserted = allStatements.length - 1 // minus the DELETE statement

    if (inserted > 0) {
      await db.batch(allStatements)
    }

    return NextResponse.json({ inserted, skipped, sheetUsed: sheetName })
  } catch (err: any) {
    console.error('coaches import error:', err)
    const msg = err?.message || err?.toString() || 'Import failed'
    return NextResponse.json({ error: msg }, { status: 500 })
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
