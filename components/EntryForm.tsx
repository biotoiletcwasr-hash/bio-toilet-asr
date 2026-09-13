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

export default function EntryForm({ onSuccess }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ph   = parseFloat(form.ph)
  const cod  = parseFloat(form.cod)
  const fcfc = parseFloat(form.fcfc)

  const previewResult = calculateResult(
    isNaN(ph)   ? null : ph,
    isNaN(cod)  ? null : cod,
    isNaN(fcfc) ? null : fcfc,
  )

  const needsSecondTest = previewResult === 'FAIL'

  const update = (k: string, v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.date || !form.train_no || !form.coach_no) {
      setError('Date, Train No aur Coach No zaroori hain')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Server error')
      setForm({ ...EMPTY, date: form.date })
      onSuccess()
    } catch {
      setError('Entry save nahi hui. Dobara try karein.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: '1.5rem' }}>
      <h2 style={{
        fontSize: '1rem', fontWeight: 700, color: 'var(--text)',
        marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '.5rem'
      }}>
        🧪 Naya Test Entry
        {previewResult !== 'PENDING' && (
          <span className={`badge badge-${previewResult.toLowerCase()}`}>
            {previewResult === 'PASS' ? '✅ PASS' : '❌ FAIL'}
          </span>
        )}
      </h2>

      {error && (
        <div style={{
          background: 'var(--fail-bg)', color: 'var(--fail)',
          padding: '.6rem 1rem', borderRadius: '.5rem',
          marginBottom: '1rem', fontSize: '.875rem',
        }}>{error}</div>
      )}

      {/* Row 1 – Basic info */}
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
            placeholder="e.g. 12031"
            value={form.train_no}
            onChange={e => update('train_no', e.target.value.toUpperCase())}
            required
          />
        </Field>

        <Field label="Coach No." required>
          <input
            type="text" className="input-field"
            placeholder="e.g. B1, S2"
            value={form.coach_no}
            onChange={e => update('coach_no', e.target.value.toUpperCase())}
            required
          />
        </Field>

        <Field label="Code">
          <input
            type="text" className="input-field"
            placeholder="e.g. ASR"
            value={form.code}
            onChange={e => update('code', e.target.value.toUpperCase())}
          />
        </Field>

        <Field label="Bio Tank No.">
          <input
            type="text" className="input-field"
            placeholder="e.g. T-1"
            value={form.bio_tank_no}
            onChange={e => update('bio_tank_no', e.target.value)}
          />
        </Field>
      </div>

      {/* Row 2 – Test parameters */}
      <div style={{
        marginTop: '1.25rem',
        padding: '1rem',
        background: 'var(--bg-input)',
        borderRadius: '.625rem',
        border: '1px solid var(--border)',
      }}>
        <p style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '.75rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          📊 Test Parameters
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
          <Field label={`pH (Limit: 6–9)`}>
            <input
              type="number" step="0.1" min="0" max="14"
              className="input-field"
              placeholder="e.g. 7.5"
              value={form.ph}
              onChange={e => update('ph', e.target.value)}
            />
            {form.ph !== '' && (
              <p className={ph >= 6 && ph <= 9 ? 'limit-ok' : 'limit-warn'}>
                {ph >= 6 && ph <= 9 ? '✓ Within limit' : `⚠ Out of range (6–9)`}
              </p>
            )}
          </Field>

          <Field label="COD (Limit: <1800 mgO₂/L)">
            <input
              type="number" step="0.1" min="0"
              className="input-field"
              placeholder="e.g. 350"
              value={form.cod}
              onChange={e => update('cod', e.target.value)}
            />
            {form.cod !== '' && (
              <p className={cod < 1800 ? 'limit-ok' : 'limit-warn'}>
                {cod < 1800 ? '✓ Within limit' : '⚠ Exceeds 1800'}
              </p>
            )}
          </Field>

          <Field label="FCFC (Limit: <107 MPN/100ml)">
            <input
              type="number" step="0.1" min="0"
              className="input-field"
              placeholder="e.g. 45"
              value={form.fcfc}
              onChange={e => update('fcfc', e.target.value)}
            />
            {form.fcfc !== '' && (
              <p className={fcfc < 107 ? 'limit-ok' : 'limit-warn'}>
                {fcfc < 107 ? '✓ Within limit' : '⚠ Exceeds 107'}
              </p>
            )}
          </Field>
        </div>
      </div>

      {/* Row 3 – 2nd test (only if FAIL) */}
      {needsSecondTest && (
        <div style={{
          marginTop: '1.25rem',
          padding: '1rem',
          background: 'var(--fail-bg)',
          borderRadius: '.625rem',
          border: '1px solid var(--fail)',
        }}>
          <p style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--fail)', marginBottom: '.75rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
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

      <div style={{ marginTop: '1.25rem', display: 'flex', gap: '.75rem', alignItems: 'center' }}>
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ minWidth: '140px' }}
        >
          {loading ? '⏳ Saving...' : '💾 Save Entry'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setForm({ ...EMPTY, date: form.date })}
        >
          ↺ Reset
        </button>
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
        display: 'block',
        fontSize: '.75rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        marginBottom: '.35rem',
        textTransform: 'uppercase',
        letterSpacing: '.04em',
      }}>
        {label} {required && <span style={{ color: 'var(--fail)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}
