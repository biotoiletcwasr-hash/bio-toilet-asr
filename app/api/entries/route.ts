import { NextRequest, NextResponse } from 'next/server'
import { db, initDB, getNextSNo } from '@/lib/db'
import { calculateResult } from '@/lib/types'

// GET all entries
export async function GET(req: NextRequest) {
  try {
    await initDB()
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const search = url.searchParams.get('search') || ''
    const depot  = url.searchParams.get('depot')  || ''
    const offset = (page - 1) * limit

    const searchParam = `%${search}%`
    const depotFilter = depot ? `AND UPPER(depot) = UPPER(?)` : ''
    const baseArgs    = depot
      ? [searchParam, searchParam, searchParam, depot]
      : [searchParam, searchParam, searchParam]

    const result = await db.execute({
      sql: `SELECT * FROM bio_test_entries
            WHERE (train_no LIKE ? OR coach_no LIKE ? OR code LIKE ?)
            ${depotFilter}
            ORDER BY s_no DESC LIMIT ? OFFSET ?`,
      args: [...baseArgs, limit, offset],
    })

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM bio_test_entries
            WHERE (train_no LIKE ? OR coach_no LIKE ? OR code LIKE ?) ${depotFilter}`,
      args: baseArgs,
    })

    return NextResponse.json({
      entries: result.rows,
      total: countResult.rows[0].total,
      page,
      limit,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'DB Error' }, { status: 500 })
  }
}

// POST new entry
export async function POST(req: NextRequest) {
  try {
    await initDB()
    const body = await req.json()
    const {
      date, train_no, coach_no, code, bio_tank_no,
      ph, cod, fcfc,
      second_test_date, second_test_result,
      depot,
    } = body

    const phVal = ph !== '' && ph !== null ? parseFloat(ph) : null
    const codVal = cod !== '' && cod !== null ? parseFloat(cod) : null
    const fcfcVal = fcfc !== '' && fcfc !== null ? parseFloat(fcfc) : null

    const result = calculateResult(phVal, codVal, fcfcVal)
    const sNo = await getNextSNo()

    const res = await db.execute({
      sql: `
        INSERT INTO bio_test_entries
          (s_no, date, train_no, coach_no, code, bio_tank_no, ph, cod, fcfc, result, second_test_date, second_test_result, depot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        sNo, date, train_no, coach_no, code, bio_tank_no,
        phVal, codVal, fcfcVal, result,
        second_test_date || null,
        second_test_result || null,
        depot || 'ASR',
      ],
    })

    // Fetch and return the created row
    const newRow = await db.execute({
      sql: `SELECT * FROM bio_test_entries WHERE id = ?`,
      args: [Number(res.lastInsertRowid ?? 0)],
    })

    return NextResponse.json({ entry: newRow.rows[0] }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }
}
