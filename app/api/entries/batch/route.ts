import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import { calculateResult } from '@/lib/types'

interface TankEntry {
  date: string
  train_no: string
  coach_no: string
  code: string
  bio_tank_no: string
  ph: number | null
  cod: number | null
  fcfc: number | null
  second_test_date: string | null
  second_test_result: string | null
}

export async function POST(req: NextRequest) {
  try {
    await initDB()

    const body = await req.json()
    const entries: TankEntry[] = body.entries ?? []
    const depot: string = body.depot?.trim() || 'ASR'

    if (!entries.length) {
      return NextResponse.json({ error: 'No entries provided' }, { status: 400 })
    }

    const count = entries.length

    // ── Atomically allocate N sequential s_nos in a single UPDATE ──────────
    // After the UPDATE, `last_val` is the NEW value of last_s_no.
    // So the batch occupies s_nos: [last_val - count + 1 … last_val].
    const allocRes = await db.execute({
      sql: `UPDATE meta
               SET value = CAST(CAST(value AS INTEGER) + ? AS TEXT)
             WHERE key = 'last_s_no'
             RETURNING CAST(value AS INTEGER) AS last_val`,
      args: [count],
    })

    const lastVal = allocRes.rows[0].last_val as number
    const firstSNo = lastVal - count + 1


    // Normalize any date format → YYYY-MM-DD before storing
    function toISO(s: string | null | undefined): string {
      if (!s) return ''
      // DD.MM.YYYY  DD-MM-YYYY  DD/MM/YYYY
      const m1 = s.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})$/)
      if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`
      // YYYY-DD-MM (old bulk import format)
      const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (m2 && parseInt(m2[2]) > 12) return `${m2[1]}-${m2[3]}-${m2[2]}`
      return s
    }

    // ── Build batch of INSERT statements ────────────────────────────────────
    const inserts = entries.map((e, i) => {
      const sNo = firstSNo + i
      const ph   = e.ph   !== null && e.ph   !== undefined ? Number(e.ph)   : null
      const cod  = e.cod  !== null && e.cod  !== undefined ? Number(e.cod)  : null
      const fcfc = e.fcfc !== null && e.fcfc !== undefined ? Number(e.fcfc) : null
      const result = calculateResult(ph, cod, fcfc)

      return {
        sql: `INSERT INTO bio_test_entries
                (s_no, date, train_no, coach_no, code, bio_tank_no,
                 ph, cod, fcfc, result, second_test_date, second_test_result, depot)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          sNo,
          toISO(e.date),
          e.train_no,
          e.coach_no,
          e.code ?? '',
          e.bio_tank_no ?? '',
          ph,
          cod,
          fcfc,
          result,
          e.second_test_date || null,
          e.second_test_result || null,
          depot,
        ],
      }
    })

    await db.batch(inserts)

    // ── Fetch all inserted rows by their allocated s_nos ────────────────────
    const sNos = Array.from({ length: count }, (_, i) => firstSNo + i)
    const placeholders = sNos.map(() => '?').join(', ')

    const fetched = await db.execute({
      sql: `SELECT * FROM bio_test_entries WHERE s_no IN (${placeholders}) ORDER BY s_no`,
      args: sNos,
    })

    return NextResponse.json({ entries: fetched.rows })
  } catch (err) {
    console.error('[batch insert]', err)
    return NextResponse.json({ error: 'DB Error' }, { status: 500 })
  }
}
