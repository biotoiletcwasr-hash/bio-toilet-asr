import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import { hashPassword, createSessionToken, SESSION_COOKIE, SESSION_EXPIRY_MS } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    // Only 'admin' username is supported
    if (String(username).trim().toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    await initDB()

    const saltRes = await db.execute(`SELECT value FROM meta WHERE key = 'pw_salt'`)
    const hashRes = await db.execute(`SELECT value FROM meta WHERE key = 'pw_hash'`)

    const salt       = saltRes.rows[0]?.value as string | undefined
    const storedHash = hashRes.rows[0]?.value as string | undefined

    if (!salt || !storedHash) {
      return NextResponse.json({ error: 'Auth not initialized. Retry in a moment.' }, { status: 500 })
    }

    const inputHash = await hashPassword(salt, String(password))
    if (inputHash !== storedHash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await createSessionToken()

    const response = NextResponse.json({ success: true })
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRY_MS / 1000,
      path: '/',
    })

    return response
  } catch (err: any) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
