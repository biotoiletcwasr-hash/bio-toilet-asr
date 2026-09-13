'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        router.push(from)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Login failed')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* App logo + title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '68px', height: '68px',
            background: 'var(--primary)',
            borderRadius: '1.1rem',
            display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '2.2rem', marginBottom: '1rem',
            boxShadow: '0 6px 18px rgba(26,86,219,.28)',
          }}>🚽</div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', marginBottom: '.3rem' }}>
            Bio-Toilet Test System
          </h1>
          <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
            ASR &amp; CIA Division · 2026
          </p>
        </div>

        {/* Login card */}
        <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

            <div>
              <label style={{
                fontSize: '.8rem', fontWeight: 600,
                color: 'var(--text)', display: 'block', marginBottom: '.4rem',
              }}>
                Username
              </label>
              <input
                type="text"
                className="input-field"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>

            <div>
              <label style={{
                fontSize: '.8rem', fontWeight: 600,
                color: 'var(--text)', display: 'block', marginBottom: '.4rem',
              }}>
                Password
              </label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div style={{
                padding: '.6rem .9rem', borderRadius: '.375rem',
                background: 'var(--fail-bg)', color: 'var(--fail)',
                fontSize: '.8rem', fontWeight: 600,
                border: '1px solid var(--fail)',
              }}>
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{
                width: '100%', padding: '.75rem',
                fontSize: '.95rem', marginTop: '.25rem',
                opacity: loading ? .7 : 1,
              }}
            >
              {loading ? '⏳ Logging in…' : '🔐 Login'}
            </button>
          </form>

          {/* Forgot password */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setShowForgot(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--primary)', fontSize: '.8rem',
                textDecoration: 'underline', padding: 0,
              }}
            >
              Forgot Password?
            </button>

            {showForgot && (
              <div style={{
                marginTop: '.75rem', padding: '.9rem 1rem',
                background: 'var(--bg-input)', borderRadius: '.5rem',
                fontSize: '.8rem', color: 'var(--text-muted)',
                textAlign: 'left', border: '1px solid var(--border)',
                lineHeight: 1.6,
              }}>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '.35rem' }}>
                  🔑 Default Credentials
                </strong>
                Username: <code style={{ color: 'var(--primary)', fontWeight: 700 }}>admin</code><br />
                Password: <code style={{ color: 'var(--primary)', fontWeight: 700 }}>admin</code>
                <div style={{ marginTop: '.5rem', paddingTop: '.5rem', borderTop: '1px solid var(--border)' }}>
                  If the password has been changed, contact your system administrator.
                  Password can be reset from Settings → Change Password.
                </div>
              </div>
            )}
          </div>
        </div>

        <p style={{
          textAlign: 'center', marginTop: '1.5rem',
          fontSize: '.72rem', color: 'var(--text-muted)',
        }}>
          © 2026 ASR &amp; CIA · Bio-Toilet Effluent Testing System
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />
    }>
      <LoginForm />
    </Suspense>
  )
}
