'use client'
import { useState, useRef } from 'react'

type Remark = {
  id: number
  remark_date: string
  location_status: string
  remark: string
  created_at: string
}

type HistoryEntry = {
  s_no: number
  date: string
  train_no: string
  result: string
  second_test_date: string | null
  second_test_result: string | null
  days_ago: number
}

type SearchResult = {
  coachNo: string
  status: 'OVERDUE' | 'PENDING' | 'TESTED' | 'NOT_IN_LIST'
  master: { train_no: string; code: string; depot: string; status: string } | null
  lastTest: {
    s_no: number; date: string; train_no: string; code: string; result: string
    second_test_date: string | null; second_test_result: string | null; days_ago: number
  } | null
  overdue: {
    s_no: number; date: string; due_date: string; days_overdue: number
  } | null
  history: HistoryEntry[]
  remarks: Remark[]
}

const LOCATION_OPTIONS = [
  '', 'In Yard', 'On Terminal Train', 'In Workshop',
  'Scheduled for Resampling', 'Not Located', 'Other'
]

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const p = iso.split('-')
  if (p.length === 3 && p[0].length === 4) return `${p[2]}-${p[1]}-${p[0]}`
  return iso
}

const STATUS_CONFIG = {
  OVERDUE:     { color: 'var(--fail)',    bg: 'var(--fail-bg)',    icon: '🚨', label: 'OVERDUE — Re-sample Immediately'  },
  PENDING:     { color: 'var(--pending)', bg: 'var(--pending-bg)', icon: '⚠️', label: 'PENDING'     },
  TESTED:      { color: 'var(--pass)',    bg: 'var(--pass-bg)',    icon: '✅', label: 'TESTED'      },
  NOT_IN_LIST: { color: 'var(--text-muted)', bg: 'var(--bg)', icon: '❓', label: 'NOT IN MASTER LIST' },
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: '.75rem', alignItems: 'baseline', padding: '.3rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', minWidth: '120px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '.875rem', color: 'var(--text)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function ResultPill({ result }: { result: string }) {
  const c = result === 'PASS' ? 'var(--pass)' : result === 'FAIL' ? 'var(--fail)' : 'var(--pending)'
  return (
    <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#fff', background: c, padding: '.1rem .45rem', borderRadius: '999px' }}>
      {result === 'PASS' ? '✅ PASS' : result === 'FAIL' ? '❌ FAIL' : '⏳ ' + result}
    </span>
  )
}

// ── Resampling Remarks section ────────────────────────────────
function ResamplingSection({ coachNo, trainNo, initialRemarks }: {
  coachNo: string
  trainNo: string
  initialRemarks: Remark[]
}) {
  const [remarks, setRemarks]   = useState<Remark[]>(initialRemarks)
  const [adding, setAdding]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [form, setForm]         = useState({
    remark_date:     new Date().toISOString().split('T')[0],
    location_status: '',
    remark:          '',
  })

  async function handleAdd() {
    if (!form.remark_date) return
    setSaving(true)
    try {
      const res = await fetch('/api/resampling-remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach_no: coachNo, train_no: trainNo, ...form }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRemarks(prev => [data.remark, ...prev])
      setForm(f => ({ ...f, location_status: '', remark: '' }))
      setAdding(false)
    } catch {
      alert('Remark save nahi hua.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this remark?')) return
    setDeleting(id)
    try {
      await fetch(`/api/resampling-remarks/${id}`, { method: 'DELETE' })
      setRemarks(prev => prev.filter(r => r.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div style={{ border: '1.5px solid var(--primary)', borderRadius: '.5rem', overflow: 'hidden' }}>
      {/* Section header */}
      <div style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '.65rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          📋 Resampling Tracking — {remarks.length} Remark{remarks.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setAdding(a => !a)}
          style={{ fontSize: '.75rem', fontWeight: 700, padding: '.25rem .65rem', borderRadius: '.375rem', background: adding ? 'transparent' : 'var(--primary)', color: adding ? 'var(--text-muted)' : '#fff', border: adding ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
        >
          {adding ? '✕ Cancel' : '+ Add Remark'}
        </button>
      </div>

      <div style={{ padding: '.875rem' }}>
        {/* Add form */}
        {adding && (
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '.5rem', padding: '.875rem', marginBottom: '.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '.65rem', marginBottom: '.65rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '.65rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.25rem', textTransform: 'uppercase' }}>Date</label>
                <input type="date" className="input-field" style={{ fontSize: '.8rem' }}
                  value={form.remark_date}
                  onChange={e => setForm(f => ({ ...f, remark_date: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.65rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.25rem', textTransform: 'uppercase' }}>Location / Status</label>
                <select className="input-field" style={{ fontSize: '.8rem' }}
                  value={form.location_status}
                  onChange={e => setForm(f => ({ ...f, location_status: e.target.value }))}
                >
                  {LOCATION_OPTIONS.map(o => <option key={o} value={o}>{o || '-- Select --'}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '.65rem' }}>
              <label style={{ display: 'block', fontSize: '.65rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.25rem', textTransform: 'uppercase' }}>Remark</label>
              <input type="text" className="input-field" style={{ fontSize: '.8rem', width: '100%' }}
                placeholder="e.g. Coach found in yard, resampling done tomorrow"
                value={form.remark}
                onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              />
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button onClick={handleAdd} disabled={saving || !form.remark_date}
                style={{ padding: '.35rem .9rem', borderRadius: '.375rem', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', opacity: saving ? .7 : 1 }}>
                {saving ? '⏳...' : '💾 Save'}
              </button>
            </div>
          </div>
        )}

        {/* Remarks list */}
        {remarks.length === 0 ? (
          <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '.5rem 0' }}>
            No remarks yet — click "+ Add Remark" to log today's status.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            {remarks.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.5rem', padding: '.45rem .65rem', borderRadius: '.375rem', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{fmtDate(r.remark_date)}</span>
                    {r.location_status && (
                      <span style={{ fontSize: '.7rem', fontWeight: 600, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)', padding: '.1rem .4rem', borderRadius: '.25rem' }}>
                        📍 {r.location_status}
                      </span>
                    )}
                  </div>
                  {r.remark && <p style={{ fontSize: '.78rem', color: 'var(--text)', marginTop: '.25rem', lineHeight: 1.5 }}>{r.remark}</p>}
                </div>
                <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fail)', fontSize: '.8rem', padding: '.1rem .3rem', opacity: deleting === r.id ? .5 : .6, flexShrink: 0 }}>
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main CoachSearch ──────────────────────────────────────────
export default function CoachSearch() {
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<SearchResult | null>(null)
  const [error, setError]     = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function doSearch(val?: string) {
    const coachNo = (val ?? query).trim().toUpperCase()
    if (!coachNo) return
    setLoading(true); setError(''); setResult(null); setShowHistory(false)
    try {
      const res  = await fetch(`/api/coach-search?coach_no=${encodeURIComponent(coachNo)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setQuery(''); setResult(null); setError(''); setShowHistory(false)
    inputRef.current?.focus()
  }

  const cfg = result ? STATUS_CONFIG[result.status] : null

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Search bar */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.25rem' }}>🔍 Search Coach Status</h2>
        <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Coach No. search karo — due status, master list, test history, aur resampling remarks ek saath.
        </p>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
          <input
            ref={inputRef} type="text" className="input-field"
            placeholder="e.g. 153141"
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
            style={{ flex: '1', minWidth: '180px', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700 }}
            autoComplete="off" autoCorrect="off" spellCheck={false}
          />
          <button
            onClick={() => doSearch()}
            disabled={!query.trim() || loading}
            style={{ padding: '.5rem 1.5rem', borderRadius: '.375rem', background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none', fontWeight: 700, fontSize: '.9rem', cursor: (!query.trim() || loading) ? 'not-allowed' : 'pointer', opacity: (!query.trim() || loading) ? 0.6 : 1 }}
          >
            {loading ? '⏳ Searching...' : 'Search'}
          </button>
          {result && <button onClick={clear} className="btn-ghost" style={{ fontSize: '.85rem' }}>Clear</button>}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: '.75rem', padding: '.75rem 1rem', borderRadius: '.5rem', background: 'var(--fail-bg)', color: 'var(--fail)', fontWeight: 600, fontSize: '.85rem' }}>
          ❌ {error}
        </div>
      )}

      {result && cfg && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>

          {/* Status card */}
          <div className="card" style={{ overflow: 'hidden', border: `2px solid ${cfg.color}` }}>
            {/* Status Header */}
            <div style={{ background: cfg.bg, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                <span style={{ fontSize: '1.4rem' }}>{cfg.icon}</span>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '.04em' }}>{result.coachNo}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>Coach Number</div>
                </div>
              </div>
              <div style={{ background: cfg.color, color: '#fff', padding: '.4rem 1rem', borderRadius: '999px', fontWeight: 800, fontSize: '.875rem', letterSpacing: '.06em' }}>
                {cfg.label}
              </div>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* OVERDUE box */}
              {result.overdue && (
                <div style={{ background: 'var(--fail-bg)', border: '1.5px solid var(--fail)', borderRadius: '.5rem', padding: '1rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--fail)', marginBottom: '.5rem', fontSize: '.85rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>🚨 Re-sampling Overdue</div>
                  <InfoRow label="FAIL Test Date"  value={fmtDate(result.overdue.date)} />
                  <InfoRow label="Due Date"         value={fmtDate(result.overdue.due_date)} />
                  <InfoRow label="Days Overdue"     value={`${result.overdue.days_overdue} days past due`} />
                  <InfoRow label="Entry S.No"       value={`#${result.overdue.s_no}`} />
                </div>
              )}

              {/* PENDING + no overdue */}
              {result.status === 'PENDING' && !result.overdue && (
                <div style={{ background: 'var(--pending-bg)', border: '1.5px solid var(--pending)', borderRadius: '.5rem', padding: '1rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--pending)', marginBottom: '.5rem', fontSize: '.85rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>⚠️ Testing Pending</div>
                  {result.lastTest ? (
                    <InfoRow label="Days Since Test" value={`${result.lastTest.days_ago} days ago`} />
                  ) : (
                    <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>No test record found in ASR &amp; CIA 2026 data.</div>
                  )}
                </div>
              )}

              {/* Master list */}
              {result.master ? (
                <div>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem' }}>Master Coach List</div>
                  <InfoRow label="Train No"         value={result.master.train_no} />
                  <InfoRow label="Coach Type"       value={result.master.code} />
                  <InfoRow label="Railway / Depot"  value={result.master.depot} />
                  <InfoRow label="Status"           value={result.master.status} />
                </div>
              ) : (
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', padding: '.5rem 0' }}>
                  ❓ Coach not found in Total Coaches master list. Upload latest coach list in Settings.
                </div>
              )}

              {/* Last test */}
              {result.lastTest && (
                <div>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem' }}>Last Test Record</div>
                  <InfoRow label="S.No"      value={`#${result.lastTest.s_no}`} />
                  <InfoRow label="Test Date" value={fmtDate(result.lastTest.date)} />
                  <InfoRow label="Train No"  value={result.lastTest.train_no} />
                  <InfoRow label="Code"      value={result.lastTest.code} />
                  <InfoRow label="Result"    value={result.lastTest.result} />
                  <InfoRow label="2nd Test"  value={fmtDate(result.lastTest.second_test_date)} />
                  <InfoRow label="2nd Result" value={result.lastTest.second_test_result ?? undefined} />
                  <InfoRow label="Days Ago"  value={`${result.lastTest.days_ago} days ago`} />
                </div>
              )}

            </div>
          </div>

          {/* Resampling remarks — show when coach is due/overdue */}
          {(result.status === 'OVERDUE' || (result.status === 'PENDING' && result.lastTest?.result === 'FAIL')) && (
            <ResamplingSection
              coachNo={result.coachNo}
              trainNo={result.lastTest?.train_no || result.master?.train_no || ''}
              initialRemarks={result.remarks || []}
            />
          )}

          {/* Full test history */}
          {result.history && result.history.length > 1 && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
                <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  📜 Complete Test History ({result.history.length} entries)
                </span>
                <button onClick={() => setShowHistory(h => !h)}
                  style={{ fontSize: '.75rem', fontWeight: 600, padding: '.2rem .55rem', borderRadius: '.3rem', border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showHistory ? '▲ Hide' : '▼ Show'}
                </button>
              </div>
              {showHistory && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        {['S.No','Date','Train','Result','2nd Test','2nd Result','Days Ago'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '.4rem .6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '.65rem', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.history.map((h, i) => (
                        <tr key={h.s_no} style={{ borderBottom: '1px solid var(--border)', background: i === 0 ? 'var(--bg-input)' : 'transparent' }}>
                          <td style={{ padding: '.4rem .6rem', fontWeight: 700, color: 'var(--primary)' }}>#{h.s_no}</td>
                          <td style={{ padding: '.4rem .6rem', whiteSpace: 'nowrap' }}>{fmtDate(h.date)}</td>
                          <td style={{ padding: '.4rem .6rem' }}>{h.train_no}</td>
                          <td style={{ padding: '.4rem .6rem' }}><ResultPill result={h.result} /></td>
                          <td style={{ padding: '.4rem .6rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtDate(h.second_test_date)}</td>
                          <td style={{ padding: '.4rem .6rem' }}>{h.second_test_result ? <ResultPill result={h.second_test_result} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                          <td style={{ padding: '.4rem .6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h.days_ago}d ago</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
