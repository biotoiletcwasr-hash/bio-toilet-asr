'use client'
import { useEffect, useState, useCallback } from 'react'

type CoachEntry = {
  coach_no: string
  train_no: string
  code: string
  bio_tank_no: string
  test_date: string
  due_date: string
}

type DueData = {
  overdue: CoachEntry[]
  upcoming: CoachEntry[]
}

type Remark = {
  id: number
  coach_no: string
  train_no: string
  remark_date: string
  location_status: string
  remark: string
  created_at: string
}

type Tab = 'overdue' | 'upcoming'

const LOCATION_OPTIONS = [
  'In Yard', 'On Terminal Train', 'In Workshop',
  'Scheduled for Resampling', 'Not Located', 'Sent for Repairs',
  'Out of Station', 'Other',
]

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

// ── Per-Coach Remark Row ──────────────────────────────────────
function CoachRow({
  item, variant, remarks, onRemarkAdded, onRemarkDeleted,
}: {
  item: CoachEntry
  variant: 'overdue' | 'upcoming'
  remarks: Remark[]
  onRemarkAdded: (r: Remark) => void
  onRemarkDeleted: (id: number) => void
}) {
  const color = variant === 'overdue' ? 'var(--fail)' : 'var(--pending)'
  const bg    = variant === 'overdue' ? 'var(--fail-bg)' : 'var(--pending-bg)'

  const [open, setOpen]         = useState(false)
  const [adding, setAdding]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [addForm, setAddForm]   = useState({
    remark_date:     new Date().toISOString().split('T')[0],
    location_status: '',
    remark:          '',
  })

  const latestRemark = remarks[0] ?? null

  async function handleAdd() {
    if (!addForm.remark_date) return
    setSaving(true)
    try {
      const res = await fetch('/api/resampling-remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach_no:        item.coach_no,
          train_no:        item.train_no,
          remark_date:     addForm.remark_date,
          location_status: addForm.location_status,
          remark:          addForm.remark,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      onRemarkAdded(data.remark)
      setAddForm(f => ({ ...f, location_status: '', remark: '' }))
      setAdding(false)
      setOpen(true)
    } catch {
      alert('Failed to save remark. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this remark?')) return
    setDeleting(id)
    try {
      await fetch(`/api/resampling-remarks/${id}`, { method: 'DELETE' })
      onRemarkDeleted(id)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div style={{ borderRadius: '.5rem', border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Coach info row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.5rem .75rem', gap: '.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '.9rem', fontFamily: 'monospace' }}>
            {item.coach_no}
          </span>
          <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
            Train {item.train_no || '—'} {item.code ? `· ${item.code}` : ''}
          </span>
          {latestRemark?.location_status && (
            <span style={{ fontSize: '.7rem', background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '.1rem .4rem', borderRadius: '.25rem', color: 'var(--text-muted)' }}>
              📍 {latestRemark.location_status}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>
            Tested: {fmtDate(item.test_date)}
          </span>
          <span style={{ fontSize: '.75rem', fontWeight: 600, color, background: bg, padding: '.2rem .5rem', borderRadius: '.25rem', whiteSpace: 'nowrap' }}>
            Due: {fmtDate(item.due_date)}
          </span>
          <button
            onClick={() => { setOpen(o => !o); setAdding(false) }}
            style={{ fontSize: '.72rem', fontWeight: 600, padding: '.2rem .55rem', borderRadius: '.3rem', border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
          >
            {open ? '▲ Hide' : `📋 Remarks${remarks.length > 0 ? ` (${remarks.length})` : ''}`}
          </button>
          <button
            onClick={() => { setAdding(a => !a); setOpen(true) }}
            style={{ fontSize: '.72rem', fontWeight: 600, padding: '.2rem .55rem', borderRadius: '.3rem', border: 'none', background: 'var(--primary)', cursor: 'pointer', color: '#fff', whiteSpace: 'nowrap' }}
          >
            {adding ? '✕' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Expanded section */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '.75rem', background: 'var(--bg-card)' }}>
          {/* Add form */}
          {adding && (
            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '.5rem', padding: '.875rem', marginBottom: '.75rem' }}>
              <p style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.65rem' }}>
                📝 Add Today's Status
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '.65rem', marginBottom: '.65rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '.65rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.25rem', textTransform: 'uppercase' }}>Date</label>
                  <input type="date" className="input-field" style={{ fontSize: '.8rem' }}
                    value={addForm.remark_date}
                    onChange={e => setAddForm(f => ({ ...f, remark_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '.65rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.25rem', textTransform: 'uppercase' }}>Location / Status</label>
                  <input
                    type="text"
                    list="location-opts"
                    className="input-field"
                    style={{ fontSize: '.8rem' }}
                    placeholder="Type or select location..."
                    value={addForm.location_status}
                    onChange={e => setAddForm(f => ({ ...f, location_status: e.target.value }))}
                  />
                  <datalist id="location-opts">
                    {LOCATION_OPTIONS.map(o => <option key={o} value={o} />)}
                  </datalist>
                </div>
              </div>
              <div style={{ marginBottom: '.65rem' }}>
                <label style={{ display: 'block', fontSize: '.65rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.25rem', textTransform: 'uppercase' }}>Remark</label>
                <input type="text" className="input-field" style={{ fontSize: '.8rem', width: '100%' }}
                  placeholder="e.g. Coach found in yard near platform 3, resampling scheduled for tomorrow"
                  value={addForm.remark}
                  onChange={e => setAddForm(f => ({ ...f, remark: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                />
              </div>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button onClick={handleAdd} disabled={saving || !addForm.remark_date}
                  style={{ padding: '.35rem .9rem', borderRadius: '.375rem', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', opacity: saving ? .7 : 1 }}>
                  {saving ? '⏳ Saving...' : '💾 Save Remark'}
                </button>
                <button onClick={() => setAdding(false)}
                  style={{ padding: '.35rem .75rem', borderRadius: '.375rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Remarks history */}
          {remarks.length === 0 ? (
            <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '.75rem 0' }}>
              No remarks yet — click "+ Add" to log today's status.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              {remarks.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.5rem', padding: '.45rem .6rem', borderRadius: '.375rem', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>
                        {fmtDate(r.remark_date)}
                      </span>
                      {r.location_status && (
                        <span style={{ fontSize: '.7rem', fontWeight: 600, background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '.1rem .4rem', borderRadius: '.25rem', color: 'var(--primary)' }}>
                          📍 {r.location_status}
                        </span>
                      )}
                    </div>
                    {r.remark && (
                      <p style={{ fontSize: '.78rem', color: 'var(--text)', marginTop: '.25rem', lineHeight: 1.5 }}>
                        {r.remark}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deleting === r.id}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fail)', fontSize: '.8rem', padding: '.1rem .3rem', borderRadius: '.25rem', opacity: deleting === r.id ? .5 : .6, flexShrink: 0 }}
                    title="Delete remark"
                  >🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main DueAlert ─────────────────────────────────────────────
export default function DueAlert() {
  const [data, setData]         = useState<DueData | null>(null)
  const [collapsed, setCollapsed] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overdue')
  const [remarks, setRemarks]   = useState<Record<string, Remark[]>>({})
  const [remarksLoaded, setRemarksLoaded] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetch('/api/due-coaches')
      .then(r => r.json())
      .then(d => {
        if (d.overdue || d.upcoming) {
          setData(d)
          if ((d.overdue?.length || 0) === 0 && (d.upcoming?.length || 0) > 0) {
            setActiveTab('upcoming')
          }
        }
      })
      .catch(() => {})
  }, [])

  // Load all remarks when expanded
  useEffect(() => {
    if (!collapsed && !remarksLoaded) {
      fetch('/api/resampling-remarks')
        .then(r => r.json())
        .then(d => {
          const grouped: Record<string, Remark[]> = {}
          for (const r of (d.remarks || []) as Remark[]) {
            const key = r.coach_no.toUpperCase()
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(r)
          }
          setRemarks(grouped)
          setRemarksLoaded(true)
        })
        .catch(() => {})
    }
  }, [collapsed, remarksLoaded])

  function handleRemarkAdded(coachNo: string, r: Remark) {
    const key = coachNo.toUpperCase()
    setRemarks(prev => ({
      ...prev,
      [key]: [r, ...(prev[key] || [])],
    }))
  }

  function handleRemarkDeleted(coachNo: string, id: number) {
    const key = coachNo.toUpperCase()
    setRemarks(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter(r => r.id !== id),
    }))
  }

  async function exportRemarks() {
    setExporting(true)
    try {
      const res = await fetch('/api/resampling-remarks')
      const d   = await res.json()
      const all: Remark[] = d.remarks || []
      if (!all.length) { alert('No remarks found.'); return }

      const headers = ['Coach No', 'Train No', 'Remark Date', 'Location / Status', 'Remark', 'Added At']
      const rows = all.map(r => [
        r.coach_no, r.train_no, r.remark_date,
        r.location_status, `"${(r.remark || '').replace(/"/g, '""')}"`,
        r.created_at,
      ])
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `resampling-remarks-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
    } finally {
      setExporting(false)
    }
  }

  if (!data) return null
  const hasOverdue  = data.overdue.length > 0
  const hasUpcoming = data.upcoming.length > 0
  if (!hasOverdue && !hasUpcoming) return null

  const borderColor = hasOverdue ? 'var(--fail)' : 'var(--pending)'
  const items       = activeTab === 'overdue' ? data.overdue : data.upcoming

  return (
    <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: '.625rem', background: 'var(--bg-card)', marginBottom: '1.25rem', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.65rem 1rem', cursor: 'pointer', background: hasOverdue ? 'var(--fail-bg)' : 'var(--pending-bg)', gap: '.5rem', flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>{hasOverdue ? '🚨' : '⚠️'}</span>
          <span style={{ fontWeight: 700, fontSize: '.9rem', color: hasOverdue ? 'var(--fail)' : 'var(--pending)' }}>
            BIO TOILET RE-SAMPLING ALERT
          </span>
          {hasOverdue && (
            <span style={{ fontSize: '.75rem', fontWeight: 700, background: 'var(--fail)', color: '#fff', borderRadius: '999px', padding: '.1rem .5rem' }}>
              {data.overdue.length} overdue
            </span>
          )}
          {hasUpcoming && (
            <span style={{ fontSize: '.75rem', fontWeight: 700, background: 'var(--pending)', color: '#fff', borderRadius: '999px', padding: '.1rem .5rem' }}>
              {data.upcoming.length} upcoming
            </span>
          )}
        </div>
        <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
          {collapsed ? '▼ Show' : '▲ Hide'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: '1rem' }}>
          {/* Tab buttons + export */}
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('overdue')}
              disabled={!hasOverdue}
              style={{ padding: '.4rem 1rem', borderRadius: '.375rem', border: 'none', cursor: hasOverdue ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '.8rem', background: activeTab === 'overdue' ? 'var(--fail)' : 'var(--bg)', color: activeTab === 'overdue' ? '#fff' : hasOverdue ? 'var(--fail)' : 'var(--text-muted)', outline: activeTab !== 'overdue' && hasOverdue ? '1.5px solid var(--fail)' : 'none', opacity: !hasOverdue ? 0.5 : 1, transition: 'all .15s' }}
            >
              🔴 Overdue ({data.overdue.length})
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              disabled={!hasUpcoming}
              style={{ padding: '.4rem 1rem', borderRadius: '.375rem', border: 'none', cursor: hasUpcoming ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '.8rem', background: activeTab === 'upcoming' ? 'var(--pending)' : 'var(--bg)', color: activeTab === 'upcoming' ? '#fff' : hasUpcoming ? 'var(--pending)' : 'var(--text-muted)', outline: activeTab !== 'upcoming' && hasUpcoming ? '1.5px solid var(--pending)' : 'none', opacity: !hasUpcoming ? 0.5 : 1, transition: 'all .15s' }}
            >
              🟡 Due in 7 Days ({data.upcoming.length})
            </button>
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={exportRemarks}
                disabled={exporting}
                style={{ padding: '.4rem .9rem', borderRadius: '.375rem', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '.78rem', cursor: 'pointer', opacity: exporting ? .6 : 1 }}
              >
                {exporting ? '⏳ Exporting...' : '📥 Export Remarks CSV'}
              </button>
            </div>
          </div>

          {/* Coach list */}
          {items.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.85rem' }}>
              No coaches in this category.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              <div style={{ fontSize: '.7rem', color: activeTab === 'overdue' ? 'var(--fail)' : 'var(--pending)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.25rem' }}>
                {activeTab === 'overdue'
                  ? `30-day window has passed — re-sample immediately · ${items.length} coaches`
                  : `Schedule re-sampling within 7 days · ${items.length} coaches`}
              </div>
              {items.map((item, i) => (
                <CoachRow
                  key={i}
                  item={item}
                  variant={activeTab}
                  remarks={remarks[item.coach_no.toUpperCase()] || []}
                  onRemarkAdded={r => handleRemarkAdded(item.coach_no, r)}
                  onRemarkDeleted={id => handleRemarkDeleted(item.coach_no, id)}
                />
              ))}
            </div>
          )}

          <p style={{ fontSize: '.7rem', color: 'var(--text-muted)', margin: '.75rem 0 0' }}>
            Re-sampling due 30 days after FAIL test. Add 2nd Test Date in the record to dismiss. Use NA in 2nd Test Result to exempt permanently.
          </p>
        </div>
      )}
    </div>
  )
}
