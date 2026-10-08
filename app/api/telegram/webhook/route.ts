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
    await send(chatId, '❌ Operation cancelled.\n\n/help — list of commands')
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

  // Depot commands work for unregistered users too
  if (text === '/ASR' || text === '/asr') return handleDepotJoin(chatId, user, 'ASR', firstName)
  if (text === '/FZR' || text === '/fzr') return handleDepotJoin(chatId, user, 'FZR', firstName)
  if (text === '/JUC' || text === '/juc') return handleDepotJoin(chatId, user, 'JUC', firstName)

  // Not registered
  if (!user) {
    await send(chatId, '⚠️ You are not registered.\n\nType /ASR, /FZR, or /JUC to register.')
    return
  }

  // Pending approval
  if (!user.is_active) {
    await send(chatId, '⏳ Your registration is pending admin approval.')
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
  } else if (text === '/edit' || text.startsWith('/edit ')) {
    await handleEditStart(chatId, user, text)
  } else if (text === '/help') {
    await handleHelp(chatId, user)
  } else {
    await send(chatId, '❓ Unknown command.\n\n/help — list of commands')
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
      `✅ You are already registered!\n\n` +
      `👤 <b>${existingUser.name}</b> | ${existingUser.depot} | ${existingUser.role}\n\n` +
      `/help — list of commands`
    )
    return
  }

  // ── QR code depot-join (permanent, reusable) ──
  const qrDepotMap: Record<string, string> = {
    'join-ASR': 'ASR',
    'join-FZR': 'FZR',
    'join-JUC': 'JUC',
  }
  if (startParam && qrDepotMap[startParam]) {
    const depot = qrDepotMap[startParam]
    // Ask for name, remember depot in session
    await setSession(chatId, 'QR_NAME', { depot, firstName })
    await send(
      chatId,
      `📱 <b>Bio-Toilet Test System — ${depot}</b>\n\n` +
      `Please type your <b>full name</b> to register:`
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
        `You can now use the bot.\n/help — list of commands`
      )
      const admin = adminChatId()
      if (admin && admin !== chatId) {
        await send(admin, `✅ <b>${td.name}</b> (${td.depot}) connected via app link! 📱`)
      }
      return
    } else {
      await send(chatId,
        `❌ This link has expired or has already been used.\n\nPlease ask the admin for a new link.`
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
    `🙏 <b>Bio-Toilet Test System</b>!\n\n` +
    `Please type your <b>full name</b> to register:`
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
    case 'QR_NAME': {
      // Staff scanned QR code — they typed their name
      const name = text.trim()
      if (!name || name.length < 2) {
        await send(chatId, '❌ Please enter a valid name (at least 2 characters).')
        return
      }
      const depot = data.depot || 'ASR'
      await db.execute({
        sql: `INSERT OR REPLACE INTO telegram_users (chat_id, name, depot, role, is_active)
              VALUES (?, ?, ?, 'staff', 1)`,
        args: [chatId, name, depot],
      })
      await clearSession(chatId)
      await send(
        chatId,
        `🎉 <b>Connected!</b>\n\n` +
        `👤 <b>${name}</b> | ${depot} | Staff\n\n` +
        `You can now use the bot.\n/help — list of commands`
      )
      const admin = adminChatId()
      if (admin && admin !== chatId) {
        await send(admin, `✅ <b>${name}</b> (${depot}) connected via QR scan! 📱`)
      }
      return
    }

    case 'REG_NAME': {
      if (!text || text.startsWith('/') || text.length < 2) {
        await send(chatId, '⚠️ Valid naam likhein (kam se kam 2 characters):')
        return
      }
      await setSession(chatId, 'REG_DEPOT', { ...data, name: text })
      await send(chatId, `✅ Naam: <b>${text}</b>\n\nPlease select your depot:`, {
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
          await send(chatId, '⚠️ Enter a valid FCFC value or /skip:')
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
        `📋 <b>Confirm Entry:</b>\n\n` +
        `Coach: <b>${data.coach_no}</b>\n` +
        `Date:  <b>${fmtDate(data.date)}</b>\n` +
        `Train: <b>${data.train_no}</b>\n` +
        `Tank:  <b>${data.bio_tank_no || '—'}</b>\n` +
        `pH:    <b>${data.ph}</b>\n` +
        `COD:   <b>${data.cod}</b>\n` +
        `FCFC:  <b>${fcfcVal || '—'}</b>\n` +
        `Result:${rEmoji} <b>${result}</b>\n` +
        `Depot: <b>${depot}</b>\n\n` +
        `Save this entry?`

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

    case 'EDIT_COACH': {
      if (!user?.is_active) {
        await send(chatId, '❌ Please register first using /start.')
        await clearSession(chatId)
        return
      }
      // If user is picking a specific S.No from multiple results
      if (data.pickingFromCoach) {
        const sno = parseInt(text.replace('#', '').trim())
        if (isNaN(sno) || sno <= 0) {
          await send(chatId, '❌ Enter a valid S.No number.')
          return
        }
        await showEntryForEdit(chatId, user, sno)
      } else {
        await findEntryByCoach(chatId, user, text.trim())
      }
      return
    }

    case 'EDIT_VALUE': {
      const { sno: snoStr, field } = data
      let value: string | number = text.trim()
      let dbField = ''
      const fieldLabels: Record<string, string> = {
        date: 'Date', train: 'Train No', tank: 'Tank No', ph: 'pH', cod: 'COD', fcfc: 'FCFC'
      }
      switch (field) {
        case 'date': {
          const normalized = normalizeDate(value as string)
          if (!normalized) { await send(chatId, '❌ Invalid date. Use DD-MM-YYYY.'); return }
          value = normalized; dbField = 'test_date'; break
        }
        case 'train': { dbField = 'train_no'; break }
        case 'tank':  { dbField = 'tank_no'; break }
        case 'ph': {
          value = parseFloat(value as string)
          if (isNaN(value as number)) { await send(chatId, '❌ Enter a valid pH value (e.g. 7.2)'); return }
          dbField = 'ph'; break
        }
        case 'cod': {
          value = parseFloat(value as string)
          if (isNaN(value as number)) { await send(chatId, '❌ Enter a valid COD value'); return }
          dbField = 'cod'; break
        }
        case 'fcfc': {
          value = parseFloat(value as string)
          if (isNaN(value as number)) { await send(chatId, '❌ Enter a valid FCFC value'); return }
          dbField = 'fcfc'; break
        }
        default: { await send(chatId, '❌ Invalid field.'); await clearSession(chatId); return }
      }
      const entryR = await db.execute({ sql: `SELECT ph, cod, fcfc FROM entries WHERE sno = ?`, args: [parseInt(snoStr)] })
      const ent = entryR.rows[0]
      const newPh   = field === 'ph'   ? (value as number) : (ent?.ph   as number | null)
      const newCod  = field === 'cod'  ? (value as number) : (ent?.cod  as number | null)
      const newFcfc = field === 'fcfc' ? (value as number) : (ent?.fcfc as number | null)
      const newResult = calculateResult(newPh, newCod, newFcfc)
      await db.execute({
        sql: `UPDATE entries SET ${dbField} = ?, result = ? WHERE sno = ?`,
        args: [value, newResult, snoStr],
      })
      await clearSession(chatId)
      await send(chatId,
        `✅ <b>Entry #${snoStr} updated!</b>\n\n` +
        `${fieldLabels[field] || field}: <b>${field === 'date' ? fmtDate(value as string) : value}</b>\n` +
        `Result: <b>${newResult}</b>`
      )
      return
    }

    default:
      await clearSession(chatId)
      await send(chatId, '❓ Something went wrong. Type /help to try again.')
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
      `You can now use the bot.\n\n` +
      `/help — list of commands`
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
  if (data.startsWith('edit_f:')) {
    const parts2 = data.split(':')
    const sno2 = parts2[1]
    const field2 = parts2[2]
    const fieldLabels2: Record<string, string> = {
      date: 'Date (DD-MM-YYYY)', train: 'Train Number', tank: 'Tank Number',
      ph: 'pH value', cod: 'COD value', fcfc: 'FCFC value'
    }
    await setSession(callerId, 'EDIT_VALUE', { sno: sno2, field: field2 })
    await send(callerId, `✏️ Entry #${sno2} — <b>${fieldLabels2[field2] || field2}</b>\n\nEnter the new value:`)
    return
  }

  if (data === 'cancel_edit') {
    await clearSession(callerId)
    await send(callerId, '❌ Edit cancelled.')
    return
  }

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
    await send(chatId, '⚠️ This command is for admin only.')
    return
  }

  const r = await db.execute({
    sql: `SELECT * FROM telegram_users ORDER BY is_active DESC, depot, name`,
    args: [],
  })

  if (!r.rows.length) {
    await send(chatId, '👥 No registered users found.')
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
    `📋 <b>Test Entries</b>\n` +
    `/add — Add new test result\n` +
    `/edit — Edit an existing entry\n` +
    `/pending — Entries with PENDING result\n\n` +
    `🔍 <b>Coach Status</b>\n` +
    `/coach 258840 — Coach status + history\n` +
    `/due — Coaches due in next 15 days\n` +
    `/overdue — Overdue coaches (&gt;90 days)\n\n` +
    `🏭 <b>Depot Summary</b>\n` +
    `/ASR — Amritsar depot summary\n` +
    `/FZR — Firozpur depot summary\n` +
    `/JUC — Jalandhar depot summary\n\n` +
    `⚙️ <b>Utility</b>\n` +
    `/cancel — Cancel current operation\n` +
    `/myid — Your Telegram Chat ID\n` +
    `/help — This list\n`

  if (isAdmin) {
    msg += `\n🔑 <b>Admin Commands:</b>\n/users — List of registered users\n`
  }

  await send(chatId, msg)
}

// ── Depot join via /ASR /FZR /JUC ───────────────────────────────────────────
async function handleDepotJoin(chatId: string, user: Record<string, unknown> | null, depot: string, firstName: string) {
  // Registered users — show depot summary
  if (user?.is_active) {
    await showDepotSummary(chatId, depot)
    return
  }
  // Unregistered — start registration
  await setSession(chatId, 'QR_NAME', { depot, firstName })
  await send(chatId,
    `📍 <b>${depot} Depot</b> selected!\n\n` +
    `Please type your <b>full name</b>:`
  )
}

// ── Depot summary (/ASR /FZR /JUC for registered users) ─────────────────────
async function showDepotSummary(chatId: string, depot: string) {
  const [totalR, pendingR, overdueR, dueR] = await Promise.all([
    db.execute({ sql: `SELECT COUNT(*) as cnt FROM entries WHERE depot = ?`, args: [depot] }),
    db.execute({ sql: `SELECT COUNT(*) as cnt FROM entries WHERE depot = ? AND result = 'PENDING'`, args: [depot] }),
    db.execute({
      sql: `SELECT COUNT(*) as cnt FROM coaches c
            WHERE c.depot = ?
            AND (SELECT MAX(test_date) FROM entries e WHERE e.coach_no = c.coach_no) < date('now','-90 days')`,
      args: [depot],
    }),
    db.execute({
      sql: `SELECT COUNT(*) as cnt FROM coaches c
            WHERE c.depot = ?
            AND (SELECT MAX(test_date) FROM entries e WHERE e.coach_no = c.coach_no) BETWEEN date('now','-90 days') AND date('now','-75 days')`,
      args: [depot],
    }),
  ])

  const total   = totalR.rows[0]?.cnt   ?? 0
  const pending = pendingR.rows[0]?.cnt ?? 0
  const overdue = overdueR.rows[0]?.cnt ?? 0
  const due     = dueR.rows[0]?.cnt     ?? 0

  await send(chatId,
    `🏭 <b>${depot} Depot — Summary</b>\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `📊 Total entries:  <b>${total}</b>\n` +
    `⏳ Pending results: <b>${pending}</b>\n` +
    `📅 Due soon (75-90 days): <b>${due}</b>\n` +
    `⚠️ Overdue (&gt;90 days): <b>${overdue}</b>\n\n` +
    `/due — See due list\n` +
    `/overdue — See overdue list\n` +
    `/pending — See pending entries`
  )
}

// ── /edit entry ──────────────────────────────────────────────────────────────
async function handleEditStart(chatId: string, user: Record<string, unknown> | null, text: string) {
  if (!user?.is_active) { await send(chatId, '❌ Please register first using /start.'); return }
  const parts = text.split(' ')
  const coachArg = parts[1]?.trim()
  if (coachArg) {
    await findEntryByCoach(chatId, user, coachArg)
  } else {
    await setSession(chatId, 'EDIT_COACH', {})
    await send(chatId, '✏️ <b>Edit Entry</b>\n\nEnter the <b>coach number</b> to search:')
  }
}

async function findEntryByCoach(chatId: string, user: Record<string, unknown>, coachNo: string) {
  const isAdmin = (user?.role ?? '') === 'admin'
  const r = await db.execute({
    sql: isAdmin
      ? `SELECT * FROM entries WHERE coach_no = ? ORDER BY test_date DESC LIMIT 5`
      : `SELECT * FROM entries WHERE coach_no = ? AND depot = ? ORDER BY test_date DESC LIMIT 5`,
    args: isAdmin ? [coachNo] : [coachNo, String(user.depot ?? '')],
  })
  if (!r.rows[0]) {
    await send(chatId, `❌ No entries found for coach <b>${coachNo}</b>.\n\nCheck the coach number and try again.`)
    await clearSession(chatId)
    return
  }
  if (r.rows.length === 1) {
    await showEntryForEdit(chatId, user, r.rows[0].sno as number)
    return
  }
  // Multiple entries — let user pick
  const list = r.rows.map(row =>
    `#${row.sno} — ${fmtDate(row.test_date as string)} | Result: ${row.result}`
  ).join('\n')
  await setSession(chatId, 'EDIT_COACH', { pickingFromCoach: coachNo })
  await send(chatId,
    `🔍 Found ${r.rows.length} entries for coach <b>${coachNo}</b>:\n\n${list}\n\n` +
    `Reply with the <b>S.No</b> (#) of the entry to edit:`
  )
}

async function showEntryForEdit(chatId: string, user: Record<string, unknown>, sno: number | string) {
  const snoNum = typeof sno === 'string' ? parseInt(sno) : sno
  const isAdmin = (user?.role ?? '') === 'admin'
  const r = await db.execute({
    sql: isAdmin
      ? `SELECT * FROM entries WHERE sno = ?`
      : `SELECT * FROM entries WHERE sno = ? AND depot = ?`,
    args: isAdmin ? [snoNum] : [snoNum, String(user.depot ?? '')],
  })
  if (!r.rows[0]) {
    await send(chatId, `❌ Entry #${snoNum} not found.` + (!isAdmin ? '\n(You can only edit entries from your own depot.)' : ''))
    await clearSession(chatId)
    return
  }
  const e = r.rows[0]
  await setSession(chatId, 'EDIT_FIELD', { sno: String(snoNum) })
  await tg('sendMessage', {
    chat_id: chatId,
    text:
      `✏️ <b>Entry #${e.sno}</b>\n\n` +
      `📅 Date: <b>${fmtDate(e.test_date as string)}</b>\n` +
      `🚂 Train: <b>${e.train_no || '—'}</b>\n` +
      `🚃 Coach: <b>${e.coach_no}</b>\n` +
      `🪣 Tank: <b>${e.tank_no || '—'}</b>\n` +
      `⚗️ pH: <b>${e.ph ?? '—'}</b>\n` +
      `💧 COD: <b>${e.cod ?? '—'}</b>\n` +
      `🧫 FCFC: <b>${e.fcfc ?? '—'}</b>\n` +
      `📊 Result: <b>${e.result}</b>\n\n` +
      `What would you like to edit?`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📅 Date',  callback_data: `edit_f:${sno}:date` },
          { text: '🚂 Train', callback_data: `edit_f:${sno}:train` },
        ],
        [
          { text: '🪣 Tank',  callback_data: `edit_f:${sno}:tank` },
          { text: '⚗️ pH',   callback_data: `edit_f:${sno}:ph` },
        ],
        [
          { text: '💧 COD',  callback_data: `edit_f:${sno}:cod` },
          { text: '🧫 FCFC', callback_data: `edit_f:${sno}:fcfc` },
        ],
        [{ text: '❌ Cancel', callback_data: 'cancel_edit' }],
      ],
    },
  })
}

