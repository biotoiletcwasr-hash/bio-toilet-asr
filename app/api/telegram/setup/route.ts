import { NextRequest, NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

// GET /api/telegram/setup?key=<SETUP_KEY>
// One-time setup: registers webhook with Telegram + saves admin to DB
export async function GET(req: NextRequest) {
  const setupKey = process.env.TELEGRAM_SETUP_KEY || 'setup-bio-bot-2026'
  const key = new URL(req.url).searchParams.get('key')
  if (key !== setupKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token   = process.env.TELEGRAM_BOT_TOKEN
  const adminId = process.env.TELEGRAM_ADMIN_CHAT_ID
  const secret  = process.env.TELEGRAM_WEBHOOK_SECRET || ''

  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 })

  const appUrl = 'https://bio-toilet-asr.vercel.app'
  const webhookUrl = `${appUrl}/api/telegram/webhook`

  // Register webhook with Telegram
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret || undefined,
      allowed_updates: ['message', 'callback_query'],
    }),
  })
  const telegramResponse = await res.json()

  // Optionally save admin to DB
  let adminSaved = false
  if (adminId) {
    try {
      await initDB()
      await db.execute({
        sql: `INSERT OR IGNORE INTO telegram_users (chat_id, name, depot, role, is_active)
              VALUES (?, 'Admin (Prem)', 'ASR', 'admin', 1)`,
        args: [adminId],
      })
      adminSaved = true
    } catch (e) {
      console.error('Admin save error:', e)
    }
  }

  return NextResponse.json({
    webhook: webhookUrl,
    telegram: telegramResponse,
    adminSaved,
    adminId: adminId || '(not set)',
    note: adminId ? null : 'Set TELEGRAM_ADMIN_CHAT_ID env var. Use /myid in bot to get your chat ID.',
  })
}
