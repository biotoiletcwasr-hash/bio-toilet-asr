import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

// GET: fetch remarks — ?coach_no=X for one coach, no param for all
export async function GET(req: NextRequest) {
  try {
    await initDB()
    const coachNo = req.nextUrl.searchParams.get('coach_no')?.toUpperCase() || ''

    const sql = coachNo
      ? `SELECT * FROM resampling_remarks WHERE UPPER(coach_no) = ? ORDER BY remark_date DESC, id DESC`
      : `SELECT * FROM resampling_remarks ORDER BY remark_date DESC, id DESC`
    const args = coachNo ? [coachNo] : []

    const res = await db.execute({ sql, args })
    return NextResponse.json({ remarks: res.rows })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'DB Error' }, { status: 500 })
  }
}

// POST: add a new remark
export async function POST(req: NextRequest) {
  try {
    await initDB()
    const body = await req.json()
    const { coach_no, train_no, remark_date, location_status, remark } = body

    if (!coach_no || !remark_date) {
      return NextResponse.json({ error: 'coach_no and remark_date required' }, { status: 400 })
    }

    const res = await db.execute({
      sql: `INSERT INTO resampling_remarks (coach_no, train_no, remark_date, location_status, remark)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        (coach_no as string).toUpperCase(),
        train_no || '',
        remark_date,
        location_status || '',
        remark || '',
      ],
    })

    // Return the inserted row
    const inserted = await db.execute({
      sql: `SELECT * FROM resampling_remarks WHERE id = ?`,
      args: [res.lastInsertRowid],
    })

    return NextResponse.json({ remark: inserted.rows[0], success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'DB Error' }, { status: 500 })
  }
}
