'use client'
import { useState } from 'react'
import Link from 'next/link'
import EntryForm from '@/components/EntryForm'
import DataTable from '@/components/DataTable'
import ThemeToggle from '@/components/ThemeToggle'
import DueAlert from '@/components/DueAlert'
import CoachSearch from '@/components/CoachSearch'
import Coaches90Days from '@/components/Coaches90Days'

type Depot = 'ASR' | 'FZR' | 'JUC'

const DEPOT_LABELS: Record<Depot, string> = {
  ASR: 'ASR — Amritsar',
  FZR: 'FZR — Firozpur',
  JUC: 'JUC — Jalandhar',
}

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState<'form' | 'records' | 'search' | '90days'>('form')
  const [selectedDepot, setSelectedDepot] = useState<Depot>('ASR')

  function switchDepot(d: Depot) {
    setSelectedDepot(d)
    // 90days tab is ASR-only — reset to form if switching away from ASR
    if (d !== 'ASR' && activeTab === '90days') setActiveTab('form')
  }

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
          maxWidth: '1280px', margin: '0 auto',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 0',
          gap: '1rem', flexWrap: 'wrap',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '.75rem', textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              width: '42px', height: '42px',
              background: 'var(--primary)',
              borderRadius: '.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem',
              flexShrink: 0,
            }}>🚽</div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.2 }}>
                Bio Toilet Effluent Testing Lab
              </h1>
              <p style={{ fontSize: '.75rem', opacity: .75 }}>
                Coaching Depot ASR · Firozpur Division
              </p>
            </div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
            <Link
              href="/settings"
              style={{
                display: 'flex', alignItems: 'center', gap: '.35rem',
                color: 'var(--header-fg)', textDecoration: 'none',
                fontSize: '.85rem', opacity: .8,
                padding: '.35rem .65rem', borderRadius: '.375rem',
                border: '1px solid color-mix(in srgb, var(--header-fg) 25%, transparent)',
                transition: 'opacity .15s',
              }}
            >
              ⚙️ Settings
            </Link>
            <LogoutButton />
            <ThemeToggle />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', gap: '0', borderTop: '1px solid color-mix(in srgb, var(--primary-fg) 20%, transparent)' }}>
          {[
            { key: 'form',    label: '📝 New Test Entry',      always: true  },
            { key: 'records', label: '📋 All Records',         always: true  },
            { key: 'search',  label: '🔍 Search Coach Status', always: true  },
            { key: '90days',  label: '⏰ Coaches > 90 Days',   always: false },
          ].filter(tab => tab.always || selectedDepot === 'ASR').map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '.6rem 1.25rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key
                  ? '3px solid var(--primary)'
                  : '3px solid transparent',
                color: activeTab === tab.key ? 'var(--primary)' : 'var(--header-fg)',
                fontWeight: activeTab === tab.key ? 700 : 500,
                fontSize: '.875rem',
                cursor: 'pointer',
                transition: 'all .15s',
                marginBottom: '-3px',
                opacity: activeTab === tab.key ? 1 : .7,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem' }}>

        {/* ── Depot Switcher ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '.75rem',
          padding: '.75rem 1rem', borderRadius: '.625rem',
          background: 'var(--bg-card)', border: '1.5px solid var(--primary)',
          marginBottom: '1.25rem', flexWrap: 'wrap',
          boxShadow: 'var(--shadow)',
        }}>
          <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0 }}>
            🏭 Depot:
          </span>
          {(['ASR', 'FZR', 'JUC'] as Depot[]).map(d => (
            <button
              key={d}
              onClick={() => switchDepot(d)}
              style={{
                padding: '.45rem 1.25rem',
                borderRadius: '.5rem',
                border: selectedDepot === d ? 'none' : '1.5px solid var(--border)',
                background: selectedDepot === d ? 'var(--primary)' : 'transparent',
                color: selectedDepot === d ? '#fff' : 'var(--text)',
                fontWeight: 700,
                fontSize: '.875rem',
                cursor: 'pointer',
                transition: 'all .15s',
                letterSpacing: '.02em',
              }}
            >
              {DEPOT_LABELS[d]}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--text-muted)' }}>
            Showing records for <strong style={{ color: 'var(--primary)' }}>{selectedDepot}</strong> depot
          </span>
        </div>

        {/* Re-sampling due alert — ASR only */}
        {selectedDepot === 'ASR' && <DueAlert depot={selectedDepot} />}

        {/* Stats bar */}
        <StatsBar />

        {activeTab === 'form' && (
          <EntryForm depot={selectedDepot} onSuccess={() => {
            setRefreshKey(k => k + 1)
          }} />
        )}
        {activeTab === 'records' && (
          <DataTable refreshKey={refreshKey} depot={selectedDepot} />
        )}
        {activeTab === 'search' && (
          <CoachSearch />
        )}
        {activeTab === '90days' && (
          <Coaches90Days depot={selectedDepot} />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '1.5rem',
        color: 'var(--text-muted)',
        fontSize: '.75rem',
        borderTop: '1px solid var(--border)',
        marginTop: '2rem',
      }}>
        © 2026 ASR & CIA · Bio-Toilet Effluent Testing System ·{' '}
        <a href="mailto:biotoiletcwasr@gmail.com" style={{ color: 'var(--primary)' }}>
          biotoiletcwasr@gmail.com
        </a>
      </footer>
    </div>
  )
}

function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }
  return (
    <button
      onClick={handleLogout}
      style={{
        display: 'flex', alignItems: 'center', gap: '.35rem',
        color: 'var(--header-fg)', background: 'none',
        border: '1px solid color-mix(in srgb, var(--header-fg) 25%, transparent)',
        fontSize: '.85rem', opacity: .8,
        padding: '.35rem .65rem', borderRadius: '.375rem',
        cursor: 'pointer', transition: 'opacity .15s',
      }}
    >
      🚪 Logout
    </button>
  )
}

function StatsBar() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: '1rem',
      marginBottom: '1.5rem',
    }}>
      {[
        { icon: '🔬', label: 'pH Limit',  value: '6 – 9',         sub: 'Acceptable range' },
        { icon: '💧', label: 'COD Limit', value: '<1800',          sub: 'mgO₂/L' },
        { icon: '🦠', label: 'FCFC Limit',value: '<10⁷',           sub: 'MPN/100ml' },
        { icon: '📅', label: 'Year',       value: '2026',           sub: 'Coaching Depot ASR · Firozpur Division' },
      ].map(s => (
        <div key={s.label} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '.25rem' }}>{s.icon}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {s.label}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)', marginTop: '.1rem' }}>
            {s.value}
          </div>
          <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: '.1rem' }}>
            {s.sub}
          </div>
        </div>
      ))}
    </div>
  )
}
