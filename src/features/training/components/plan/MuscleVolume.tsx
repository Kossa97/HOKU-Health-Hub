import type { MuscleGroup } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import { SETS_BAND, SETS_SCALE_MAX } from '../../lib/muscleVolume'
import { TRAINING_ACCENT } from '../ui'

/**
 * Liegende Balken „Saetze je Muskel" mit dem hinterlegten Band 10–20 pro
 * Woche. Der Wert steht als Text am Zeilenende (kein Tooltip noetig); die
 * Farbe sagt, wo die Wochenzahl liegt: unter dem Band blass, im Band
 * Akzent, darueber rot. Benutzt im Editor (Routine × Wochentage) und auf
 * „Heute" (laufende Woche).
 */

export interface MuscleBarRow {
  muscle: MuscleGroup
  /** Fertig formatierter Text am Zeilenende, z. B. „3 · 6/Wo". */
  label: string
  /** Wochenwert — bestimmt Balkenlaenge und Farbe. */
  week: number
}

const OVER_COLOR = '#f43f5e'

function barColor(week: number): string {
  if (week > SETS_BAND.high) return OVER_COLOR
  if (week < SETS_BAND.low) return `${TRAINING_ACCENT}8c`
  return TRAINING_ACCENT
}

export function MuscleBars({ rows }: { rows: readonly MuscleBarRow[] }) {
  const { tt } = useTrainingText()
  const max = Math.max(SETS_SCALE_MAX, ...rows.map(r => r.week))
  const pct = (value: number) => `${Math.min(100, (value / max) * 100)}%`
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map(row => (
        <li
          key={row.muscle}
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7.5em) minmax(0, 1fr) auto', alignItems: 'center', gap: 10, minHeight: 22, fontSize: '0.82rem', fontWeight: 650 }}
        >
          <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tt(`muscle_${row.muscle}` as TrainingTextKey)}
          </span>
          <span aria-hidden="true" style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--surface-raised)', overflow: 'hidden', display: 'block' }}>
            <span style={{ position: 'absolute', top: 0, bottom: 0, left: pct(SETS_BAND.low), width: pct(SETS_BAND.high - SETS_BAND.low), background: 'var(--border-strong)' }} />
            <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: pct(row.week), minWidth: row.week > 0 ? 3 : 0, borderRadius: 4, background: barColor(row.week), transition: 'width 180ms ease-out' }} />
          </span>
          <span style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem', textAlign: 'right', whiteSpace: 'nowrap' }}>{row.label}</span>
        </li>
      ))}
    </ul>
  )
}

/** Kleine Legende: das Band als Kaestchen plus Richtwert-Text. */
export function BandLegend() {
  const { tt } = useTrainingText()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 650 }}>
      <span aria-hidden="true" style={{ width: 14, height: 8, borderRadius: 2, background: 'var(--border-strong)' }} />
      {tt('sets_guide')}
    </span>
  )
}
