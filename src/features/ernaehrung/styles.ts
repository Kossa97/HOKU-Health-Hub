import type { CSSProperties } from 'react'

/** Farben nur über Theme-Variablen (src/index.css), damit Hell und Dunkel stimmen. */
export const MACRO_COLORS = {
  kcal: 'var(--accent)',
  protein: 'var(--cat-emerald)',
  carbs: 'var(--cat-violet)',
  fat: 'var(--cat-amber)',
  water: '#38bdf8',
} as const

export const card: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--card-border, var(--border))',
  boxShadow: 'var(--shadow-card)',
  borderRadius: 20,
}

export const label: CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

export const title: CSSProperties = { color: 'var(--text)', fontWeight: 800 }
export const dim: CSSProperties = { color: 'var(--text-dim)' }
export const muted: CSSProperties = { color: 'var(--text-muted)' }

export const input: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 14px',
  borderRadius: 14,
  background: 'var(--surface-input)',
  border: '1px solid var(--border-strong)',
  color: 'var(--text)',
  fontSize: 16,
  fontWeight: 600,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export const chip = (active: boolean): CSSProperties => ({
  minHeight: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-strong)'}`,
  background: active ? 'var(--accent-weak)' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--text-dim)',
  fontSize: '0.82rem',
  fontWeight: 700,
})

/** Gemeinsame Klasse für tippbare Flächen: Rückmeldung beim Aufsetzen, nicht erst beim Loslassen. */
export const PRESSABLE = 'select-none touch-manipulation transition-transform duration-100 ease-out active:scale-[0.97]'
