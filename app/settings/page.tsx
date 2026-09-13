'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

type UploadState = 'idle' | 'loading' | 'success' | 'error'

function ClearEntriesCard() {
  const [state, setState] = useState<UploadState>('idle')
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  async function handleClear() {
    if (!confirmed) {
      setConfirmed(true)
      setMessage('Are you sure? Click again to permanently delete ALL test entries.')
      setState('error')
      return
    }
    setState('loading')
    setMessage('')
    setConfirmed(false)
    try {
      const res = await fetch('/api/import/entries', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setState('success')
      setMessage('All test entries deleted. You can now re-import fresh data.')
    } catch (err: any) {
      setState('error')
      setMessage(err.message || 'Something went wrong.')
    }
  }

  const isSuccess = state === 'success'
  const isError = state === 'error'
  const stateColor = isSuccess ? 'var(--pass)' : isError ? '#f97316' : 'var(--text-muted)'
  const stateBg = isSuccess ? 'var(--pass-bg)' : isError ? 'rgba(249,115,22,0.1)' : 'transparent'

  return (
    <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(239,68,68,0.3)' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.25rem', color: 'var(--fail)' }}>
        {'Clear All Test Entries'}
      </h3>
      <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        {'Permanently deletes all records from the database and resets the S.No counter to 0. Use this before re-importing a corrected Excel file.'}
      </p>
      <button
        onClick={handleClear}
        disabled={state === 'loading'}
        style={{
          padding: '.45rem 1.25rem', borderRadius: '.375rem',
          background: confirmed ? 'var(--fail)' : 'transparent',
          color: confirmed ? '#fff' : 'var(--fail)',
          border: '1.5px solid var(--fail)',
          fontWeight: 700, fontSize: '.875rem',
          cursor: state === 'loading' ? 'not-allowed' : 'pointer',
          opacity: state === 'loading' ? 0.6 : 1,
          transition: 'all .15s',
        }}
      >
        {state === 'loading' ? 'Deleting...' : confirmed ? 'Yes, Delete Everything' : 'Delete All Entries'}
      </button>

      {message && (
        <div style={{
          marginTop: '.75rem', padding: '.6rem .9rem',
          borderRadius: '.375rem', fontSize: '.8rem',
          color: stateColor, background: stateBg,
          border: `1px solid ${stateColor}`,
          fontWeight: 600,
        }}>
          {isSuccess ? '✅ ' : '⚠️ '}{message}
        </div>
      )}
    </div>
  )
}

function UploadCard({
  title,
  description,
  endpoint,
  accept,
  successMsg,
}: {
  title: string
  description: string
  endpoint: string
  accept: string
  successMsg?: (data: any) => string
}) {
  const [state, setState] = useState<UploadState>('idle')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)

  async function handleUpload() {
    if (!file) return
    setState('loading')
    setMessage('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(endpoint, { method: 'POST', body: fd })
      let data: any = {}
      try {
        data = await res.json()
      } catch {
        const text = await res.text().catch(() => '')
        const hint = text.toLowerCase().includes('large') || text.toLowerCase().includes('entity')
          ? 'File too large — try a smaller file (max ~4 MB).'
          : text.toLowerCase().includes('timeout') || text.toLowerCase().includes('gateway')
          ? 'Request timed out. Try again.'
          : `Server error: ${text.slice(0, 120) || 'Unknown'}`
        throw new Error(hint)
      }
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setState('success')
      setMessage(successMsg ? successMsg(data) : 'Import complete.')
    } catch (err: any) {
      setState('error')
      setMessage(err.message || 'Something went wrong.')
    }
  }

  const isSuccess = state === 'success'
  const isError = state === 'error'
  const stateColor = isSuccess ? 'var(--pass)' : isError ? 'var(--fail)' : 'var(--text-muted)'
  const stateBg = isSuccess ? 'var(--pass-bg)' : isError ? 'var(--fail-bg)' : 'transparent'

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.25rem' }}>{title}</h3>
      <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{description}</p>

      <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: '.4rem',
          padding: '.45rem 1rem', borderRadius: '.375rem',
          border: '1.5px dashed var(--border)',
          cursor: 'pointer', fontSize: '.85rem',
          color: file ? 'var(--primary)' : 'var(--text-muted)',
          background: 'var(--bg-input)',
          fontWeight: file ? 600 : 400,
          transition: 'all .15s',
        }}>
          {'📂 '}{file ? file.name : 'Browse Excel file...'}
          <input
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={e => { setFile(e.target.files?.[0] || null); setState('idle'); setMessage('') }}
          />
        </label>

        <button
          onClick={handleUpload}
          disabled={!file || state === 'loading'}
          style={{
            padding: '.45rem 1.25rem', borderRadius: '.375rem',
            background: 'var(--primary)', color: 'var(--primary-fg)',
            border: 'none', fontWeight: 600, fontSize: '.875rem',
            cursor: (file && state !== 'loading') ? 'pointer' : 'not-allowed',
            opacity: (!file || state === 'loading') ? 0.6 : 1,
            transition: 'opacity .15s',
          }}
        >
          {state === 'loading' ? 'Importing...' : 'Upload and Import'}
        </button>
      </div>

      {message && (
        <div style={{
          marginTop: '.75rem', padding: '.6rem .9rem',
          borderRadius: '.375rem', fontSize: '.8rem',
          color: stateColor, background: stateBg,
          border: `1px solid ${stateColor}`,
          fontWeight: 600,
        }}>
          {isSuccess ? '✅ ' : '❌ '}{message}
        </div>
      )}
    </div>
  )
}

function CoachListStatus() {
  const [info, setInfo] = useState<{ total: number; last_updated: string } | null>(null)

  useEffect(() => {
    fetch('/api/import/coaches')
      .then(r => r.json())
      .then(d => setInfo(d))
      .catch(() => {})
  }, [])

  if (!info) return null
  return (
    <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.5rem' }}>
      {'Current coach list: '}
      <strong style={{ color: 'var(--text)' }}>{info.total} coaches</strong>
      {info.last_updated && (
        <>{' · Last updated: '}<strong style={{ color: 'var(--text)' }}>{info.last_updated}</strong></>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'var(--header-bg)',
        color: 'var(--header-fg)',
        borderBottom: '3px solid var(--primary)',
        padding: '0 1.5rem',
      }}>
        <div style={{
          maxWidth: '960px', margin: '0 auto',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 0', gap: '1rem', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <Link href="/" style={{
              textDecoration: 'none', color: 'var(--header-fg)',
              opacity: 0.75, fontSize: '.85rem',
              display: 'flex', alignItems: 'center', gap: '.3rem',
            }}>
              Back to Home
            </Link>
            <span style={{ opacity: 0.4 }}>{'|'}</span>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Settings</h1>
              <p style={{ fontSize: '.7rem', opacity: 0.75 }}>Data import and configuration</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main style={{
        maxWidth: '960px', margin: '0 auto',
        padding: '2rem 1.5rem',
        display: 'flex', flexDirection: 'column', gap: '1.5rem',
      }}>
        <section>
          <h2 style={{
            fontSize: '.75rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.08em',
            color: 'var(--text-muted)', marginBottom: '.75rem',
          }}>
            Import Historical Records
          </h2>
          <UploadCard
            title="Import Test Entries from Excel"
            description="Upload the Excel file containing the ASR and CIA 2026 sheet. All rows from row 4 onwards will be imported. Duplicate S.No entries are skipped automatically."
            endpoint="/api/import/entries"
            accept=".xlsx,.xls"
            successMsg={(d) => `${d.inserted} entries imported from sheet "${d.sheetUsed}". ${d.skipped} rows skipped.`}
          />
        </section>

        <section>
          <h2 style={{
            fontSize: '.75rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.08em',
            color: 'var(--text-muted)', marginBottom: '.75rem',
          }}>
            Monthly Coach List Update
          </h2>
          <UploadCard
            title="Update Coach List from Excel"
            description="Upload the current month's Excel file with the Total Coaches sheet. This completely replaces the existing coach list. Do this every month when the coach roster changes."
            endpoint="/api/import/coaches"
            accept=".xlsx,.xls"
            successMsg={(d) => `${d.inserted} coaches loaded from sheet "${d.sheetUsed}".`}
          />
          <CoachListStatus />
        </section>

        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '.5rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          fontSize: '.8rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--text)' }}>Expected column order for the test entries sheet:</strong>
          <br />
          {'A: S.No  |  B: Date  |  C: Train No  |  D: Coach No  |  E: Code  |  F: Bio Tank No  |  G: pH  |  H: COD  |  I: FCFC  |  J: Result  |  K: 2nd Test Date  |  L: 2nd Test Result'}
          <br /><br />
          <strong style={{ color: 'var(--text)' }}>Note:</strong>
          {' Result (PASS/FAIL) is read directly from the Excel Result column.'}
        </div>

        <section>
          <h2 style={{
            fontSize: '.75rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.08em',
            color: 'var(--fail)', marginBottom: '.75rem',
          }}>
            Danger Zone
          </h2>
          <ClearEntriesCard />
        </section>
      </main>
    </div>
  )
}
