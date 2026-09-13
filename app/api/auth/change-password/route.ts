import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import { hashPassword, verifySessionToken, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    // Verify session
    const token = req.cookies.get(SESSION_COOKIE)?.value
    if (!token || !(await verifySessionToken(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Both fields required' }, { status: 400 })
    }
    if (String(newPassword).length < 4) {
      return NextResponse.json({ error: 'New password must be at least 4 characters' }, { status: 400 })
    }

    await initDB()

    // Verify current password
    const saltRes = await db.execute(`SELECT value FROM meta WHERE key = 'pw_salt'`)
    const hashRes = await db.execute(`SELECT value FROM meta WHERE key = 'pw_hash'`)
    const salt       = saltRes.rows[0]?.value as string
    const storedHash = hashRes.rows[0]?.value as string

    const currentHash = await hashPassword(salt, String(currentPassword))
    if (currentHash !== storedHash) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    // Save new password with fresh salt
    const newSalt = Date.now().toString(36) + Math.random().toString(36).slice(2)
    const newHash = await hashPassword(newSalt, String(newPassword))

    await db.batch([
      { sql: `UPDATE meta SET value = ? WHERE key = 'pw_salt'`, args: [newSalt] },
      { sql: `UPDATE meta SET value = ? WHERE key = 'pw_hash'`, args: [newHash] },
    ])

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Change password error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
