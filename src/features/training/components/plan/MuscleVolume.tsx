import type { MuscleGroup } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import { SETS_BAND, SETS_SCALE_MAX } from '../../lib/muscleVolume'
import { TRAINING_ACCENT } from '../ui'
import { trainingTint } from '../accent'

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

const OVER_COLOR = 'var(--lg-bad)'

function barColor(week: number): string {
  if (week > SETS_BAND.high) return OVER_COLOR
  if (week < SETS_BAND.low) return trainingTint(55)
  return TRAINING_ACCENT
}

export function MuscleBars({ rows }: { rows: readonly MuscleBarRow[] }) {
  const { tt } = useTrainingText()
  const max = Math.max(SETS_SCALE_MAX, ...rows.map(r => r.week))
  const pct = (value: number) => `${Math.min(100, (value / max) * 100)}%`
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(row => (
        <li
          key={row.muscle}
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7.5em) minmax(0, 1fr) auto', alignItems: 'center', gap: 12, minHeight: 24, fontSize: 13, fontWeight: 400 }}
        >
          <span style={{ color: 'var(--lg-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tt(`muscle_${row.muscle}` as TrainingTextKey)}
          </span>
          <span aria-hidden="true" className="hk-scale" style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--lg-fill)', overflow: 'hidden', display: 'block' }}>
            <span style={{ position: 'absolute', top: 0, bottom: 0, left: pct(SETS_BAND.low), width: pct(SETS_BAND.high - SETS_BAND.low), background: 'var(--lg-separator)' }} />
            {/* Länge per scaleX (kein Layout je Bild); ein kleiner Rest bleibt sichtbar, sobald es Sätze gibt */}
            <span style={{ position: 'absolute', inset: 0, transformOrigin: 'left', transform: `scaleX(${row.week > 0 ? Math.max(0.03, Math.min(1, row.week / max)) : 0})`, background: barColor(row.week), transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
          </span>
          <span style={{ color: 'var(--lg-text-3)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>{row.label}</span>
        </li>
      ))}
    </ul>
  )
}

/** Kleine Legende: das Band als Kaestchen plus Richtwert-Text. */
export function BandLegend() {
  const { tt } = useTrainingText()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--lg-text-3)', fontWeight: 400 }}>
      <span aria-hidden="true" style={{ width: 16, height: 8, borderRadius: 2, background: 'var(--lg-separator)' }} />
      {tt('sets_guide')}
    </span>
  )
}
