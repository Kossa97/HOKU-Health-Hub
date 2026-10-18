import type { ReactNode } from 'react'
import { TRAINING_ACCENT } from '../ui'

/** Kleine Bausteine, die nur die Einstellungen brauchen. */

export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      style={{
        margin: '18px 2px 8px', fontSize: '0.78rem', fontWeight: 800,
        letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)',
      }}
    >
      {children}
    </h3>
  )
}

/** Schalter mit Beschriftung; die ganze Zeile ist die Tippflaeche (min. 44 px). */
export function Switch({ checked, onChange, label, disabled }: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="tyd-train-press"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 44,
        padding: 0, background: 'none', border: 'none', color: 'var(--text)', textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{ flex: 1, fontWeight: 700, fontSize: '0.92rem' }}>{label}</span>
      <span
        aria-hidden="true"
        style={{
          position: 'relative', width: 50, height: 30, borderRadius: 999, flexShrink: 0,
          background: checked ? TRAINING_ACCENT : 'var(--surface-raised)',
          border: `1px solid ${checked ? 'transparent' : 'var(--border-strong)'}`,
          transition: 'background 160ms ease-out',
        }}
      >
        <span
          style={{
            position: 'absolute', top: 2, left: 2, width: 24, height: 24, borderRadius: 999,
            background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
            transition: 'transform 200ms cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </span>
    </button>
  )
}
