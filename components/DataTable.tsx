'use client'
import { useState, useEffect, useCallback } from 'react'
import { BioTestEntry, calculateResult } from '@/lib/types'

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const p = iso.split('-')
  if (p.length === 3 && p[0].length === 4) return `${p[2]}-${p[1]}-${p[0]}`
  return iso
}

interface Props {
  refreshKey: number
  depot: string
}

// ── Edit Modal ────────────────────────────────────────────────
function EditModal({ entry, onClose, onSaved }: {
  entry: BioTestEntry
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    date:               entry.date || '',
    train_no:           entry.train_no || '',
    coach_no:           entry.coach_no || '',
    code:               entry.code || '',
    bio_tank_no:        entry.bio_tank_no || '',
    ph:                 entry.ph  != null ? String(entry.ph)   : '',
    cod:                entry.cod != null ? String(entry.cod)  : '',
    fcfc:               entry.fcfc != null ? String(entry.fcfc) : '',
    second_test_date:   entry.second_test_date   || '',
    second_test_result: entry.second_test_result || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const ph   = parseFloat(form.ph)
  const cod  = parseFloat(form.cod)
  const fcfc = parseFloat(form.fcfc)
  const previewResult = calculateResult(
    isNaN(ph)   ? null : ph,
    isNaN(cod)  ? null : cod,
    isNaN(fcfc) ? null : fcfc,
  )
  const needsSecondTest = previewResult === 'FAIL'

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  async function handleSave() {
    if (!form.date || !form.train_no || !form.coach_no) {
      setError('Date, Train No and Coach No are required.')
      return
    }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Server error')
      onSaved(); onClose()
    } catch {
      setError('Update failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const FL = { display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.3rem', textTransform: 'uppercase' as const, letterSpacing: '.04em' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: '.75rem', padding: '1.5rem', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.4)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            ✏️ Edit Entry
            <span style={{ color: 'var(--primary)', fontWeight: 800 }}>#{entry.s_no}</span>
            {previewResult !== 'PENDING' && (
              <span className={`badge badge-${previewResult.toLowerCase()}`} style={{ fontSize: '.7rem' }}>
                {previewResult === 'PASS' ? '✅ PASS' : '❌ FAIL'}
              </span>
            )}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', lineHeight: 1, padding: '.2rem' }}>✕</button>
        </div>

        {error && (
          <div style={{ background: 'var(--fail-bg)', color: 'var(--fail)', padding: '.6rem 1rem', borderRadius: '.5rem', marginBottom: '1rem', fontSize: '.85rem' }}>
            {error}
          </div>
        )}

        {/* Basic info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: '.875rem', marginBottom: '1rem' }}>
          {[
            { k: 'date',        label: 'Date',        type: 'date',   upper: false },
            { k: 'train_no',    label: 'Train No.',    type: 'text',   upper: true  },
            { k: 'coach_no',    label: 'Coach No.',    type: 'text',   upper: true  },
            { k: 'code',        label: 'Code',         type: 'text',   upper: true  },
            { k: 'bio_tank_no', label: 'Bio Tank No.', type: 'text',   upper: false },
          ].map(f => (
            <div key={f.k}>
              <label style={FL}>{f.label}</label>
              <input
                type={f.type} className="input-field"
                value={(form as any)[f.k]}
                onChange={e => upd(f.k, f.upper ? e.target.value.toUpperCase() : e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Test params */}
        <div style={{ background: 'var(--bg-input)', borderRadius: '.5rem', border: '1px solid var(--border)', padding: '.875rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '.75rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            📊 Test Parameters
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '.875rem' }}>
            {[
              { k: 'ph',   label: 'pH (6–9)',    check: (v: number) => v >= 6 && v <= 9 },
              { k: 'cod',  label: 'COD (<1800)', check: (v: number) => v < 1800 },
              { k: 'fcfc', label: 'FCFC (<10⁷)', check: (v: number) => v < 10000000 },
            ].map(f => {
              const val = parseFloat((form as any)[f.k])
              const ok  = !isNaN(val) && f.check(val)
              return (
                <div key={f.k}>
                  <label style={FL}>{f.label}</label>
                  <input type="number" step="0.1" min="0" className="input-field"
                    value={(form as any)[f.k]}
                    onChange={e => upd(f.k, e.target.value)}
                  />
                  {(form as any)[f.k] !== '' && (
                    <p style={{ fontSize: '.65rem', marginTop: '.2rem', color: ok ? 'var(--pass)' : 'var(--fail)' }}>
                      {ok ? '✓ OK' : '⚠ Out of range'}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 2nd test */}
        {(needsSecondTest || form.second_test_date || form.second_test_result) && (
          <div style={{ background: 'var(--fail-bg)', border: '1px solid var(--fail)', borderRadius: '.5rem', padding: '.875rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--fail)', marginBottom: '.75rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>🔁 2nd Test</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.875rem' }}>
              <div>
                <label style={FL}>2nd Test Date</label>
                <input type="date" className="input-field" value={form.second_test_date} onChange={e => upd('second_test_date', e.target.value)} />
              </div>
              <div>
                <label style={FL}>2nd Test Result</label>
                <select className="input-field" value={form.second_test_result} onChange={e => upd('second_test_result', e.target.value)}>
                  <option value="">-- Select --</option>
                  <option value="PASS">✅ PASS</option>
                  <option value="FAIL">❌ FAIL</option>
                  <option value="NA">NA (Exempt)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button" className="btn-primary"
            onClick={handleSave} disabled={loading}
            style={{ minWidth: '140px', opacity: loading ? .7 : 1 }}
          >
            {loading ? '⏳ Saving...' : '✅ Update Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main DataTable ────────────────────────────────────────────
export default function DataTable({ refreshKey, depot }: Props) {
  const [entries, setEntries] = useState<BioTestEntry[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [editEntry, setEditEntry] = useState<BioTestEntry | null>(null)

  const LIMIT = 20

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/entries?page=${page}&limit=${LIMIT}&search=${encodeURIComponent(search)}&depot=${encodeURIComponent(depot)}`
      )
      const data = await res.json()
      setEntries(data.entries || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [page, search, refreshKey, depot])

  useEffect(() => { setPage(1) }, [depot])
  useEffect(() => { fetchEntries() }, [fetchEntries])

  async function handleDelete(id: number) {
    if (!confirm('Delete this entry? This cannot be undone.')) return
    setDeleting(id)
    await fetch(`/api/entries/${id}`, { method: 'DELETE' })
    setDeleting(null)
    fetchEntries()
  }

  function exportCSV() {
    const headers = [
      'S.No','Date','Train No','Coach No','Code','Bio Tank No',
      'pH','COD','FCFC','Result','2nd Test Date','2nd Test Result'
    ]
    const rows = entries.map(e => [
      e.s_no, e.date, e.train_no, e.coach_no, e.code, e.bio_tank_no,
      e.ph ?? '', e.cod ?? '', e.fcfc ?? '', e.result,
      e.second_test_date ?? '', e.second_test_result ?? ''
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `bio-test-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <>
      {editEntry && (
        <EditModal
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSaved={() => { fetchEntries() }}
        />
      )}

      <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>📋 Test Records</h2>
            <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.1rem' }}>Total: {total} entries</p>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <input
              type="text" className="input-field"
              placeholder="🔍 Train / Coach / Code"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ width: '200px' }}
            />
            <button className="btn-ghost" onClick={exportCSV} title="Export CSV">⬇ CSV</button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', borderRadius: '.5rem', border: '1px solid var(--border)' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Loading...</div>
          ) : entries.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No entries found 🔍</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>S.No</th><th>Date</th><th>Train No</th><th>Coach No</th>
                  <th>Code</th><th>Tank No</th><th>pH</th><th>COD</th><th>FCFC</th>
                  <th>Result</th><th>2nd Test</th><th>2nd Result</th><th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{e.s_no}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
                    <td style={{ fontWeight: 600 }}>{e.train_no}</td>
                    <td>{e.coach_no}</td>
                    <td>{e.code || '—'}</td>
                    <td>{e.bio_tank_no || '—'}</td>
                    <td><PHBadge val={e.ph} /></td>
                    <td><NumBadge val={e.cod} max={1800} unit="" /></td>
                    <td><NumBadge val={e.fcfc} max={10000000} unit="" /></td>
                    <td><ResultBadge result={e.result} /></td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtDate(e.second_test_date)}</td>
                    <td>
                      {e.second_test_result
                        ? <ResultBadge result={e.second_test_result as any} />
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '.25rem' }}>
                        <button
                          onClick={() => setEditEntry(e)}
                          title="Edit"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '.85rem', padding: '.2rem .4rem', borderRadius: '.25rem' }}
                        >✏️</button>
                        <button
                          onClick={() => handleDelete(e.id!)}
                          disabled={deleting === e.id}
                          title="Delete"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fail)', fontSize: '.85rem', padding: '.2rem .4rem', borderRadius: '.25rem', opacity: deleting === e.id ? .5 : 1 }}
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '.5rem', marginTop: '1rem', alignItems: 'center' }}>
            <button className="btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
            <span style={{ fontSize: '.875rem', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
            <button className="btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
          </div>
        )}
      </div>
    </>
  )
}

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    PASS:    { cls: 'badge-pass',    label: '✅ PASS'    },
    FAIL:    { cls: 'badge-fail',    label: '❌ FAIL'    },
    PENDING: { cls: 'badge-pending', label: '⏳ PENDING' },
  }
  const m = map[result] || map.PENDING
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}

function PHBadge({ val }: { val: number | null }) {
  if (val === null || val === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const ok = val >= 6 && val <= 9
  return <span style={{ color: ok ? 'var(--pass)' : 'var(--fail)', fontWeight: 600 }}>{val}</span>
}

function NumBadge({ val, max }: { val: number | null; max: number; unit: string }) {
  if (val === null || val === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const ok = val < max
  return <span style={{ color: ok ? 'var(--pass)' : 'var(--fail)', fontWeight: 600 }}>{val}</span>
}
