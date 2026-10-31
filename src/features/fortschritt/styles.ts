import type { CSSProperties } from 'react'

export const panel: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
}

export const sectionLabel: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'var(--text-muted)',
}

export const cardTitle: CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 500,
  color: 'var(--text-dim)',
  lineHeight: 1.1,
}

export const cardDelta: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 400,
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--text-muted)',
  marginTop: 4,
}

export const SLIDER_CSS = `
  input.tyd-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 6px;
    border-radius: 99px; background: var(--border); outline: none; }
  input.tyd-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
    width: 20px; height: 20px; border-radius: 50%; background: var(--accent); cursor: pointer;
    border: 2px solid var(--surface); box-shadow: 0 1px 4px rgba(0,0,0,0.35); }
  input.tyd-slider::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%;
    background: var(--accent); cursor: pointer; border: 2px solid var(--surface);
    box-shadow: 0 1px 4px rgba(0,0,0,0.35); }
`

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 12,
  background: 'var(--surface-input)',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: '0.9rem',
  fontWeight: 500,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export const fieldLabel: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: 8,
}
