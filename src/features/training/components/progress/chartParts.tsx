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
        background: 'var(--lg-sheet-solid)', border: '0.5px solid var(--lg-separator)',
        borderRadius: 12, padding: '8px 10px', boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        fontSize: 12, color: 'var(--lg-text)', minWidth: 120, maxWidth: 220,
      }}
    >
      <div style={{ color: 'var(--lg-text-3)', fontWeight: 500, marginBottom: 4 }}>{title}</div>
      {rows.map(row => (
        <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {row.color && <span aria-hidden="true" style={{ width: 10, height: 2, borderRadius: 1, background: row.color, flexShrink: 0 }} />}
          <strong style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{row.value}</strong>
          {row.label && (
            <span style={{ color: 'var(--lg-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
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
          fontSize: 13, fontWeight: 600, color: 'var(--lg-text-3)', listStyle: 'revert',
        }}
      >
        {summary}
      </summary>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              {head.map((cell, i) => (
                <th key={i} scope="col" style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 4px', color: 'var(--lg-text-3)', fontWeight: 600, borderBottom: '0.5px solid var(--lg-separator)', whiteSpace: 'nowrap' }}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key}>
                {row.cells.map((cell, i) => (
                  <td key={i} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 4px', color: i === 0 ? 'var(--lg-text-3)' : 'var(--lg-text)', borderBottom: '0.5px solid var(--lg-separator)', whiteSpace: 'nowrap' }}>{cell}</td>
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--lg-text-3)', fontWeight: 500, minWidth: 0 }}>
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
