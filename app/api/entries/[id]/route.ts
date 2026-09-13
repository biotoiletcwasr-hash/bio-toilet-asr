import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateResult } from '@/lib/types'

// PUT - update an entry (mainly for 2nd test results)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { second_test_date, second_test_result, ph, cod, fcfc } = body

    const phVal = ph !== '' && ph !== null ? parseFloat(ph) : null
    const codVal = cod !== '' && cod !== null ? parseFloat(cod) : null
    const fcfcVal = fcfc !== '' && fcfc !== null ? parseFloat(fcfc) : null
    const result = calculateResult(phVal, codVal, fcfcVal)

    await db.execute({
      sql: `
        UPDATE bio_test_entries
        SET ph = ?, cod = ?, fcfc = ?, result = ?,
            second_test_date = ?, second_test_result = ?
        WHERE id = ?
      `,
      args: [
        phVal, codVal, fcfcVal, result,
        second_test_date || null,
        second_test_result || null,
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
