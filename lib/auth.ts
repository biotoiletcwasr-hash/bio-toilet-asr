export const SESSION_COOKIE = 'bio_session'
export const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const getSecret = () =>
  process.env.SESSION_SECRET || 'bio-toilet-asr-cia-2026-internal-key'

export async function sha256hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(salt: string, password: string): Promise<string> {
  return sha256hex(salt + ':' + password)
}

export async function createSessionToken(): Promise<string> {
  const ts = Date.now().toString()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ts))
  const sigHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `${ts}.${sigHex}`
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const dotIdx = token.indexOf('.')
    if (dotIdx === -1) return false
    const ts = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    if (!ts || !sig) return false
    if (Date.now() - parseInt(ts) > SESSION_EXPIRY_MS) return false
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(getSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const sigBytes = new Uint8Array(
      sig.match(/.{2}/g)!.map(b => parseInt(b, 16)),
    )
    return await crypto.subtle.verify(
      'HMAC', key, sigBytes, new TextEncoder().encode(ts),
    )
  } catch {
    return false
  }
}
