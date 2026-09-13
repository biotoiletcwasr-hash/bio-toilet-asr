'use client'
import { useEffect, useState } from 'react'

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

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

function CoachRow({ item, variant }: { item: CoachEntry; variant: 'overdue' | 'upcoming' }) {
  const color = variant === 'overdue' ? 'var(--fail)' : 'var(--pending)'
  const bg    = variant === 'overdue' ? 'var(--fail-bg)' : 'var(--pending-bg)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      padding: '.5rem .75rem', borderRadius: '.375rem',
      background: 'var(--bg)', border: '1px solid var(--border)',
      gap: '.5rem', flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '.875rem', fontFamily: 'monospace' }}>
          {item.coach_no}
        </span>
        <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
          Train {item.train_no || '—'} {item.code ? `· ${item.code}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>
          Tested: {fmtDate(item.test_date)}
        </span>
        <span style={{
          fontSize: '.75rem', fontWeight: 600, color,
          background: bg, padding: '.2rem .5rem', borderRadius: '.25rem', whiteSpace: 'nowrap',
        }}>
          Due: {fmtDate(item.due_date)}
        </span>
      </div>
    </div>
  )
}

type Tab = 'overdue' | 'upcoming'

export default function DueAlert() {
  const [data, setData]     = useState<DueData | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overdue')

  useEffect(() => {
    fetch('/api/due-coaches')
      .then(r => r.json())
      .then(d => {
        if (d.overdue || d.upcoming) {
          setData(d)
          // default to whichever has items
          if ((d.overdue?.length || 0) === 0 && (d.upcoming?.length || 0) > 0) {
            setActiveTab('upcoming')
          } else {
            setActiveTab('overdue')
          }
        }
      })
      .catch(() => {})
  }, [])

  if (!data) return null
  const hasOverdue  = data.overdue.length > 0
  const hasUpcoming = data.upcoming.length > 0
  if (!hasOverdue && !hasUpcoming) return null

  const borderColor = hasOverdue ? 'var(--fail)' : 'var(--pending)'
  const items = activeTab === 'overdue' ? data.overdue : data.upcoming

  return (
    <div style={{
      border: `1.5px solid ${borderColor}`,
      borderRadius: '.625rem',
      background: 'var(--bg-card)',
      marginBottom: '1.25rem',
      overflow: 'hidden',
      boxShadow: 'var(--shadow)',
    }}>
      {/* Header row */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '.65rem 1rem', cursor: 'pointer',
          background: hasOverdue ? 'var(--fail-bg)' : 'var(--pending-bg)',
          gap: '.5rem', flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>{hasOverdue ? '🚨' : '⚠️'}</span>
          <span style={{ fontWeight: 700, fontSize: '.9rem', color: hasOverdue ? 'var(--fail)' : 'var(--pending)' }}>
            BIO TOILET RE-SAMPLING ALERT
          </span>
        </div>
        <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
          {collapsed ? '▼ Show' : '▲ Hide'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: '1rem' }}>
          {/* Toggle buttons */}
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setActiveTab('overdue')}
              disabled={!hasOverdue}
              style={{
                padding: '.4rem 1rem', borderRadius: '.375rem',
                border: 'none', cursor: hasOverdue ? 'pointer' : 'not-allowed',
                fontWeight: 700, fontSize: '.8rem',
                background: activeTab === 'overdue' ? 'var(--fail)' : 'var(--bg)',
                color: activeTab === 'overdue' ? '#fff' : hasOverdue ? 'var(--fail)' : 'var(--text-muted)',
                outline: activeTab !== 'overdue' && hasOverdue ? '1.5px solid var(--fail)' : 'none',
                opacity: !hasOverdue ? 0.5 : 1,
                transition: 'all .15s',
              }}
            >
              🔴 Overdue ({data.overdue.length})
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              disabled={!hasUpcoming}
              style={{
                padding: '.4rem 1rem', borderRadius: '.375rem',
                border: 'none', cursor: hasUpcoming ? 'pointer' : 'not-allowed',
                fontWeight: 700, fontSize: '.8rem',
                background: activeTab === 'upcoming' ? 'var(--pending)' : 'var(--bg)',
                color: activeTab === 'upcoming' ? '#fff' : hasUpcoming ? 'var(--pending)' : 'var(--text-muted)',
                outline: activeTab !== 'upcoming' && hasUpcoming ? '1.5px solid var(--pending)' : 'none',
                opacity: !hasUpcoming ? 0.5 : 1,
                transition: 'all .15s',
              }}
            >
              🟡 Due in 7 Days ({data.upcoming.length})
            </button>
          </div>

          {/* List */}
          {items.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.85rem' }}>
              No coaches in this category.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              {activeTab === 'overdue' && (
                <div style={{ fontSize: '.7rem', color: 'var(--fail)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.25rem' }}>
                  30-day window has passed — re-sample immediately · {items.length} coaches
                </div>
              )}
              {activeTab === 'upcoming' && (
                <div style={{ fontSize: '.7rem', color: 'var(--pending)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.25rem' }}>
                  Schedule re-sampling within 7 days · {items.length} coaches
                </div>
              )}
              {items.map((item, i) => (
                <CoachRow key={i} item={item} variant={activeTab} />
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
