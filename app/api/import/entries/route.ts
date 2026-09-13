import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import { calculateResult } from '@/lib/types'
import * as XLSX from 'xlsx'

// POST: Upload ASR & CIA 2026 Excel sheet → bulk import into bio_test_entries
export async function POST(req: NextRequest) {
  try {
    await initDB()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

    // Find the ASR & CIA sheet (try common names)
    const sheetName =
      workbook.SheetNames.find(n => n.includes('ASR') || n.includes('CIA') || n.includes('2026')) ||
      workbook.SheetNames[0]

    const ws = workbook.Sheets[sheetName]
    // Data starts at row 4 (index 3), header at row 3
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false })

    let inserted = 0
    let skipped = 0

    // Get current max s_no to avoid conflicts
    const maxRes = await db.execute(`SELECT MAX(s_no) as max_s FROM bio_test_entries`)
    let currentMax = (maxRes.rows[0].max_s as number) || 0

    for (let i = 3; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 4) continue

      // Column mapping (0-indexed): A=0 S.No, B=1 Date, C=2 Train, D=3 Coach, E=4 Code,
      // F=5 BioTank, G=6 pH, H=7 COD, I=8 FCFC, J=9 Result, K=10 2nd Date, L=11 2nd Result
      const rawDate = row[1]
      const trainNo = String(row[2] || '').trim()
      const coachNo = String(row[3] || '').trim()

      if (!rawDate || !trainNo || !coachNo) { skipped++; continue }

      // Parse date — Excel may give DD-MM-YYYY string or serial number
      let dateStr = ''
      if (typeof rawDate === 'string') {
        // Handle DD-MM-YYYY or DD/MM/YYYY
        const parts = rawDate.split(/[-\/]/)
        if (parts.length === 3 && parts[0].length <= 2) {
          dateStr = `${parts[2].padStart(4, '20')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
        } else {
          dateStr = rawDate
        }
      } else if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().split('T')[0]
      } else {
        skipped++; continue
      }

      const code      = String(row[4] || '').trim()
      const bioTankNo = String(row[5] || '').trim()
      const ph        = row[6] !== '' && row[6] != null ? parseFloat(row[6]) : null
      const cod       = row[7] !== '' && row[7] != null ? parseFloat(row[7]) : null
      const fcfc      = row[8] !== '' && row[8] != null ? parseFloat(row[8]) : null
      const result    = calculateResult(ph, cod, fcfc)

      // 2nd test
      let secondDate = ''
      const rawSecondDate = row[10]
      if (rawSecondDate) {
        if (typeof rawSecondDate === 'string') {
          const parts = rawSecondDate.split(/[-\/]/)
          if (parts.length === 3 && parts[0].length <= 2) {
            secondDate = `${parts[2].padStart(4, '20')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
          } else {
            secondDate = rawSecondDate
          }
        } else if (rawSecondDate instanceof Date) {
          secondDate = rawSecondDate.toISOString().split('T')[0]
        }
      }
      const secondResult = String(row[11] || '').trim()

      currentMax++
      try {
        await db.execute({
          sql: `
            INSERT OR IGNORE INTO bio_test_entries
              (s_no, date, train_no, coach_no, code, bio_tank_no, ph, cod, fcfc, result, second_test_date, second_test_result)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [currentMax, dateStr, trainNo, coachNo, code, bioTankNo,
                 ph, cod, fcfc, result,
                 secondDate || null, secondResult || null],
        })
        inserted++
      } catch {
        skipped++
      }
    }

    // Sync meta last_s_no
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
