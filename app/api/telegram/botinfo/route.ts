import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No bot token' }, { status: 500 })

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const data = await res.json()
    if (!data.ok) return NextResponse.json({ error: 'Telegram error' }, { status: 500 })
    return NextResponse.json({ username: data.result.username, name: data.result.first_name })
  } catch {
    return NextResponse.json({ error: 'Failed to reach Telegram' }, { status: 500 })
  }
}
