'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

type UploadState = 'idle' | 'loading' | 'success' | 'error'

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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setState('success')
      setMessage(successMsg ? successMsg(data) : `Import complete.`)
    } catch (err: any) {
      setState('error')
      setMessage(err.message || 'Something went wrong.')
    }
  }

  const stateColor = state === 'success' ? 'var(--pass)' : state === 'error' ? 'var(--fail)' : 'var(--text-muted)'
  const stateBg   = state === 'success' ? 'var(--pass-bg)' : state === 'error' ? 'var(--fail-bg)' : 'transparent'

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
          📂 {file ? file.name : 'Browse Excel file…'}
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
            cursor: file && state !== 'loading' ? 'pointer' : 'not-allowed',
            opacity: !file || state === 'loading' ? .6 : 1,
            transition: 'opacity .15s',
          }}
        >
          {state === 'loading' ? '⏳ Importing…' : '⬆ Upload & Import'}
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
          {state === 'success' ? '✅ ' : '❌ '}{message}
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
      Current coach list: <strong style={{ color: 'var(--text)' }}>{info.total} coaches</strong>
      {info.last_updated && (
        <> · Last updated: <strong style={{ color: 'var(--text)' }}>{info.last_updated}</strong></>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
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
            <Link href="/" style={{ textDecoration: 'none', color: 'var(--header-fg)', opacity: .75, fontSize: '.85rem', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
              ← Home
            </Link>
            <span style={{ opacity: .4 }}>|</span>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800 }}>⚙️ Settings</h1>
              <p style={{ fontSize: '.7rem', opacity: .75 }}>Data import & configuration</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Section: Import historical data */}
        <section>
          <h2 style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
            Import Historical Records
          </h2>
          <UploadCard
            title="Import Test Entries — ASR & CIA 2026 Sheet"
            description='Upload the Excel file containing the "ASR & CIA 2026" sheet. All rows from row 4 onwards will be imported into the database. Duplicate S.No entries are skipped.'
            endpoint="/api/import/entries"
            accept=".xlsx,.xls"
            successMsg={(d) => `${d.inserted} entries imported from "${d.sheetUsed}" sheet. ${d.skipped} rows skipped.`}
          />
        </section>

        {/* Section: Monthly coach list */}
        <section>
          <h2 style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
            Monthly Coach List Update
          </h2>
          <UploadCard
            title='Update Coach List — "Total Coaches" Sheet'
            description='Upload the current month\'s Excel file with the "Total Coaches" sheet. This completely replaces the existing coach list. Use this every month when the coach roster changes.'
            endpoint="/api/import/coaches"
            accept=".xlsx,.xls"
            successMsg={(d) => `${d.inserted} coaches loaded from "${d.sheetUsed}" sheet.`}
          />
          <CoachListStatus />
        </section>

        {/* Info box */}
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '.5rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          fontSize: '.8rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--text)' }}>Expected Excel column order (ASR & CIA 2026 sheet):</strong>
          <br />
          A: S.No &nbsp;·&nbsp; B: Date &nbsp;·&nbsp; C: Train No &nbsp;·&nbsp; D: Coach No &nbsp;·&nbsp;
          E: Code &nbsp;·&nbsp; F: Bio Tank No &nbsp;·&nbsp; G: pH &nbsp;·&nbsp; H: COD &nbsp;·&nbsp;
          I: FCFC &nbsp;·&nbsp; J: Result &nbsp;·&nbsp; K: 2nd Test Date &nbsp;·&nbsp; L: 2nd Test Result
          <br /><br />
          <strong style={{ color: 'var(--text)' }}>Note:</strong> Result (PASS/FAIL) is auto-calculated from pH, COD, and FCFC values — the J column value from Excel is ignored and recalculated fresh.
        </div>
      </main>
    </div>
  )
}
