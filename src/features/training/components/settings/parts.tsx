import type { ReactNode } from 'react'

/** Kleine Bausteine, die nur die Einstellungen brauchen. */

export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      style={{
        margin: '22px 16px 7px', fontSize: 13, fontWeight: 600,
        letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--lg-text-3)',
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
        padding: 0, background: 'none', border: 'none', color: 'var(--lg-text)', textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{ flex: 1, fontWeight: 400, fontSize: 17 }}>{label}</span>
      <span
        aria-hidden="true"
        style={{
          // iOS-Schalter: grün an, grau aus — wie im Profil
          position: 'relative', width: 51, height: 31, borderRadius: 16, flexShrink: 0,
          background: checked ? 'var(--lg-good)' : 'rgba(120,120,128,0.32)',
          transition: 'background-color 200ms ease',
        }}
      >
        <span
          style={{
            position: 'absolute', top: 2, left: 2, width: 27, height: 27, borderRadius: '50%',
            background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
            transition: 'transform 260ms var(--lg-ease-out)',
          }}
        />
      </span>
    </button>
  )
}
