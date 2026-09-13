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

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

function CoachRow({ item, variant }: { item: CoachEntry; variant: 'overdue' | 'upcoming' }) {
  const color = variant === 'overdue' ? 'var(--fail)' : 'var(--pending)'
  const bg = variant === 'overdue' ? 'var(--fail-bg)' : 'var(--pending-bg)'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '.5rem .75rem',
      borderRadius: '.375rem',
      background: 'var(--bg)',
      border: `1px solid var(--border)`,
      gap: '.5rem',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
        <span style={{
          fontWeight: 700,
          color: 'var(--text)',
          fontSize: '.875rem',
        }}>
          {item.coach_no}
        </span>
        <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
          Train {item.train_no} · Code {item.code}
        </span>
      </div>
      <span style={{
        fontSize: '.75rem',
        fontWeight: 600,
        color,
        background: bg,
        padding: '.2rem .5rem',
        borderRadius: '.25rem',
        whiteSpace: 'nowrap',
      }}>
        Due: {formatDate(item.due_date)}
      </span>
    </div>
  )
}

export default function DueAlert() {
  const [data, setData] = useState<DueData | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    fetch('/api/due-coaches')
      .then(r => r.json())
      .then(d => {
        if (d.overdue || d.upcoming) setData(d)
      })
      .catch(() => {})
  }, [])

  if (!data) return null
  const total = data.overdue.length + data.upcoming.length
  if (total === 0) return null

  return (
    <div style={{
      border: `1.5px solid ${data.overdue.length > 0 ? 'var(--fail)' : 'var(--pending)'}`,
      borderRadius: '.625rem',
      background: 'var(--bg-card)',
      marginBottom: '1.25rem',
      overflow: 'hidden',
      boxShadow: 'var(--shadow)',
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '.75rem 1rem',
          cursor: 'pointer',
          background: data.overdue.length > 0 ? 'var(--fail-bg)' : 'var(--pending-bg)',
          gap: '.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>
            {data.overdue.length > 0 ? '🚨' : '⚠️'}
          </span>
          <span style={{
            fontWeight: 700,
            fontSize: '.9rem',
            color: data.overdue.length > 0 ? 'var(--fail)' : 'var(--pending)',
          }}>
            BIO TOILET RE-SAMPLING ALERT
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          {data.overdue.length > 0 && (
            <span style={{
              fontSize: '.75rem', fontWeight: 700,
              background: 'var(--fail)', color: '#fff',
              padding: '.15rem .5rem', borderRadius: '999px',
            }}>
              {data.overdue.length} OVERDUE
            </span>
          )}
          {data.upcoming.length > 0 && (
            <span style={{
              fontSize: '.75rem', fontWeight: 700,
              background: 'var(--pending)', color: '#fff',
              padding: '.15rem .5rem', borderRadius: '999px',
            }}>
              {data.upcoming.length} DUE IN 7 DAYS
            </span>
          )}
          <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
            {collapsed ? '▼' : '▲'}
          </span>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {data.overdue.length > 0 && (
            <div>
              <div style={{
                fontSize: '.75rem', fontWeight: 700,
                color: 'var(--fail)',
                textTransform: 'uppercase', letterSpacing: '.06em',
                marginBottom: '.5rem',
                display: 'flex', alignItems: 'center', gap: '.35rem',
              }}>
                🔴 Overdue Coaches — {data.overdue.length}
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                  (30-day window has passed — re-sample immediately)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                {data.overdue.map((item, i) => (
                  <CoachRow key={i} item={item} variant="overdue" />
                ))}
              </div>
            </div>
          )}

          {data.upcoming.length > 0 && (
            <div>
              <div style={{
                fontSize: '.75rem', fontWeight: 700,
                color: 'var(--pending)',
                textTransform: 'uppercase', letterSpacing: '.06em',
                marginBottom: '.5rem',
                display: 'flex', alignItems: 'center', gap: '.35rem',
              }}>
                🟡 Due in Next 7 Days — {data.upcoming.length}
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                  (schedule re-sampling soon)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                {data.upcoming.map((item, i) => (
                  <CoachRow key={i} item={item} variant="upcoming" />
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: '.7rem', color: 'var(--text-muted)', margin: 0 }}>
            Re-sampling due 30 days after the original FAIL test date. Mark the 2nd Test Date in the record to dismiss a coach from this list. Use &quot;NA&quot; in 2nd Test Result to exempt a coach permanently.
          </p>
        </div>
      )}
    </div>
  )
}
