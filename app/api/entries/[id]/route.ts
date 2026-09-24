import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateResult } from '@/lib/types'

/** Normalize any date string to YYYY-MM-DD for safe DB storage & sorting.
 *  Handles: YYYY-MM-DD (no-op), DD-MM-YYYY, DD/MM/YYYY */
function normalizeDate(val: string | null | undefined): string | null {
  if (!val) return null
  const s = val.trim()
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD-MM-YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return s  // unknown format — store as-is
}

// PUT - update an entry (all editable fields)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const {
      date, train_no, coach_no, code, bio_tank_no,
      ph, cod, fcfc,
      second_test_date, second_test_result,
      depot,
    } = body

    const phVal   = ph   !== '' && ph   != null ? parseFloat(String(ph))   : null
    const codVal  = cod  !== '' && cod  != null ? parseFloat(String(cod))  : null
    const fcfcVal = fcfc !== '' && fcfc != null ? parseFloat(String(fcfc)) : null

    // Recalculate result only when all three values are present.
    // If any is null, preserve the existing DB result so that editing
    // a date/train/coach field doesn't accidentally flip PASS→PENDING.
    const calculated = calculateResult(phVal, codVal, fcfcVal)
    let finalResult = calculated
    if (calculated === 'PENDING') {
      const existing = await db.execute({
        sql: `SELECT result FROM bio_test_entries WHERE id = ?`,
        args: [params.id],
      })
      const existingResult = existing.rows[0]?.result as string | undefined
      if (existingResult === 'PASS' || existingResult === 'FAIL') {
        finalResult = existingResult as 'PASS' | 'FAIL'
      }
    }

    await db.execute({
      sql: `
        UPDATE bio_test_entries
        SET date = ?, train_no = ?, coach_no = ?, code = ?, bio_tank_no = ?,
            ph = ?, cod = ?, fcfc = ?, result = ?,
            second_test_date = ?, second_test_result = ?, depot = ?
        WHERE id = ?
      `,
      args: [
        normalizeDate(date), train_no || '', coach_no || '', code || '', bio_tank_no || '',
        phVal, codVal, fcfcVal, finalResult,
        normalizeDate(second_test_date),
        second_test_result || null,
        depot || 'ASR',
        params.id,
      ],
    })

    const updated = await db.execute({
      sql: `SELECT * FROM bio_test_entries WHERE id = ?`,
      args: [params.id],
    })

    return NextResponse.json({ entry: updated.rows[0] })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

// DELETE
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.execute({
      sql: `DELETE FROM bio_test_entries WHERE id = ?`,
      args: [params.id],
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
