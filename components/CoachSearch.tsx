'use client'
import { useState, useRef } from 'react'

type SearchResult = {
  coachNo: string
  status: 'OVERDUE' | 'PENDING' | 'TESTED' | 'NOT_IN_LIST'
  master: { train_no: string; code: string; depot: string; status: string } | null
  lastTest: {
    s_no: number
    date: string
    train_no: string
    code: string
    result: string
    second_test_date: string | null
    second_test_result: string | null
    days_ago: number
  } | null
  overdue: {
    s_no: number
    date: string
    due_date: string
    days_overdue: number
  } | null
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const p = iso.split('-')
  if (p.length === 3 && p[0].length === 4) return `${p[2]}-${p[1]}-${p[0]}`
  return iso
}

const STATUS_CONFIG = {
  OVERDUE:     { color: 'var(--fail)',    bg: 'var(--fail-bg)',    icon: '🚨', label: 'OVERDUE'      },
  PENDING:     { color: 'var(--pending)', bg: 'var(--pending-bg)', icon: '⚠️', label: 'PENDING'      },
  TESTED:      { color: 'var(--pass)',    bg: 'var(--pass-bg)',    icon: '✅', label: 'TESTED'       },
  NOT_IN_LIST: { color: 'var(--text-muted)', bg: 'var(--bg)', icon: '❓', label: 'NOT IN MASTER LIST' },
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: '.75rem', alignItems: 'baseline', padding: '.3rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', minWidth: '110px', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: '.875rem', color: 'var(--text)', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  )
}

export default function CoachSearch() {
  const [query, setQuery]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function doSearch(val?: string) {
    const coachNo = (val ?? query).trim().toUpperCase()
    if (!coachNo) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`/api/coach-search?coach_no=${encodeURIComponent(coachNo)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') doSearch()
  }

  function clear() {
    setQuery('')
    setResult(null)
    setError('')
    inputRef.current?.focus()
  }

  const cfg = result ? STATUS_CONFIG[result.status] : null

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Search bar */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.25rem' }}>🔍 Coach Lookup</h2>
        <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Enter a Coach No. to check its re-sampling status, last test details, and master list info.
        </p>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
          <input
            ref={inputRef}
            type="text"
            className="input-field"
            placeholder="e.g. 153141"
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={handleKey}
            style={{ flex: '1', minWidth: '180px', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700 }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            onClick={() => doSearch()}
            disabled={!query.trim() || loading}
            style={{
              padding: '.5rem 1.5rem', borderRadius: '.375rem',
              background: 'var(--primary)', color: 'var(--primary-fg)',
              border: 'none', fontWeight: 700, fontSize: '.9rem',
              cursor: (!query.trim() || loading) ? 'not-allowed' : 'pointer',
              opacity: (!query.trim() || loading) ? 0.6 : 1,
            }}
          >
            {loading ? '⏳ Searching...' : 'Search'}
          </button>
          {result && (
            <button
              onClick={clear}
              className="btn-ghost"
              style={{ fontSize: '.85rem' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginTop: '.75rem', padding: '.75rem 1rem', borderRadius: '.5rem', background: 'var(--fail-bg)', color: 'var(--fail)', fontWeight: 600, fontSize: '.85rem' }}>
          {'❌ '}{error}
        </div>
      )}

      {/* Result */}
      {result && cfg && (
        <div className="card" style={{ marginTop: '1rem', overflow: 'hidden', border: `2px solid ${cfg.color}` }}>
          {/* Status Header */}
          <div style={{ background: cfg.bg, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>{cfg.icon}</span>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '.04em' }}>
                  {result.coachNo}
                </div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Coach Number
                </div>
              </div>
            </div>
            <div style={{
              background: cfg.color, color: '#fff',
              padding: '.4rem 1rem', borderRadius: '999px',
              fontWeight: 800, fontSize: '.875rem', letterSpacing: '.06em',
            }}>
              {cfg.label}
            </div>
          </div>

          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* OVERDUE alert box */}
            {result.overdue && (
              <div style={{ background: 'var(--fail-bg)', border: '1.5px solid var(--fail)', borderRadius: '.5rem', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--fail)', marginBottom: '.5rem', fontSize: '.85rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  🚨 Re-sampling Overdue
                </div>
                <InfoRow label="FAIL Test Date" value={fmtDate(result.overdue.date)} />
                <InfoRow label="Due Date"        value={fmtDate(result.overdue.due_date)} />
                <InfoRow label="Days Overdue"    value={`${result.overdue.days_overdue} days past due`} />
                <InfoRow label="Entry S.No"      value={`#${result.overdue.s_no}`} />
              </div>
            )}

            {/* PENDING info */}
            {result.status === 'PENDING' && !result.overdue && (
              <div style={{ background: 'var(--pending-bg)', border: '1.5px solid var(--pending)', borderRadius: '.5rem', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--pending)', marginBottom: '.5rem', fontSize: '.85rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  ⚠️ Testing Pending
                </div>
                {result.lastTest ? (
                  <InfoRow label="Days Since Test" value={`${result.lastTest.days_ago} days ago (limit: 90 days)`} />
                ) : (
                  <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                    This coach has no test record in ASR &amp; CIA 2026 data.
                  </div>
                )}
              </div>
            )}

            {/* Master list info */}
            {result.master ? (
              <div>
                <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem' }}>
                  Master Coach List
                </div>
                <InfoRow label="Train No"   value={result.master.train_no} />
                <InfoRow label="Coach Type" value={result.master.code} />
                <InfoRow label="Railway / Depot" value={result.master.depot} />
                <InfoRow label="Status"     value={result.master.status} />
              </div>
            ) : (
              <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', padding: '.5rem 0' }}>
                ❓ Coach not found in Total Coaches master list. Upload the latest coach list in Settings.
              </div>
            )}

            {/* Last test details */}
            {result.lastTest && (
              <div>
                <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem' }}>
                  Last Test Record
                </div>
                <InfoRow label="S.No"         value={`#${result.lastTest.s_no}`} />
                <InfoRow label="Test Date"    value={fmtDate(result.lastTest.date)} />
                <InfoRow label="Train No"     value={result.lastTest.train_no} />
                <InfoRow label="Coach Code"   value={result.lastTest.code} />
                <InfoRow label="Result"       value={result.lastTest.result} />
                <InfoRow label="2nd Test"     value={fmtDate(result.lastTest.second_test_date)} />
                <InfoRow label="2nd Result"   value={result.lastTest.second_test_result ?? undefined} />
                <InfoRow label="Days Ago"     value={`${result.lastTest.days_ago} days ago`} />
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
