import { NextRequest, NextResponse } from 'next/server'
import { db, initDB, getNextSNo } from '@/lib/db'
import { calculateResult } from '@/lib/types'

// ── Telegram API helper ──────────────────────────────────────────────────────
async function tg(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  try {
    await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.error('Telegram API error:', e)
  }
}

async function send(chatId: string | number, text: string, extra: Record<string, unknown> = {}) {
  await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra })
}

async function answerCallback(callbackQueryId: string, text?: string) {
  await tg('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
}

// ── DB helpers ───────────────────────────────────────────────────────────────
async function getUser(chatId: string) {
  const r = await db.execute({ sql: `SELECT * FROM telegram_users WHERE chat_id = ?`, args: [chatId] })
  return r.rows[0] || null
}

async function getSession(chatId: string): Promise<{ step: string | null; data: Record<string, string> }> {
  const r = await db.execute({ sql: `SELECT step, data FROM telegram_sessions WHERE chat_id = ?`, args: [chatId] })
  if (!r.rows[0]) return { step: null, data: {} }
  return {
    step: (r.rows[0].step as string) || null,
    data: JSON.parse((r.rows[0].data as string) || '{}'),
  }
}

async function setSession(chatId: string, step: string | null, data: Record<string, string> = {}) {
  await db.execute({
    sql: `INSERT INTO telegram_sessions (chat_id, step, data, updated_at)
          VALUES (?, ?, ?, datetime('now','localtime'))
          ON CONFLICT(chat_id) DO UPDATE
          SET step = excluded.step, data = excluded.data, updated_at = excluded.updated_at`,
    args: [chatId, step, JSON.stringify(data)],
  })
}

async function clearSession(chatId: string) {
  await setSession(chatId, null, {})
}

// ── Date utilities ───────────────────────────────────────────────────────────
function normalizeDate(val: string): string {
  const s = val.trim()
  let m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return ''
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso)
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function adminChatId(): string {
  return process.env.TELEGRAM_ADMIN_CHAT_ID || ''
}

// ── Main POST handler ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Verify secret token
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  if (secret) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token') || ''
    if (incoming !== secret) {
      return NextResponse.json({ ok: false }, { status: 403 })
    }
  }

  try {
    await initDB()
    const update = await req.json()

    if (update.callback_query) {
      await handleCallback(update.callback_query)
    } else if (update.message?.text) {
      await handleMessage(update.message)
    }
  } catch (err) {
    console.error('Telegram webhook error:', err)
  }

  return NextResponse.json({ ok: true })
}

// ── Message router ───────────────────────────────────────────────────────────
async function handleMessage(msg: {
  message_id: number
  from?: { id: number; first_name?: string }
  chat: { id: number }
  text?: string
}) {
  const chatId = String(msg.chat.id)
  const text = (msg.text || '').trim()
  const firstName = msg.from?.first_name || 'User'

  // /myid — always public
  if (text === '/myid') {
    await send(chatId, `🪪 Your Chat ID: <code>${chatId}</code>\n\nIs ID ko admin ko bhejein env var set karne ke liye.`)
    return
  }

  // /cancel — always works
  if (text === '/cancel') {
    await clearSession(chatId)
    await send(chatId, '❌ Operation cancel ho gaya.\n\n/help — commands list')
    return
  }

  // Check session (multi-step flow in progress)
  const session = await getSession(chatId)
  if (session.step) {
    await handleStep(chatId, text, session, firstName)
    return
  }

  // Get user
  const user = await getUser(chatId)

  // /start — always available (may include deep-link token)
  if (text.startsWith('/start')) {
    const parts = text.split(' ')
    const startParam = parts[1]?.trim() || ''
    await handleStart(chatId, user, firstName, startParam)
    return
  }

  // Not registered
  if (!user) {
    await send(chatId, '⚠️ Aap registered nahi hain.\n\n/start — registration karein')
    return
  }

  // Pending approval
  if (!user.is_active) {
    await send(chatId, '⏳ Aapki request pending hai. Admin approval ka wait karein.')
    return
  }

  // Commands
  if (text.startsWith('/coach')) {
    await handleCoach(chatId, user, text)
  } else if (text === '/due') {
    await handleDue(chatId, user)
  } else if (text === '/overdue') {
    await handleOverdue(chatId, user)
  } else if (text === '/pending') {
    await handlePending(chatId, user)
  } else if (text === '/add') {
    await handleAddStart(chatId, user)
  } else if (text === '/users') {
    await handleUsers(chatId, user)
  } else if (text === '/help') {
    await handleHelp(chatId, user)
  } else {
    await send(chatId, '❓ Command samajh nahi aaya.\n\n/help — commands list')
  }
}

// ── /start — Registration flow ───────────────────────────────────────────────
async function handleStart(
  chatId: string,
  existingUser: Record<string, unknown> | null,
  firstName: string,
  startParam = ''
) {
  if (existingUser?.is_active) {
    await send(
      chatId,
      `✅ Aap already registered hain!\n\n` +
      `👤 <b>${existingUser.name}</b> | ${existingUser.depot} | ${existingUser.role}\n\n` +
      `/help — commands list`
    )
    return
  }

  // ── Deep link registration via app-generated token ──
  if (startParam) {
    const tokenRow = await db.execute({
      sql: `SELECT * FROM telegram_link_tokens
            WHERE token = ? AND used = 0 AND datetime('now') < datetime(expires_at)`,
      args: [startParam],
    })

    if (tokenRow.rows[0]) {
      const td = tokenRow.rows[0]
      // Auto-register and approve (link was generated from within the app)
      await db.execute({
        sql: `INSERT OR REPLACE INTO telegram_users (chat_id, name, depot, role, is_active)
              VALUES (?, ?, ?, 'staff', 1)`,
        args: [chatId, td.name, td.depot],
      })
      await db.execute({
        sql: `UPDATE telegram_link_tokens SET used = 1 WHERE token = ?`,
        args: [startParam],
      })
      await clearSession(chatId)
      await send(
        chatId,
        `🎉 <b>Connected!</b>\n\n` +
        `👤 <b>${td.name}</b> | ${td.depot}\n\n` +
        `Ab aap bot use kar sakte hain.\n/help — commands list`
      )
      const admin = adminChatId()
      if (admin && admin !== chatId) {
        await send(admin, `✅ <b>${td.name}</b> (${td.depot}) app se connect ho gaya! 📱`)
      }
      return
    } else {
      await send(chatId,
        `❌ Link expired ho gaya ya already use ho chuka hai.\n\nAdmin se naya link maango.`
      )
      return
    }
  }

  if (existingUser && !existingUser.is_active) {
    await send(chatId, `⏳ Aapki registration request pending hai. Admin se contact karein.`)
    return
  }

  // Normal manual registration
  await setSession(chatId, 'REG_NAME', { firstName })
  await send(
    chatId,
    `🙏 <b>Bio-Toilet Test System</b> mein aapka swagat hai!\n\n` +
    `Registration ke liye apna <b>poora naam</b> type karein:`
  )
}

// ── Multi-step flow handler ──────────────────────────────────────────────────
async function handleStep(
  chatId: string,
  text: string,
  session: { step: string | null; data: Record<string, string> },
  firstName: string
) {
  const { step, data } = session
  const user = await getUser(chatId)

  switch (step) {
    // ── Registration ──
    case 'REG_NAME': {
      if (!text || text.startsWith('/') || text.length < 2) {
        await send(chatId, '⚠️ Valid naam likhein (kam se kam 2 characters):')
        return
      }
      await setSession(chatId, 'REG_DEPOT', { ...data, name: text })
      await send(chatId, `✅ Naam: <b>${text}</b>\n\nApna depot select karein:`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '🏭 ASR', callback_data: `depot:ASR:${chatId}` },
            { text: '🏭 FZR', callback_data: `depot:FZR:${chatId}` },
            { text: '🏭 JUC', callback_data: `depot:JUC:${chatId}` },
          ]]
        }
      })
      return
    }

    // ── Add Entry steps ──
    case 'ADD_COACH': {
      if (!text || text.startsWith('/') || !/^\d+$/.test(text)) {
        await send(chatId, '⚠️ Valid coach number likhein (sirf digits):\nExample: <code>258840</code>')
        return
      }
      await setSession(chatId, 'ADD_DATE', { ...data, coach_no: text })
      await send(chatId, `Coach: <b>${text}</b>\n\n📅 <b>Date</b> likhein (DD-MM-YYYY)\nYa aaj ke liye type karein: <code>/today</code>`)
      return
    }

    case 'ADD_DATE': {
      let dateVal = ''
      if (text === '/today') {
        dateVal = todayISO()
      } else {
        dateVal = normalizeDate(text)
      }
      if (!dateVal) {
        await send(chatId, '⚠️ Date format sahi nahi.\nDD-MM-YYYY mein likhein:\nExample: <code>07-10-2026</code>\nYa aaj ke liye: <code>/today</code>')
        return
      }
      await setSession(chatId, 'ADD_TRAIN', { ...data, date: dateVal })
      await send(chatId, `Date: <b>${fmtDate(dateVal)}</b>\n\n🚂 <b>Train No.</b> likhein:`)
      return
    }

    case 'ADD_TRAIN': {
      if (!text || text.startsWith('/')) {
        await send(chatId, '⚠️ Train number likhein:')
        return
      }
      await setSession(chatId, 'ADD_TANK', { ...data, train_no: text })
      await send(chatId, `Train: <b>${text}</b>\n\n🔢 <b>Tank No.</b> likhein (ya nahi hai toh: <code>/skip</code>):`)
      return
    }

    case 'ADD_TANK': {
      const tankVal = text === '/skip' ? '' : text
      await setSession(chatId, 'ADD_PH', { ...data, bio_tank_no: tankVal })
      await send(chatId, `Tank: <b>${tankVal || '—'}</b>\n\n🧪 <b>pH</b> value likhein (6.0 – 9.0):`)
      return
    }

    case 'ADD_PH': {
      const ph = parseFloat(text)
      if (isNaN(ph)) {
        await send(chatId, '⚠️ Valid pH likhein (jaise: <code>7.2</code>):')
        return
      }
      await setSession(chatId, 'ADD_COD', { ...data, ph: String(ph) })
      await send(chatId, `pH: <b>${ph}</b>\n\n🧪 <b>COD</b> value likhein (mg/L):`)
      return
    }

    case 'ADD_COD': {
      const cod = parseFloat(text)
      if (isNaN(cod)) {
        await send(chatId, '⚠️ Valid COD likhein (jaise: <code>450</code>):')
        return
      }
      await setSession(chatId, 'ADD_FCFC', { ...data, cod: String(cod) })
      await send(chatId, `COD: <b>${cod}</b>\n\n🧪 <b>FCFC</b> value likhein (ya nahi hai toh: <code>/skip</code>):`)
      return
    }

    case 'ADD_FCFC': {
      let fcfcVal = ''
      if (text !== '/skip') {
        const fcfc = parseFloat(text)
        if (isNaN(fcfc)) {
          await send(chatId, '⚠️ Valid FCFC likhein ya /skip karein:')
          return
        }
        fcfcVal = String(fcfc)
      }

      const phN   = parseFloat(data.ph)
      const codN  = parseFloat(data.cod)
      const fcfcN = fcfcVal ? parseFloat(fcfcVal) : null
      const result = calculateResult(phN, codN, fcfcN)
      const depot  = (user?.depot as string) || 'ASR'
      const rEmoji = result === 'PASS' ? '✅' : result === 'FAIL' ? '❌' : '⏳'

      const confirmMsg =
        `📋 <b>Entry Confirm karein:</b>\n\n` +
        `Coach: <b>${data.coach_no}</b>\n` +
        `Date:  <b>${fmtDate(data.date)}</b>\n` +
        `Train: <b>${data.train_no}</b>\n` +
        `Tank:  <b>${data.bio_tank_no || '—'}</b>\n` +
        `pH:    <b>${data.ph}</b>\n` +
        `COD:   <b>${data.cod}</b>\n` +
        `FCFC:  <b>${fcfcVal || '—'}</b>\n` +
        `Result:${rEmoji} <b>${result}</b>\n` +
        `Depot: <b>${depot}</b>\n\n` +
        `Save karein?`

      await setSession(chatId, 'ADD_CONFIRM', { ...data, fcfc: fcfcVal, result, depot })
      await send(chatId, confirmMsg, {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Save', callback_data: `save:${chatId}` },
            { text: '❌ Cancel', callback_data: `cancel_entry:${chatId}` },
          ]]
        }
      })
      return
    }

    default:
      await clearSession(chatId)
      await send(chatId, '❓ Kuch issue hua. /help se retry karein.')
  }
}

// ── Callback query handler ───────────────────────────────────────────────────
async function handleCallback(cq: {
  id: string
  from: { id: number }
  message?: { chat: { id: number } }
  data?: string
}) {
  const callerId = String(cq.from.id)
  const data = cq.data || ''
  await answerCallback(cq.id)

  // Depot selection (registration)
  if (data.startsWith('depot:')) {
    const [, depot, userChatId] = data.split(':')
    if (callerId !== userChatId) return  // ignore if someone else clicks
    const session = await getSession(userChatId)
    if (session.step !== 'REG_DEPOT') return
    const name = session.data.name || 'Unknown'

    await db.execute({
      sql: `INSERT OR REPLACE INTO telegram_users (chat_id, name, depot, role, is_active)
            VALUES (?, ?, ?, 'staff', 0)`,
      args: [userChatId, name, depot],
    })
    await clearSession(userChatId)

    await send(userChatId,
      `✅ Request submit ho gayi!\n\n` +
      `👤 <b>${name}</b> | ${depot}\n\n` +
      `⏳ Admin approval milne ke baad aap bot use kar sakte hain.`
    )

    const admin = adminChatId()
    if (admin) {
      await send(admin,
        `🆕 <b>New Registration Request</b>\n\n` +
        `👤 <b>${name}</b>\n` +
        `🏭 Depot: <b>${depot}</b>\n` +
        `🪪 Chat ID: <code>${userChatId}</code>`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Approve', callback_data: `approve:${userChatId}` },
              { text: '❌ Reject',  callback_data: `reject:${userChatId}`  },
            ]]
          }
        }
      )
    }
    return
  }

  // Admin: Approve user
  if (data.startsWith('approve:')) {
    const [, targetId] = data.split(':')
    if (callerId !== adminChatId()) {
      await send(callerId, '⚠️ Sirf admin approve kar sakta hai.')
      return
    }
    await db.execute({ sql: `UPDATE telegram_users SET is_active = 1 WHERE chat_id = ?`, args: [targetId] })
    const ur = await db.execute({ sql: `SELECT * FROM telegram_users WHERE chat_id = ?`, args: [targetId] })
    const u = ur.rows[0]
    await send(callerId, `✅ <b>${u?.name}</b> (${u?.depot}) approve ho gaya!`)
    await send(targetId,
      `🎉 <b>Registration approved!</b>\n\n` +
      `Ab aap bot use kar sakte hain.\n\n` +
      `/help — commands list`
    )
    return
  }

  // Admin: Reject user
  if (data.startsWith('reject:')) {
    const [, targetId] = data.split(':')
    if (callerId !== adminChatId()) {
      await send(callerId, '⚠️ Sirf admin reject kar sakta hai.')
      return
    }
    const ur = await db.execute({ sql: `SELECT name FROM telegram_users WHERE chat_id = ?`, args: [targetId] })
    const name = ur.rows[0]?.name || targetId
    await db.execute({ sql: `DELETE FROM telegram_users WHERE chat_id = ?`, args: [targetId] })
    await send(callerId, `❌ <b>${name}</b> ki request reject kar di.`)
    await send(targetId, `❌ Aapki registration request reject ho gayi. Admin se contact karein.`)
    return
  }

  // Save entry (from ADD_CONFIRM step)
  if (data.startsWith('save:')) {
    const [, userChatId] = data.split(':')
    if (callerId !== userChatId) return
    const session = await getSession(userChatId)
    if (session.step !== 'ADD_CONFIRM') return

    const d = session.data
    const phVal   = d.ph   ? parseFloat(d.ph)   : null
    const codVal  = d.cod  ? parseFloat(d.cod)  : null
    const fcfcVal = d.fcfc ? parseFloat(d.fcfc) : null

    const sNo = await getNextSNo()
    await db.execute({
      sql: `INSERT INTO bio_test_entries
              (s_no, date, train_no, coach_no, code, bio_tank_no, ph, cod, fcfc, result, depot)
            VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)`,
      args: [sNo, d.date, d.train_no, d.coach_no, d.bio_tank_no || '', phVal, codVal, fcfcVal, d.result, d.depot],
    })
    await clearSession(userChatId)

    const rEmoji = d.result === 'PASS' ? '✅' : d.result === 'FAIL' ? '❌' : '⏳'
    await send(userChatId,
      `${rEmoji} <b>Entry saved!</b>\n\n` +
      `Coach: <b>${d.coach_no}</b>\n` +
      `Result: <b>${d.result}</b>\n` +
      `S.No: <b>#${sNo}</b>\n\n` +
      `/add — aur entry daalo`
    )
    return
  }

  // Cancel entry
  if (data.startsWith('cancel_entry:')) {
    const [, userChatId] = data.split(':')
    if (callerId !== userChatId) return
    await clearSession(userChatId)
    await send(userChatId, '❌ Entry cancel ho gayi.\n\n/add — dobara try karein')
    return
  }
}

// ── Command: /coach <no> ─────────────────────────────────────────────────────
async function handleCoach(chatId: string, user: Record<string, unknown>, text: string) {
  const parts = text.trim().split(/\s+/)
  const coachNo = parts[1]
  if (!coachNo) {
    await send(chatId, '⚠️ Coach number bhi likhein.\nExample: <code>/coach 258840</code>')
    return
  }

  const isAdmin = (user.role === 'admin') || (chatId === adminChatId())
  const depot   = isAdmin ? null : (user.depot as string)

  const r = await db.execute({
    sql: `SELECT * FROM bio_test_entries
          WHERE coach_no = ? ${depot ? 'AND UPPER(depot) = UPPER(?)' : ''}
          ORDER BY date DESC LIMIT 6`,
    args: depot ? [coachNo, depot] : [coachNo],
  })

  if (!r.rows.length) {
    await send(chatId, `🔍 Coach <b>${coachNo}</b> — koi record nahi mila.`)
    return
  }

  const last = r.rows[0]
  const dR = await db.execute({
    sql: `SELECT CAST(julianday('now') - julianday(?) AS INTEGER) as d`,
    args: [last.date as string],
  })
  const days = dR.rows[0]?.d ?? '?'
  const dNum = typeof days === 'number' ? days : parseInt(String(days))
  const statusEmoji = dNum > 90 ? '🔴' : dNum > 75 ? '🟡' : '🟢'

  let msg = `🔍 <b>Coach ${coachNo}</b>\n`
  msg += `${statusEmoji} Last test: <b>${dNum} days ago</b> (${fmtDate(last.date as string)})\n`
  msg += `━━━━━━━━━━━━━━━━\n`
  msg += `<b>History:</b>\n`
  for (const row of r.rows) {
    const re = row.result as string
    const em = re === 'PASS' ? '✅' : re === 'FAIL' ? '❌' : '⏳'
    msg += `${em} ${fmtDate(row.date as string)} | ${row.train_no} | pH:${row.ph ?? '—'} COD:${row.cod ?? '—'}\n`
  }
  await send(chatId, msg)
}

// ── Command: /due ────────────────────────────────────────────────────────────
async function handleDue(chatId: string, user: Record<string, unknown>) {
  const isAdmin = (user.role === 'admin') || (chatId === adminChatId())
  const depot   = isAdmin ? null : (user.depot as string)

  const r = await db.execute({
    sql: `SELECT coach_no, MAX(date) as last_date, depot,
                 CAST(julianday('now') - julianday(MAX(date)) AS INTEGER) as days_ago
          FROM bio_test_entries
          WHERE 1=1 ${depot ? 'AND UPPER(depot) = UPPER(?)' : ''}
          GROUP BY coach_no
          HAVING days_ago BETWEEN 75 AND 90
          ORDER BY days_ago DESC LIMIT 20`,
    args: depot ? [depot] : [],
  })

  if (!r.rows.length) {
    await send(chatId, `✅ Koi coach due nahi (75-90 days) — ${depot || 'All Depots'}`)
    return
  }

  let msg = `⏰ <b>Due Coaches (75-90 days)</b>${depot ? '' : ' — All Depots'}\n━━━━━━━━━━━━━━━━\n`
  for (const row of r.rows) {
    const depTag = !depot ? ` [${row.depot}]` : ''
    msg += `🟡 <b>${row.coach_no}</b>${depTag} — ${row.days_ago} days (${fmtDate(row.last_date as string)})\n`
  }
  await send(chatId, msg)
}

// ── Command: /overdue ────────────────────────────────────────────────────────
async function handleOverdue(chatId: string, user: Record<string, unknown>) {
  const isAdmin = (user.role === 'admin') || (chatId === adminChatId())
  const depot   = isAdmin ? null : (user.depot as string)

  const r = await db.execute({
    sql: `SELECT coach_no, MAX(date) as last_date, depot,
                 CAST(julianday('now') - julianday(MAX(date)) AS INTEGER) as days_ago
          FROM bio_test_entries
          WHERE 1=1 ${depot ? 'AND UPPER(depot) = UPPER(?)' : ''}
          GROUP BY coach_no
          HAVING days_ago > 90
          ORDER BY days_ago DESC LIMIT 20`,
    args: depot ? [depot] : [],
  })

  if (!r.rows.length) {
    await send(chatId, `✅ Koi overdue coach nahi — ${depot || 'All Depots'}`)
    return
  }

  let msg = `🔴 <b>Overdue Coaches (>90 days)</b>${depot ? '' : ' — All Depots'}\n━━━━━━━━━━━━━━━━\n`
  for (const row of r.rows) {
    const depTag = !depot ? ` [${row.depot}]` : ''
    msg += `🔴 <b>${row.coach_no}</b>${depTag} — ${row.days_ago} days\n`
  }
  await send(chatId, msg)
}

// ── Command: /pending ────────────────────────────────────────────────────────
async function handlePending(chatId: string, user: Record<string, unknown>) {
  const isAdmin = (user.role === 'admin') || (chatId === adminChatId())
  const depot   = isAdmin ? null : (user.depot as string)

  const r = await db.execute({
    sql: `SELECT coach_no, date, train_no, ph, cod, fcfc, depot
          FROM bio_test_entries
          WHERE result = 'PENDING' ${depot ? 'AND UPPER(depot) = UPPER(?)' : ''}
          ORDER BY date DESC LIMIT 20`,
    args: depot ? [depot] : [],
  })

  if (!r.rows.length) {
    await send(chatId, `✅ Koi PENDING entry nahi — ${depot || 'All Depots'}`)
    return
  }

  let msg = `⏳ <b>PENDING Entries</b>${depot ? '' : ' — All Depots'}\n━━━━━━━━━━━━━━━━\n`
  for (const row of r.rows) {
    const depTag = !depot ? ` [${row.depot}]` : ''
    msg += `⏳ <b>${row.coach_no}</b>${depTag} | ${fmtDate(row.date as string)}\n`
    msg += `   pH:${row.ph ?? '—'} COD:${row.cod ?? '—'} FCFC:${row.fcfc ?? '—'}\n`
  }
  await send(chatId, msg)
}

// ── Command: /add ────────────────────────────────────────────────────────────
async function handleAddStart(chatId: string, user: Record<string, unknown>) {
  await setSession(chatId, 'ADD_COACH', { depot: user.depot as string })
  await send(
    chatId,
    `➕ <b>Naya Test Entry</b>\n` +
    `Depot: <b>${user.depot}</b>\n\n` +
    `(<code>/cancel</code> se kisi bhi step pe cancel karein)\n\n` +
    `🔢 <b>Coach No.</b> type karein:`
  )
}

// ── Command: /users (admin only) ─────────────────────────────────────────────
async function handleUsers(chatId: string, user: Record<string, unknown>) {
  const isAdmin = (chatId === adminChatId()) || (user?.role === 'admin')
  if (!isAdmin) {
    await send(chatId, '⚠️ Sirf admin yeh command use kar sakta hai.')
    return
  }

  const r = await db.execute({
    sql: `SELECT * FROM telegram_users ORDER BY is_active DESC, depot, name`,
    args: [],
  })

  if (!r.rows.length) {
    await send(chatId, '👥 Koi registered user nahi.')
    return
  }

  let msg = `👥 <b>Registered Users</b> (${r.rows.length})\n━━━━━━━━━━━━━━━━\n`
  for (const u of r.rows) {
    const st = u.is_active ? '🟢' : '🔴'
    msg += `${st} <b>${u.name}</b> | ${u.depot} | ${u.role}\n`
    msg += `   ID: <code>${u.chat_id}</code>\n\n`
  }
  await send(chatId, msg)
}

// ── Command: /help ───────────────────────────────────────────────────────────
async function handleHelp(chatId: string, user: Record<string, unknown>) {
  const isAdmin = (chatId === adminChatId()) || (user?.role === 'admin')
  let msg =
    `📖 <b>Bio-Toilet Bot — Commands</b>\n━━━━━━━━━━━━━━━━\n\n` +
    `/coach 258840 — Coach ka status + history\n` +
    `/due — Due coaches (75-90 days)\n` +
    `/overdue — Overdue coaches (&gt;90 days)\n` +
    `/pending — PENDING result entries\n` +
    `/add — Naya test result enter karein\n` +
    `/cancel — Current operation cancel\n` +
    `/myid — Apna Telegram Chat ID dekho\n` +
    `/help — Yeh list\n`

  if (isAdmin) {
    msg += `\n🔑 <b>Admin Commands:</b>\n/users — Registered users list\n`
  }

  await send(chatId, msg)
}
