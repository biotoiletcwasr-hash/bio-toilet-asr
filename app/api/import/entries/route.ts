import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import * as XLSX from 'xlsx'

function parseExcelDate(val: any): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'string') {
    const s = val.trim()
    if (s.toUpperCase() === 'NA') return 'NA'
    const parts = s.split(/[-\/]/)
    if (parts.length === 3 && parts[0].length <= 2) {
      return `${parts[2].padStart(4, '20')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
    return s || null
  }
  return null
}

// Map Excel result text → PASS / FAIL
function mapResult(val: any): string {
  if (!val || String(val).trim() === '' || String(val).trim() === '  ') return 'PASS'
  const s = String(val).toUpperCase().trim()
  if (s.includes('FAIL')) return 'FAIL'
  return 'PASS'
}

// POST: Upload Excel — batch import into bio_test_entries
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
    // Data starts at row 4 (index 3 after header: 1=title, 2-3=merged headers)
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, cellDates: true })

    // Re-read with date parsing
    const wb2 = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: true })
    const ws2 = wb2.Sheets[sheetName]
    const rawRows: any[][] = XLSX.utils.sheet_to_json(ws2, { header: 1, raw: true, cellDates: true })

    const maxRes = await db.execute(`SELECT MAX(s_no) as max_s FROM bio_test_entries`)
    let currentMax = (maxRes.rows[0].max_s as number) || 0

    const statements: { sql: string; args: any[] }[] = []
    let skipped = 0

    for (let i = 3; i < rawRows.length; i++) {
      const row = rawRows[i]
      // Col 0=S.No, 1=Date, 2=TrainNo, 3=CoachNo, 4=Code, 5=BioTankNo,
      // 6=pH, 7=COD, 8=FCFC, 9=Result, 10=2ndTestDate, 11=2ndTestResult
      if (!row || row[0] == null) continue

      const coachNo = row[3] != null ? String(row[3]).trim() : ''
      if (!coachNo) { skipped++; continue }

      const dateStr = parseExcelDate(row[1])
      if (!dateStr) { skipped++; continue }

      const trainNo   = row[2] != null ? String(row[2]).trim() : ''
      const code      = row[4] != null ? String(row[4]).trim() : ''
      const bioTankNo = row[5] != null ? String(row[5]).trim() : ''

      const ph   = row[6] != null && row[6] !== '' ? parseFloat(String(row[6])) : null
      const cod  = row[7] != null && row[7] !== '' ? parseFloat(String(row[7])) : null
      const fcfc = row[8] != null && row[8] !== '' ? parseFloat(String(row[8])) : null

      // Use Excel result column (col 9) — blank = PASS, contains FAIL text = FAIL
      const result = mapResult(row[9])

      // 2nd test: col 10 = date (or 'NA' = exempt), col 11 = result value
      const secondDate   = parseExcelDate(row[10]) || null
      const secondResult = row[11] != null && String(row[11]).trim() !== '' ? String(row[11]).trim() : null

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

    // Batch in chunks of 100 — fast, stays within Vercel timeout
    const CHUNK = 100
    let inserted = 0
    for (let i = 0; i < statements.length; i += CHUNK) {
      await db.batch(statements.slice(i, i + CHUNK), 'write')
      inserted += Math.min(CHUNK, statements.length - i)
    }

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
