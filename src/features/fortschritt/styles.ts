import type { CSSProperties } from 'react'

export const panel: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 20,
}

export const sectionLabel: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 800,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

export const cardTitle: CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 800,
  color: 'var(--text-dim)',
  lineHeight: 1.1,
}

export const cardDelta: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  marginTop: 4,
}

export const SLIDER_CSS = `
  input.tyd-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 6px;
    border-radius: 99px; background: var(--border); outline: none; }
  input.tyd-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
    width: 20px; height: 20px; border-radius: 50%; background: #00ccf5; cursor: pointer;
    border: 2px solid var(--surface); box-shadow: 0 0 10px rgba(0,204,245,0.5); }
  input.tyd-slider::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%;
    background: #00ccf5; cursor: pointer; border: 2px solid var(--surface);
    box-shadow: 0 0 10px rgba(0,204,245,0.5); }
`

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 14,
  background: 'var(--surface-input)',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: '0.9rem',
  fontWeight: 700,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export const fieldLabel: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: 6,
}
