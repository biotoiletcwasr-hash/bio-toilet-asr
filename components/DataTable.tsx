'use client'
import { useState, useEffect, useCallback } from 'react'
import { BioTestEntry } from '@/lib/types'

interface Props {
  refreshKey: number
}

export default function DataTable({ refreshKey }: Props) {
  const [entries, setEntries] = useState<BioTestEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const LIMIT = 20

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/entries?page=${page}&limit=${LIMIT}&search=${encodeURIComponent(search)}`
      )
      const data = await res.json()
      setEntries(data.entries || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [page, search, refreshKey])

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
    <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
            📋 Test Records
          </h2>
          <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.1rem' }}>
            Total: {total} entries
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <input
            type="text"
            className="input-field"
            placeholder="🔍 Train / Coach / Code"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ width: '200px' }}
          />
          <button className="btn-ghost" onClick={exportCSV} title="Export CSV">
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: '.5rem', border: '1px solid var(--border)' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            ⏳ Loading...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No entries found 🔍
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Train No</th>
                <th>Coach No</th>
                <th>Code</th>
                <th>Tank No</th>
                <th>pH</th>
                <th>COD</th>
                <th>FCFC</th>
                <th>Result</th>
                <th>2nd Test</th>
                <th>2nd Result</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{e.s_no}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                  <td style={{ fontWeight: 600 }}>{e.train_no}</td>
                  <td>{e.coach_no}</td>
                  <td>{e.code || '—'}</td>
                  <td>{e.bio_tank_no || '—'}</td>
                  <td>
                    <PHBadge val={e.ph} />
                  </td>
                  <td>
                    <NumBadge val={e.cod} max={1800} unit="" />
                  </td>
                  <td>
                    <NumBadge val={e.fcfc} max={107} unit="" />
                  </td>
                  <td>
                    <ResultBadge result={e.result} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {e.second_test_date || '—'}
                  </td>
                  <td>
                    {e.second_test_result
                      ? <ResultBadge result={e.second_test_result as any} />
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(e.id!)}
                      disabled={deleting === e.id}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--fail)', fontSize: '.85rem', padding: '.2rem .4rem',
                        borderRadius: '.25rem', opacity: deleting === e.id ? .5 : 1,
                      }}
                      title="Delete"
                    >
                      🗑
                    </button>
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
          <button
            className="btn-ghost"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >← Prev</button>
          <span style={{ fontSize: '.875rem', color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn-ghost"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >Next →</button>
        </div>
      )}
    </div>
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
  return (
    <span style={{ color: ok ? 'var(--pass)' : 'var(--fail)', fontWeight: 600 }}>
      {val}
    </span>
  )
}

function NumBadge({ val, max }: { val: number | null; max: number; unit: string }) {
  if (val === null || val === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const ok = val < max
  return (
    <span style={{ color: ok ? 'var(--pass)' : 'var(--fail)', fontWeight: 600 }}>
      {val}
    </span>
  )
}
