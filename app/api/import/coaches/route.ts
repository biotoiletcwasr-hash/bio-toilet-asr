import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import * as XLSX from 'xlsx'

// POST: Upload "Total Coaches" sheet → replaces coach list in DB
export async function POST(req: NextRequest) {
  try {
    await initDB()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Find "Total Coaches" sheet
    const sheetName =
      workbook.SheetNames.find(n =>
        n.toLowerCase().includes('total') || n.toLowerCase().includes('coach')
      ) || workbook.SheetNames[0]

    const ws = workbook.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false })

    // Find header row (first non-empty row)
    let dataStart = 1
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      if (rows[i] && rows[i].some((c: any) => String(c || '').trim() !== '')) {
        dataStart = i + 1
        break
      }
    }

    // Clear existing coach list
    await db.execute(`DELETE FROM total_coaches`)

    let inserted = 0
    for (let i = dataStart; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.every((c: any) => !c)) continue

      const vals = row.map((c: any) => String(c || '').trim())
      await db.execute({
        sql: `INSERT INTO total_coaches (coach_no, train_no, coach_type, depot, extra_1, extra_2, extra_3)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [vals[0]||'', vals[1]||'', vals[2]||'', vals[3]||'', vals[4]||'', vals[5]||'', vals[6]||''],
      })
      inserted++
    }

    return NextResponse.json({ inserted, sheetUsed: sheetName })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}

// GET: Return coach list stats
export async function GET() {
  try {
    await initDB()
    const count = await db.execute(`SELECT COUNT(*) as total, MAX(uploaded_at) as last_updated FROM total_coaches`)
    return NextResponse.json(count.rows[0])
  } catch (err) {
    return NextResponse.json({ error: 'DB Error' }, { status: 500 })
  }
}
