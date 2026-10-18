import type { ReactNode } from 'react'

/**
 * Kleine Bausteine, die alle Fortschritts-Charts teilen. Text traegt immer
 * Text-Farben (`--text`, `--text-dim`); die Datenfarbe steckt nur im Strich davor.
 */

/** Tooltip-Kasten: Wert vorn und kraeftig, Bezeichnung dahinter, Serie als kurzer Strich. */
export function TooltipBox({ title, rows }: {
  title: string
  rows: Array<{ key: string; color?: string; value: string; label?: string }>
}) {
  return (
    <div
      style={{
        background: 'var(--surface-raised)', border: '1px solid var(--border-strong)',
        borderRadius: 12, padding: '8px 10px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        fontSize: '0.78rem', color: 'var(--text)', minWidth: 120, maxWidth: 220,
      }}
    >
      <div style={{ color: 'var(--text-dim)', fontWeight: 650, marginBottom: 4 }}>{title}</div>
      {rows.map(row => (
        <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {row.color && <span aria-hidden="true" style={{ width: 10, height: 2, borderRadius: 1, background: row.color, flexShrink: 0 }} />}
          <strong style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{row.value}</strong>
          {row.label && (
            <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}

/** Tabellen-Zwilling eines Charts: jeder Wert ohne Hover erreichbar. */
export function TableView({ summary, head, rows }: {
  summary: string
  head: string[]
  rows: Array<{ key: string; cells: ReactNode[] }>
}) {
  return (
    <details style={{ marginTop: 8 }}>
      <summary
        className="tyd-train-press"
        style={{
          minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer',
          fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', listStyle: 'revert',
        }}
      >
        {summary}
      </summary>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              {head.map((cell, i) => (
                <th key={i} scope="col" style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 4px', color: 'var(--text-dim)', fontWeight: 700, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key}>
                {row.cells.map((cell, i) => (
                  <td key={i} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 4px', color: i === 0 ? 'var(--text-dim)' : 'var(--text)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/** Legenden-Eintrag: Form wie die Marke (Rechteck fuer Balken, Strich fuer Linien). */
export function LegendItem({ color, label, shape = 'rect' }: { color: string; label: string; shape?: 'rect' | 'line' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 650, minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={shape === 'rect'
          ? { width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }
          : { width: 14, height: 2, borderRadius: 1, background: color, flexShrink: 0 }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </span>
  )
}
