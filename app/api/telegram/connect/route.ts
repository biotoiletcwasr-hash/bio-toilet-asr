import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

function randomToken(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

export async function POST(req: NextRequest) {
  try {
    await initDB()
    const { name, depot } = await req.json()

    if (!name?.trim() || !['ASR', 'FZR', 'JUC'].includes(depot)) {
      return NextResponse.json({ error: 'Valid naam aur depot chahiye' }, { status: 400 })
    }

    // Get bot username from Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 })
    }

    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const meData = await meRes.json()
    const botUsername = meData.result?.username

    if (!botUsername) {
      return NextResponse.json({ error: 'Bot username not found' }, { status: 500 })
    }

    // Generate unique link token
    const linkToken = randomToken(10)

    // Store in DB with 30-minute expiry
    await db.execute({
      sql: `INSERT INTO telegram_link_tokens (token, name, depot, expires_at)
            VALUES (?, ?, ?, datetime('now', '+30 minutes'))`,
      args: [linkToken, name.trim(), depot],
    })

    const deepLink = `https://t.me/${botUsername}?start=${linkToken}`

    return NextResponse.json({
      link: deepLink,
      botUsername,
      name: name.trim(),
      depot,
      expires_in_minutes: 30,
    })
  } catch (err) {
    console.error('Telegram connect error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
