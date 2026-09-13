import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import * as XLSX from 'xlsx'

function parseExcelDate(val: any): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'string') {
    const s = val.trim()
    if (!s) return null
    if (s.toUpperCase() === 'NA') return 'NA'
    const parts = s.split(/[-\/]/)
    if (parts.length === 3 && parts[0].length <= 2) {
      return `${parts[2].padStart(4, '20')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
    return s
  }
  return null
}

function safeNum(val: any): number | null {
  if (val == null) return null
  const s = String(val).trim()
  if (!s) return null
  const sciMatch = s.match(/^([0-9.]+)[Xx]\s*10\^?\s*([0-9]+)$/)
  if (sciMatch) {
    const n = parseFloat(sciMatch[1]) * Math.pow(10, parseInt(sciMatch[2]))
    return isFinite(n) ? n : null
  }
  const cleaned = s.replace(/\.+$/, '').trim()
  const n = parseFloat(cleaned)
  return isFinite(n) ? n : null
}

function mapResult(val: any): string {
  if (!val) return 'PASS'
  const s = String(val).trim()
  if (!s) return 'PASS'
  return s.toUpperCase().includes('FAIL') ? 'FAIL' : 'PASS'
}

export async function DELETE() {
  try {
    await initDB()
    await db.execute(`DELETE FROM bio_test_entries`)
    await db.execute(`UPDATE meta SET value = '0' WHERE key = 'last_s_no'`)
    return NextResponse.json({ success: true, message: 'All entries deleted' })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || 'Delete failed' }, { status: 500 })
  }
}

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
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

    const maxRes = await db.execute(`SELECT MAX(s_no) as max_s FROM bio_test_entries`)
    let currentMax = (maxRes.rows[0].max_s as number) || 0

    const statements: { sql: string; args: any[] }[] = []
    let skipped = 0

    for (let i = 3; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row[0] == null) continue

      const coachNo = row[3] != null ? String(row[3]).trim() : ''
      if (!coachNo) { skipped++; continue }

      const dateStr = parseExcelDate(row[1])
      if (!dateStr || dateStr === 'NA') { skipped++; continue }

      const trainNo   = row[2] != null ? String(row[2]).trim() : ''
      const code      = row[4] != null ? String(row[4]).trim() : ''
      const bioTankNo = row[5] != null ? String(row[5]).trim() : ''
      const ph        = safeNum(row[6])
      const cod       = safeNum(row[7])
      const fcfc      = safeNum(row[8])
      const result    = mapResult(row[9])
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

    const CHUNK = 50
    let inserted = 0
    for (let i = 0; i < statements.length; i += CHUNK) {
      const chunk = statements.slice(i, i + CHUNK)
      await db.batch(chunk)
      inserted += chunk.length
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
