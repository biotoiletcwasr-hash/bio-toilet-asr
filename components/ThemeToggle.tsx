'use client'
import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

const THEMES: { key: Theme; label: string; icon: string }[] = [
  { key: 'light', label: 'Light', icon: '☀️' },
  { key: 'dark',  label: 'Dark',  icon: '🌙' },
]

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Theme) || 'light'
    setTheme(saved)
    document.documentElement.className = saved
  }, [])

  const switchTheme = (t: Theme) => {
    setTheme(t)
    document.documentElement.className = t
    localStorage.setItem('theme', t)
  }

  return (
    <div style={{
      display: 'flex',
      gap: '.25rem',
      background: 'var(--bg-input)',
      padding: '.25rem',
      borderRadius: '.5rem',
      border: '1px solid var(--border)',
    }}>
      {THEMES.map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => switchTheme(key)}
          title={label}
          style={{
            padding: '.3rem .7rem',
            borderRadius: '.375rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '.8rem',
            fontWeight: 600,
            background: theme === key ? 'var(--primary)' : 'transparent',
            color: theme === key ? 'var(--primary-fg)' : 'var(--text-muted)',
            transition: 'all .2s',
            display: 'flex',
            alignItems: 'center',
            gap: '.3rem',
          }}
        >
          {icon} {label}
        </button>
      ))}
    </div>
  )
}
