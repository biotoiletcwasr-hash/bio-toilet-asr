'use client'
import { useState, useCallback } from 'react'
import { LIMITS, calculateResult } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TankRow {
  bio_tank_no: string
  ph: string
  cod: string
  fcfc: string
  second_test_date: string
  second_test_result: string
}

interface SharedFields {
  date: string
  train_no: string
  coach_no: string
  code: string
}

interface SavedEntry {
  id: number
  s_no: number
  coach_no: string
  train_no: string
  date: string
  result: string
  code: string
  bio_tank_no: string
  ph: number | null
  cod: number | null
  fcfc: number | null
  second_test_date: string | null
  second_test_result: string | null
}

interface Props {
  onSuccess: () => void
  depot: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyTank(index: number): TankRow {
  return {
    bio_tank_no: String(index + 1),
    ph: '', cod: '', fcfc: '',
    second_test_date: '', second_test_result: '',
  }
}

function parsedNum(val: string): number | null {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function tankResult(tank: TankRow): 'PASS' | 'FAIL' | 'PENDING' {
  return calculateResult(parsedNum(tank.ph), parsedNum(tank.cod), parsedNum(tank.fcfc))
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : iso
}

// ─── TankCard ─────────────────────────────────────────────────────────────────

function TankCard({
  index, tank, onChange, onRemove, canRemove,
}: {
  index: number
  tank: TankRow
  onChange: (i: number, field: keyof TankRow, val: string) => void
  onRemove: (i: number) => void
  canRemove: boolean
}) {
  const result = tankResult(tank)
  const isFail = result === 'FAIL'
  const isPass = result === 'PASS'

  const borderColor = isFail ? 'var(--fail)' : isPass ? 'var(--pass)' : 'var(--border)'
  const bg          = isFail ? 'var(--fail-bg)' : isPass ? 'var(--pass-bg)' : 'var(--bg-input)'

  const ph   = parsedNum(tank.ph)
  const cod  = parsedNum(tank.cod)
  const fcfc = parsedNum(tank.fcfc)

  return (
    <div style={{
      borderRadius: '.5rem',
      border: `1.5px solid ${borderColor}`,
      borderLeft: `4px solid ${borderColor}`,
      background: bg,
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '.75rem',
    }}>
      {/* Tank header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          🧪 Tank {index + 1}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          {result !== 'PENDING' && (
            <span className={`badge badge-${result.toLowerCase()}`} style={{ fontSize: '.7rem' }}>
              {result === 'PASS' ? '✅ PASS' : '❌ FAIL'}
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={!canRemove}
            title="Remove tank"
            style={{
              background: 'none', border: 'none', cursor: canRemove ? 'pointer' : 'not-allowed',
              color: 'var(--fail)', opacity: canRemove ? .8 : .3,
              fontSize: '1.1rem', lineHeight: 1, padding: '.1rem .2rem',
            }}
          >×</button>
        </div>
      </div>

      {/* Main fields row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '.75rem' }}>
        {/* Bio Tank No */}
        <div>
          <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.25rem', textTransform: 'uppercase' }}>
            Bio Tank No.
          </label>
          <input
            type="text" className="input-field"
            value={tank.bio_tank_no}
            onChange={e => onChange(index, 'bio_tank_no', e.target.value)}
          />
        </div>

        {/* pH */}
        <div>
          <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.25rem', textTransform: 'uppercase' }}>
            pH (6–9)
          </label>
          <input
            type="number" step="0.1" min="0" max="14" className="input-field"
            value={tank.ph}
            onChange={e => onChange(index, 'ph', e.target.value)}
          />
          {tank.ph !== '' && ph !== null && (
            <p className={ph >= 6 && ph <= 9 ? 'limit-ok' : 'limit-warn'} style={{ fontSize: '.65rem', marginTop: '.15rem' }}>
              {ph >= 6 && ph <= 9 ? '✓ OK' : '⚠ Out of range'}
            </p>
          )}
        </div>

        {/* COD */}
        <div>
          <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.25rem', textTransform: 'uppercase' }}>
            COD (&lt;1800)
          </label>
          <input
            type="number" step="0.1" min="0" className="input-field"
            value={tank.cod}
            onChange={e => onChange(index, 'cod', e.target.value)}
          />
          {tank.cod !== '' && cod !== null && (
            <p className={cod < 1800 ? 'limit-ok' : 'limit-warn'} style={{ fontSize: '.65rem', marginTop: '.15rem' }}>
              {cod < 1800 ? '✓ OK' : '⚠ Exceeds 1800'}
            </p>
          )}
        </div>

        {/* FCFC */}
        <div>
          <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.25rem', textTransform: 'uppercase' }}>
            FCFC (&lt;10⁷)
          </label>
          <input
            type="number" step="0.1" min="0" className="input-field"
            value={tank.fcfc}
            onChange={e => onChange(index, 'fcfc', e.target.value)}
          />
          {tank.fcfc !== '' && fcfc !== null && (
            <p className={fcfc < 10000000 ? 'limit-ok' : 'limit-warn'} style={{ fontSize: '.65rem', marginTop: '.15rem' }}>
              {fcfc < 10000000 ? '✓ OK' : '⚠ Exceeds 10⁷'}
            </p>
          )}
        </div>
      </div>

      {/* 2nd Test — shown only when FAIL */}
      {isFail && (
        <div style={{
          borderTop: '1px solid var(--fail)',
          paddingTop: '.75rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: '.75rem',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--fail)', marginBottom: '.25rem', textTransform: 'uppercase' }}>
              🔁 2nd Test Date
            </label>
            <input
              type="date" className="input-field"
              value={tank.second_test_date}
              onChange={e => onChange(index, 'second_test_date', e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--fail)', marginBottom: '.25rem', textTransform: 'uppercase' }}>
              2nd Test Result
            </label>
            <select
              className="input-field"
              value={tank.second_test_result}
              onChange={e => onChange(index, 'second_test_result', e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="PASS">✅ PASS</option>
              <option value="FAIL">❌ FAIL</option>
              <option value="NA">NA (exempt)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main EntryForm ───────────────────────────────────────────────────────────

export default function EntryForm({ onSuccess, depot }: Props) {
  // ── New entry state ───────────────────────────────────────────────────────
  const [shared, setShared]   = useState<SharedFields>({
    date: new Date().toISOString().split('T')[0],
    train_no: '', coach_no: '', code: '',
  })
  const [tanks, setTanks]     = useState<TankRow[]>([emptyTank(0)])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [savedList, setSavedList] = useState<SavedEntry[]>([])  // last batch saved

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editId, setEditId]     = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [updateSuccess, setUpdateSuccess] = useState(false)

  // ── Tank handlers ─────────────────────────────────────────────────────────
  const changeTank = useCallback((i: number, field: keyof TankRow, val: string) => {
    setTanks(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: val }
      return next
    })
  }, [])

  const addTank = useCallback(() => {
    setTanks(prev => [...prev, emptyTank(prev.length)])
  }, [])

  const removeTank = useCallback((i: number) => {
    setTanks(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i))
  }, [])

  // ── Submit new entry (batch) ──────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!shared.date || !shared.train_no || !shared.coach_no) {
      setError('Date, Train No. and Coach No. are required.')
      return
    }
    setLoading(true)
    try {
      const payload = {
        depot: depot || 'ASR',
        entries: tanks.map(t => ({
          date:               shared.date,
          train_no:           shared.train_no,
          coach_no:           shared.coach_no,
          code:               shared.code,
          bio_tank_no:        t.bio_tank_no,
          ph:                 parsedNum(t.ph),
          cod:                parsedNum(t.cod),
          fcfc:               parsedNum(t.fcfc),
          second_test_date:   t.second_test_date   || null,
          second_test_result: t.second_test_result || null,
        })),
      }
      const res = await fetch('/api/entries/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      setSavedList(data.entries || [])
      // Reset tanks but keep date for quick next coach entry
      setTanks([emptyTank(0)])
      setShared(s => ({ ...s, coach_no: '', code: '' }))
      setEditId(null)
      onSuccess()
    } catch {
      setError('Failed to save entries. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Edit mode: enter ──────────────────────────────────────────────────────
  function enterEditMode(entry: SavedEntry) {
    setEditId(entry.id)
    setEditForm({
      date:               entry.date || '',
      train_no:           entry.train_no || '',
      coach_no:           entry.coach_no || '',
      code:               entry.code || '',
      bio_tank_no:        entry.bio_tank_no || '',
      ph:                 entry.ph  != null ? String(entry.ph)  : '',
      cod:                entry.cod != null ? String(entry.cod) : '',
      fcfc:               entry.fcfc != null ? String(entry.fcfc) : '',
      second_test_date:   entry.second_test_date   || '',
      second_test_result: entry.second_test_result || '',
    })
    setUpdateSuccess(false)
    setError('')
  }

  // ── Edit mode: submit ─────────────────────────────────────────────────────
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/entries/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, depot }),
      })
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      // Update entry in savedList
      setSavedList(prev => prev.map(e => e.id === editId ? data.entry : e))
      setUpdateSuccess(true)
      setEditId(null)
      onSuccess()
    } catch {
      setError('Failed to update entry.')
    } finally {
      setLoading(false)
    }
  }

  function cancelEdit() {
    setEditId(null); setEditForm({}); setError(''); setUpdateSuccess(false)
  }

  function startNewCoach() {
    setSavedList([]); setTanks([emptyTank(0)]); setShared(s => ({ ...s, coach_no: '', code: '' }))
  }

  function fullReset() {
    setSavedList([]); setTanks([emptyTank(0)]); setError('')
    setShared({ date: new Date().toISOString().split('T')[0], train_no: '', coach_no: '', code: '' })
  }

  // ─── Edit mode form ───────────────────────────────────────────────────────
  if (editId !== null) {
    const ph   = parsedNum(editForm.ph)
    const cod  = parsedNum(editForm.cod)
    const fcfc = parsedNum(editForm.fcfc)
    const previewResult = calculateResult(
      isNaN(ph ?? NaN) ? null : ph,
      isNaN(cod ?? NaN) ? null : cod,
      isNaN(fcfc ?? NaN) ? null : fcfc,
    )
    const ef = editForm
    const upd = (k: string, v: string) => { setEditForm(f => ({ ...f, [k]: v })); setUpdateSuccess(false) }

    return (
      <form onSubmit={handleUpdate} className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>
            ✏️ Edit Entry
            {previewResult !== 'PENDING' && (
              <span className={`badge badge-${previewResult.toLowerCase()}`} style={{ marginLeft: '.5rem', fontSize: '.75rem' }}>
                {previewResult === 'PASS' ? '✅ PASS' : '❌ FAIL'}
              </span>
            )}
          </h2>
          <button type="button" onClick={cancelEdit} className="btn-ghost" style={{ fontSize: '.8rem' }}>Cancel</button>
        </div>

        {error && (
          <div style={{ background: 'var(--fail-bg)', color: 'var(--fail)', padding: '.6rem 1rem', borderRadius: '.5rem', marginBottom: '1rem', fontSize: '.875rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {[
            { k: 'date',        label: 'Date',       type: 'date',   req: true  },
            { k: 'train_no',    label: 'Train No.',  type: 'text',   req: true  },
            { k: 'coach_no',    label: 'Coach No.',  type: 'text',   req: true  },
            { k: 'code',        label: 'Code',       type: 'text',   req: false },
            { k: 'bio_tank_no', label: 'Bio Tank No',type: 'text',   req: false },
          ].map(({ k, label, type, req }) => (
            <div key={k}>
              <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.35rem', textTransform: 'uppercase' }}>
                {label} {req && <span style={{ color: 'var(--fail)' }}>*</span>}
              </label>
              <input
                type={type} className="input-field" required={req}
                value={ef[k] || ''} onChange={e => upd(k, type === 'text' ? e.target.value.toUpperCase() : e.target.value)}
              />
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-input)', borderRadius: '.5rem', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>📊 Test Parameters</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
            {[
              { k: 'ph',   label: 'pH (6–9)',          warn: ef.ph   !== '' && ph   !== null ? (ph   < 6 || ph   > 9       ? '⚠ Out of range (6–9)'   : '✓ OK') : null, ok: ph   !== null && ph   >= 6 && ph   <= 9       },
              { k: 'cod',  label: 'COD (<1800)',        warn: ef.cod  !== '' && cod  !== null ? (cod  >= 1800              ? '⚠ Exceeds 1800'           : '✓ OK') : null, ok: cod  !== null && cod  < 1800              },
              { k: 'fcfc', label: 'FCFC (<10⁷)',        warn: ef.fcfc !== '' && fcfc !== null ? (fcfc >= 10000000          ? '⚠ Exceeds 10⁷'            : '✓ OK') : null, ok: fcfc !== null && fcfc < 10000000          },
            ].map(({ k, label, warn, ok }) => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.35rem', textTransform: 'uppercase' }}>{label}</label>
                <input type="number" step="0.1" min="0" className="input-field"
                  value={ef[k] || ''} onChange={e => upd(k, e.target.value)} />
                {warn && <p className={ok ? 'limit-ok' : 'limit-warn'} style={{ fontSize: '.65rem', marginTop: '.15rem' }}>{warn}</p>}
              </div>
            ))}
          </div>
        </div>

        {previewResult === 'FAIL' && (
          <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--fail-bg)', borderRadius: '.5rem', border: '1px solid var(--fail)' }}>
            <p style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--fail)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>🔁 2nd Test</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.35rem', textTransform: 'uppercase' }}>2nd Test Date</label>
                <input type="date" className="input-field" value={ef.second_test_date || ''} onChange={e => upd('second_test_date', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.35rem', textTransform: 'uppercase' }}>2nd Test Result</label>
                <select className="input-field" value={ef.second_test_result || ''} onChange={e => upd('second_test_result', e.target.value)}>
                  <option value="">-- Select --</option>
                  <option value="PASS">✅ PASS</option>
                  <option value="FAIL">❌ FAIL</option>
                  <option value="NA">NA (exempt)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
          <button type="submit" className="btn-primary" disabled={loading} style={{ minWidth: '140px' }}>
            {loading ? '⏳ Updating...' : '✅ Update Entry'}
          </button>
          <button type="button" className="btn-ghost" onClick={cancelEdit}>Cancel</button>
        </div>
      </form>
    )
  }

  // ─── New entry form ───────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Success banner (after batch save) ── */}
      {savedList.length > 0 && (
        <div style={{
          padding: '.875rem 1.25rem',
          borderRadius: '.625rem',
          border: '1.5px solid var(--pass)',
          background: 'var(--pass-bg)',
          display: 'flex', flexDirection: 'column', gap: '.75rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <p style={{ fontWeight: 700, color: 'var(--pass)', fontSize: '.9rem' }}>
                ✅ {savedList.length} {savedList.length === 1 ? 'entry' : 'entries'} saved!
              </p>
              <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
                Coach <strong style={{ color: 'var(--text)' }}>{savedList[0]?.coach_no}</strong>
                {' · '}Train <strong style={{ color: 'var(--text)' }}>{savedList[0]?.train_no}</strong>
                {' · '}{fmtDate(savedList[0]?.date)}
              </p>
            </div>
            <button
              onClick={() => setSavedList([])}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, padding: '0', flexShrink: 0 }}
            >×</button>
          </div>

          {/* Mini table of saved entries */}
          {savedList.length > 1 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--pass)' }}>
                    {['#S.No', 'Tank', 'pH', 'COD', 'FCFC', 'Result'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '.25rem .5rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: '.65rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {savedList.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid color-mix(in srgb, var(--pass) 25%, transparent)' }}>
                      <td style={{ padding: '.25rem .5rem', color: 'var(--primary)', fontWeight: 700 }}>#{e.s_no}</td>
                      <td style={{ padding: '.25rem .5rem' }}>{e.bio_tank_no || '—'}</td>
                      <td style={{ padding: '.25rem .5rem' }}>{e.ph ?? '—'}</td>
                      <td style={{ padding: '.25rem .5rem' }}>{e.cod ?? '—'}</td>
                      <td style={{ padding: '.25rem .5rem' }}>{e.fcfc ?? '—'}</td>
                      <td style={{ padding: '.25rem .5rem' }}>
                        <span className={`badge badge-${e.result.toLowerCase()}`} style={{ fontSize: '.65rem' }}>
                          {e.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={startNewCoach}
              style={{ padding: '.35rem .9rem', borderRadius: '.375rem', background: 'var(--pass)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '.8rem', cursor: 'pointer' }}
            >
              🚌 Next Coach
            </button>
            {savedList.map((e, i) => (
              <button
                key={e.id}
                onClick={() => enterEditMode(e)}
                style={{ padding: '.35rem .75rem', borderRadius: '.375rem', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '.78rem', cursor: 'pointer' }}
              >
                ✏️ Edit Tank {e.bio_tank_no || i + 1}
              </button>
            ))}
            <button
              onClick={() => setSavedList([])}
              style={{ padding: '.35rem .75rem', borderRadius: '.375rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '.78rem', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Main new entry form ── */}
      <form onSubmit={handleSubmit} className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          🧪 New Test Entry
          <span style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            — {tanks.length} tank{tanks.length !== 1 ? 's' : ''}
          </span>
        </h2>

        {error && (
          <div style={{ background: 'var(--fail-bg)', color: 'var(--fail)', padding: '.6rem 1rem', borderRadius: '.5rem', marginBottom: '1rem', fontSize: '.875rem' }}>
            {error}
          </div>
        )}

        {/* Shared fields */}
        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>
            🚃 Coach Details
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.35rem', textTransform: 'uppercase' }}>
                Date <span style={{ color: 'var(--fail)' }}>*</span>
              </label>
              <input
                type="date" className="input-field" required
                value={shared.date}
                onChange={e => setShared(s => ({ ...s, date: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.35rem', textTransform: 'uppercase' }}>
                Train No. <span style={{ color: 'var(--fail)' }}>*</span>
              </label>
              <input
                type="text" className="input-field" required placeholder="e.g. 14680"
                value={shared.train_no}
                onChange={e => setShared(s => ({ ...s, train_no: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.35rem', textTransform: 'uppercase' }}>
                Coach No. <span style={{ color: 'var(--fail)' }}>*</span>
              </label>
              <input
                type="text" className="input-field" required placeholder="e.g. 266035"
                value={shared.coach_no}
                onChange={e => setShared(s => ({ ...s, coach_no: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.35rem', textTransform: 'uppercase' }}>
                Code
              </label>
              <input
                type="text" className="input-field" placeholder="e.g. LWSCZ"
                value={shared.code}
                onChange={e => setShared(s => ({ ...s, code: e.target.value.toUpperCase() }))}
              />
            </div>
          </div>
        </div>

        {/* Tank rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', marginBottom: '1rem' }}>
          {tanks.map((tank, i) => (
            <TankCard
              key={i}
              index={i}
              tank={tank}
              onChange={changeTank}
              onRemove={removeTank}
              canRemove={tanks.length > 1}
            />
          ))}

          {/* Add tank button */}
          <button
            type="button"
            onClick={addTank}
            style={{
              width: '100%', padding: '.6rem',
              border: '2px dashed var(--border)', borderRadius: '.5rem',
              background: 'transparent', color: 'var(--primary)',
              fontWeight: 700, fontSize: '.875rem', cursor: 'pointer',
              transition: 'border-color .15s, background .15s',
            }}
          >
            + Add Tank
          </button>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="submit" className="btn-primary"
            disabled={loading}
            style={{ minWidth: '160px', opacity: loading ? .7 : 1 }}
          >
            {loading
              ? '⏳ Saving...'
              : tanks.length === 1
                ? '💾 Save Entry'
                : `💾 Save All ${tanks.length} Tanks`
            }
          </button>
          <button type="button" className="btn-ghost" onClick={fullReset}>↺ Reset</button>
        </div>
      </form>
    </div>
  )
}
