import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import * as XLSX from 'xlsx'

// POST: Upload "Total Coaches" sheet → replaces coach list
// Columns: S.No | Train No | Coach No | Rly | Code | Status
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
    // Row 1 = headers, Row 2+ = data
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

    // Clear existing list
    await db.execute(`DELETE FROM total_coaches`)

    const statements: { sql: string; args: any[] }[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row[0] == null) continue
      // Col: 0=S.No, 1=TrainNo, 2=CoachNo, 3=Rly, 4=Code, 5=Status
      const trainNo  = row[1] != null ? String(row[1]).trim() : ''
      const coachNo  = row[2] != null ? String(row[2]).trim() : ''
      if (!coachNo) continue

      const rly    = row[3] != null ? String(row[3]).trim() : ''
      const code   = row[4] != null ? String(row[4]).trim() : ''
      const status = row[5] != null ? String(row[5]).trim() : ''

      statements.push({
        sql: `INSERT INTO total_coaches (coach_no, train_no, coach_type, depot, extra_1, extra_2, extra_3)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [coachNo, trainNo, code, rly, status, '', ''],
      })
    }

    const CHUNK = 100
    let inserted = 0
    for (let i = 0; i < statements.length; i += CHUNK) {
      await db.batch(statements.slice(i, i + CHUNK), 'write')
      inserted += Math.min(CHUNK, statements.length - i)
    }

    return NextResponse.json({ inserted, sheetUsed: sheetName })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}

// GET: Coach list stats
export async function GET() {
  try {
    await initDB()
    const count = await db.execute(`SELECT COUNT(*) as total, MAX(uploaded_at) as last_updated FROM total_coaches`)
    return NextResponse.json(count.rows[0])
  } catch {
    return NextResponse.json({ error: 'DB Error' }, { status: 500 })
  }
}
