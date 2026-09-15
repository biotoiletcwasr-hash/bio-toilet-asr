'use client'
import { useState } from 'react'
import { LIMITS, calculateResult } from '@/lib/types'

interface Props {
  onSuccess: () => void
}

const EMPTY: Record<string, string> = {
  date: new Date().toISOString().split('T')[0],
  train_no: '',
  coach_no: '',
  code: '',
  bio_tank_no: '',
  ph: '',
  cod: '',
  fcfc: '',
  second_test_date: '',
  second_test_result: '',
}

type SavedInfo = {
  id: number
  s_no: number
  coach_no: string
  train_no: string
  date: string
  ph: number | null
  cod: number | null
  fcfc: number | null
  result: string
  code: string
  bio_tank_no: string
  second_test_date: string | null
  second_test_result: string | null
}

export default function EntryForm({ onSuccess }: Props) {
  const [form, setForm]               = useState(EMPTY)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [savedInfo, setSavedInfo]     = useState<SavedInfo | null>(null)
  const [editId, setEditId]           = useState<number | null>(null)   // non-null = edit mode
  const [updateSuccess, setUpdateSuccess] = useState(false)

  const ph   = parseFloat(form.ph)
  const cod  = parseFloat(form.cod)
  const fcfc = parseFloat(form.fcfc)

  const previewResult = calculateResult(
    isNaN(ph)   ? null : ph,
    isNaN(cod)  ? null : cod,
    isNaN(fcfc) ? null : fcfc,
  )

  const needsSecondTest = previewResult === 'FAIL'
  const isEditMode = editId !== null

  const update = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    setUpdateSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.date || !form.train_no || !form.coach_no) {
      setError('Date, Train No and Coach No are required.')
      return
    }
    setLoading(true)
    try {
      const url    = isEditMode ? `/api/entries/${editId}` : '/api/entries'
      const method = isEditMode ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      const entry = data.entry as SavedInfo

      if (isEditMode) {
        // Edit completed — show update success, stay in edit mode but unlock
        setSavedInfo(entry)
        setUpdateSuccess(true)
        setEditId(null)
        onSuccess()        // refresh data table
      } else {
        // New entry saved
        setSavedInfo(entry)
        setForm({ ...EMPTY, date: form.date })
        onSuccess()        // refresh data table (without switching tab)
      }
    } catch {
      setError('Failed to save entry. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function enterEditMode() {
    if (!savedInfo) return
    setForm({
      date:               savedInfo.date || '',
      train_no:           savedInfo.train_no || '',
      coach_no:           savedInfo.coach_no || '',
      code:               savedInfo.code || '',
      bio_tank_no:        savedInfo.bio_tank_no || '',
      ph:                 savedInfo.ph  != null ? String(savedInfo.ph)  : '',
      cod:                savedInfo.cod != null ? String(savedInfo.cod) : '',
      fcfc:               savedInfo.fcfc != null ? String(savedInfo.fcfc) : '',
      second_test_date:   savedInfo.second_test_date   || '',
      second_test_result: savedInfo.second_test_result || '',
    })
    setEditId(savedInfo.id)
    setUpdateSuccess(false)
    setError('')
  }

  function startNewEntry() {
    setForm({ ...EMPTY, date: form.date })
    setSavedInfo(null)
    setEditId(null)
    setUpdateSuccess(false)
    setError('')
  }

  function fmtDate(iso: string | null | undefined) {
    if (!iso) return '—'
    const p = iso.split('-')
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : iso
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: '1.5rem' }}>

      {/* ── Title ── */}
      <h2 style={{
        fontSize: '1rem', fontWeight: 700, color: 'var(--text)',
        marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem',
      }}>
        {isEditMode
          ? <>✏️ Edit Entry <span style={{ color: 'var(--primary)', fontWeight: 800 }}>#{savedInfo?.s_no}</span></>
          : <>🧪 New Test Entry</>
        }
        {previewResult !== 'PENDING' && (
          <span className={`badge badge-${previewResult.toLowerCase()}`}>
            {previewResult === 'PASS' ? '✅ PASS' : '❌ FAIL'}
          </span>
        )}
      </h2>

      {/* ── Saved / Updated banner ── */}
      {savedInfo && !isEditMode && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '.75rem',
          padding: '.75rem 1rem', borderRadius: '.5rem',
          background: updateSuccess ? 'var(--pass-bg)' : 'var(--pass-bg)',
          border: '1.5px solid var(--pass)',
          marginBottom: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1rem' }}>{updateSuccess ? '✅' : '✅'}</span>
            <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--pass)' }}>
              {updateSuccess
                ? `Entry #${savedInfo.s_no} updated!`
                : `Entry #${savedInfo.s_no} saved!`
              }
            </span>
            <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
              Coach <strong style={{ color: 'var(--text)' }}>{savedInfo.coach_no}</strong>
              {' · '}Train <strong style={{ color: 'var(--text)' }}>{savedInfo.train_no}</strong>
              {' · '}{fmtDate(savedInfo.date)}
              {' · '}
              <span className={`badge badge-${savedInfo.result.toLowerCase()}`} style={{ fontSize: '.7rem' }}>
                {savedInfo.result}
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button
              type="button"
              onClick={enterEditMode}
              style={{
                padding: '.35rem .8rem', borderRadius: '.375rem',
                background: 'var(--primary)', color: '#fff',
                border: 'none', fontWeight: 600, fontSize: '.8rem',
                cursor: 'pointer',
              }}
            >
              ✏️ Edit
            </button>
            <button
              type="button"
              onClick={startNewEntry}
              style={{
                padding: '.35rem .8rem', borderRadius: '.375rem',
                background: 'transparent', color: 'var(--text-muted)',
                border: '1px solid var(--border)', fontWeight: 600, fontSize: '.8rem',
                cursor: 'pointer',
              }}
            >
              ✕ Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Edit mode notice ── */}
      {isEditMode && (
        <div style={{
          padding: '.6rem 1rem', borderRadius: '.5rem',
          background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
          border: '1.5px solid var(--primary)',
          marginBottom: '1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem',
        }}>
          <span style={{ fontSize: '.82rem', color: 'var(--primary)', fontWeight: 600 }}>
            ✏️ Editing Entry #{savedInfo?.s_no} — Coach {savedInfo?.coach_no}, Train {savedInfo?.train_no}
          </span>
          <button
            type="button"
            onClick={startNewEntry}
            style={{
              padding: '.25rem .65rem', borderRadius: '.3rem',
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid var(--border)', fontWeight: 600, fontSize: '.75rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: 'var(--fail-bg)', color: 'var(--fail)',
          padding: '.6rem 1rem', borderRadius: '.5rem',
          marginBottom: '1rem', fontSize: '.875rem',
        }}>{error}</div>
      )}

      {/* ── Row 1: Basic info ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        <Field label="Date" required>
          <input
            type="date" className="input-field"
            value={form.date}
            onChange={e => update('date', e.target.value)}
            required
          />
        </Field>

        <Field label="Train No." required>
          <input
            type="text" className="input-field"
            placeholder=""
            value={form.train_no}
            onChange={e => update('train_no', e.target.value.toUpperCase())}
            required
          />
        </Field>

        <Field label="Coach No." required>
          <input
            type="text" className="input-field"
            placeholder=""
            value={form.coach_no}
            onChange={e => update('coach_no', e.target.value.toUpperCase())}
            required
          />
        </Field>

        <Field label="Code">
          <input
            type="text" className="input-field"
            placeholder=""
            value={form.code}
            onChange={e => update('code', e.target.value.toUpperCase())}
          />
        </Field>

        <Field label="Bio Tank No.">
          <input
            type="text" className="input-field"
            placeholder=""
            value={form.bio_tank_no}
            onChange={e => update('bio_tank_no', e.target.value)}
          />
        </Field>
      </div>

      {/* ── Row 2: Test parameters ── */}
      <div style={{
        marginTop: '1.25rem', padding: '1rem',
        background: 'var(--bg-input)', borderRadius: '.625rem',
        border: '1px solid var(--border)',
      }}>
        <p style={{
          fontSize: '.75rem', fontWeight: 700, color: 'var(--text-muted)',
          marginBottom: '.75rem', textTransform: 'uppercase', letterSpacing: '.06em',
        }}>
          📊 Test Parameters
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
          <Field label="pH (Limit: 6–9)">
            <input
              type="number" step="0.1" min="0" max="14"
              className="input-field" placeholder=""
              value={form.ph}
              onChange={e => update('ph', e.target.value)}
            />
            {form.ph !== '' && (
              <p className={ph >= 6 && ph <= 9 ? 'limit-ok' : 'limit-warn'}>
                {ph >= 6 && ph <= 9 ? '✓ Within limit' : '⚠ Out of range (6–9)'}
              </p>
            )}
          </Field>

          <Field label="COD (Limit: <1800 mgO₂/L)">
            <input
              type="number" step="0.1" min="0"
              className="input-field" placeholder=""
              value={form.cod}
              onChange={e => update('cod', e.target.value)}
            />
            {form.cod !== '' && (
              <p className={cod < 1800 ? 'limit-ok' : 'limit-warn'}>
                {cod < 1800 ? '✓ Within limit' : '⚠ Exceeds 1800'}
              </p>
            )}
          </Field>

          <Field label="FCFC (Limit: <10⁷ MPN/100ml)">
            <input
              type="number" step="0.1" min="0"
              className="input-field" placeholder=""
              value={form.fcfc}
              onChange={e => update('fcfc', e.target.value)}
            />
            {form.fcfc !== '' && (
              <p className={fcfc < 10000000 ? 'limit-ok' : 'limit-warn'}>
                {fcfc < 10000000 ? '✓ Within limit' : '⚠ Exceeds 10⁷'}
              </p>
            )}
          </Field>
        </div>
      </div>

      {/* ── Row 3: 2nd test (if FAIL) ── */}
      {needsSecondTest && (
        <div style={{
          marginTop: '1.25rem', padding: '1rem',
          background: 'var(--fail-bg)', borderRadius: '.625rem',
          border: '1px solid var(--fail)',
        }}>
          <p style={{
            fontSize: '.75rem', fontWeight: 700, color: 'var(--fail)',
            marginBottom: '.75rem', textTransform: 'uppercase', letterSpacing: '.06em',
          }}>
            🔁 2nd Test (Required – 1st Test Failed)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            <Field label="2nd Test Date">
              <input
                type="date" className="input-field"
                value={form.second_test_date}
                onChange={e => update('second_test_date', e.target.value)}
              />
            </Field>
            <Field label="2nd Test Result">
              <select
                className="input-field"
                value={form.second_test_result}
                onChange={e => update('second_test_result', e.target.value)}
              >
                <option value="">-- Select --</option>
                <option value="PASS">✅ PASS</option>
                <option value="FAIL">❌ FAIL</option>
              </select>
            </Field>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ marginTop: '1.25rem', display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ minWidth: '150px', opacity: loading ? .7 : 1 }}
        >
          {loading
            ? '⏳ Saving...'
            : isEditMode
              ? '✅ Update Entry'
              : '💾 Save Entry'
          }
        </button>

        {isEditMode && (
          <button
            type="button"
            className="btn-ghost"
            onClick={startNewEntry}
          >
            Cancel
          </button>
        )}

        {!isEditMode && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setForm({ ...EMPTY, date: form.date })}
          >
            ↺ Reset
          </button>
        )}
      </div>
    </form>
  )
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: '.75rem', fontWeight: 600,
        color: 'var(--text-muted)', marginBottom: '.35rem',
        textTransform: 'uppercase', letterSpacing: '.04em',
      }}>
        {label} {required && <span style={{ color: 'var(--fail)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}
