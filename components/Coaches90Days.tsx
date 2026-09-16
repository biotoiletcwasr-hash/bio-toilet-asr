'use client'
import { useState, useEffect } from 'react'

type Coach90 = {
  coach_no: string
  train_no: string
  code: string
  depot: string
  last_test_date: string | null
  days_ago: number | null
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : iso
}

export default function Coaches90Days({ depot }: { depot: string }) {
  const [coaches, setCoaches] = useState<Coach90[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/coaches-90days?depot=${encodeURIComponent(depot)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setCoaches(d.coaches || [])
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false))
  }, [depot])

  const filtered = coaches.filter(c => {
    const q = search.toLowerCase()
    return (
      (c.coach_no  || '').toLowerCase().includes(q) ||
      (c.train_no  || '').toLowerCase().includes(q) ||
      (c.code      || '').toLowerCase().includes(q) ||
      (c.depot     || '').toLowerCase().includes(q)
    )
  })

  const neverTested  = filtered.filter(c => !c.last_test_date)
  const overdue90    = filtered.filter(c =>  c.last_test_date)

  function exportCSV() {
    const headers = ['Coach No', 'Train No', 'Code', 'Depot', 'Last Test Date', 'Days Since Test']
    const rows = filtered.map(c => [
      c.coach_no, c.train_no || '—', c.code || '—', c.depot || '—',
      c.last_test_date ? fmtDate(c.last_test_date) : 'Never Tested',
      c.days_ago != null ? c.days_ago : '—',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coaches-90days-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  function DaysChip({ days }: { days: number | null }) {
    if (days == null) return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Never tested</span>
    const color = days > 180 ? 'var(--fail)' : days > 120 ? 'var(--pending)' : 'var(--text-muted)'
    return (
      <span style={{
        display: 'inline-block', padding: '.15rem .55rem', borderRadius: '9999px',
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color, fontWeight: 700, fontSize: '.78rem',
      }}>
        {days}d ago
      </span>
    )
  }

  return (
    <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            ⏰ Coaches Not Tested in 90+ Days
          </h2>
          <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
            {loading ? 'Loading...' : `${filtered.length} coaches — ${neverTested.length} never tested, ${overdue90.length} overdue`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <input
            type="text" className="input-field"
            placeholder="🔍 Coach / Train / Code"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '200px' }}
          />
          <button className="btn-ghost" onClick={exportCSV} disabled={loading}>⬇ CSV</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '.75rem', color: 'var(--text-muted)' }}>
        <span>Color: <strong style={{ color: 'var(--text-muted)' }}>91–120d</strong> · <strong style={{ color: 'var(--pending)' }}>121–180d</strong> · <strong style={{ color: 'var(--fail)' }}>180d+</strong></span>
      </div>

      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Loading...</div>
      )}

      {error && (
        <div style={{ padding: '1rem', borderRadius: '.5rem', background: 'var(--fail-bg)', color: 'var(--fail)', fontSize: '.875rem' }}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          {coaches.length === 0
            ? '✅ All coaches tested within 90 days — or coach master list not uploaded yet.'
            : '🔍 No coaches match your search.'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: '.5rem', border: '1px solid var(--border)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Coach No</th>
                <th>Train No</th>
                <th>Code</th>
                <th>Depot</th>
                <th>Last Test Date</th>
                <th>Days Since Test</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.coach_no + i}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{i + 1}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{c.coach_no}</td>
                  <td style={{ fontWeight: 600 }}>{c.train_no || '—'}</td>
                  <td>{c.code || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>{c.depot || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {c.last_test_date
                      ? fmtDate(c.last_test_date)
                      : <span style={{ color: 'var(--fail)', fontStyle: 'italic', fontSize: '.8rem' }}>Never tested</span>
                    }
                  </td>
                  <td><DaysChip days={c.days_ago} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
