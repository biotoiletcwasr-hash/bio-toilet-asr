import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import { calculateResult } from '@/lib/types'
import * as XLSX from 'xlsx'

function parseExcelDate(rawDate: any): string | null {
  if (!rawDate) return null
  if (typeof rawDate === 'string') {
    const parts = rawDate.split(/[-\/]/)
    if (parts.length === 3 && parts[0].length <= 2) {
      return `${parts[2].padStart(4, '20')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
    return rawDate
  }
  if (rawDate instanceof Date) return rawDate.toISOString().split('T')[0]
  return null
}

// POST: Upload ASR & CIA 2026 Excel sheet — batch import into bio_test_entries
export async function POST(req: NextRequest) {
  try {
    await initDB()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

    const sheetName =
      workbook.SheetNames.find(n => n.includes('ASR') || n.includes('CIA') || n.includes('2026')) ||
      workbook.SheetNames[0]

    const ws = workbook.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false })

    // Get current max s_no
    const maxRes = await db.execute(`SELECT MAX(s_no) as max_s FROM bio_test_entries`)
    let currentMax = (maxRes.rows[0].max_s as number) || 0

    // Build batch statements
    const statements: { sql: string; args: any[] }[] = []
    let skipped = 0

    for (let i = 3; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 4) continue

      const rawDate = row[1]
      const trainNo = String(row[2] || '').trim()
      const coachNo = String(row[3] || '').trim()
      if (!rawDate || !trainNo || !coachNo) { skipped++; continue }

      const dateStr = parseExcelDate(rawDate)
      if (!dateStr) { skipped++; continue }

      const code       = String(row[4] || '').trim()
      const bioTankNo  = String(row[5] || '').trim()
      const ph         = row[6] !== '' && row[6] != null ? parseFloat(row[6]) : null
      const cod        = row[7] !== '' && row[7] != null ? parseFloat(row[7]) : null
      const fcfc       = row[8] !== '' && row[8] != null ? parseFloat(row[8]) : null
      const result     = calculateResult(ph, cod, fcfc)
      const secondDate = parseExcelDate(row[10]) || null
      const secondResult = String(row[11] || '').trim() || null

      currentMax++
      statements.push({
        sql: `INSERT OR IGNORE INTO bio_test_entries
              (s_no, date, train_no, coach_no, code, bio_tank_no, ph, cod, fcfc, result, second_test_date, second_test_result)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [currentMax, dateStr, trainNo, coachNo, code, bioTankNo,
               ph, cod, fcfc, result, secondDate, secondResult],
      })
    }

    if (statements.length === 0) {
      return NextResponse.json({ inserted: 0, skipped, sheetUsed: sheetName })
    }

    // Turso batch — all inserts in one round-trip
    const CHUNK = 100
    let inserted = 0
    for (let i = 0; i < statements.length; i += CHUNK) {
      const chunk = statements.slice(i, i + CHUNK)
      await db.batch(chunk, 'write')
      inserted += chunk.length
    }

    // Sync s_no counter
    await db.execute({
      sql: `UPDATE meta SET value = ? WHERE key = 'last_s_no'`,
      args: [String(currentMax)],
    })

    return NextResponse.json({ inserted, skipped, sheetUsed: sheetName })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}
