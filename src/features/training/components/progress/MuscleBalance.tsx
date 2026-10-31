import { useMemo } from 'react'
import type { CustomExercise, TrainingSession } from '../../types'
import { formatNumber } from '../../lib/format'
import { useTrainingText } from '../../i18n'
import { Card, SectionTitle, TRAINING_ACCENT } from '../ui'
import { muscleBalance } from './progressModel'

/**
 * Arbeitssaetze je Muskel der letzten 7 Tage als liegende Balken. Eine Reihe,
 * eine Farbe; jeder Wert steht am Balkenende, also braucht es keinen Tooltip.
 * Der Bereich 10–20 ist hinterlegt — als Orientierung, nicht als Ziel.
 */

const BAND_LOW = 10
const BAND_HIGH = 20

export function MuscleBalance({ sessions, custom, now }: {
  sessions: readonly TrainingSession[]
  custom: readonly CustomExercise[]
  now: Date
}) {
  const { tt, locale } = useTrainingText()
  const rows = useMemo(() => muscleBalance(sessions, custom, now), [sessions, custom, now])
  const max = Math.max(BAND_HIGH + 4, ...rows.map(r => r.sets))
  const pct = (value: number) => `${(value / max) * 100}%`

  return (
    <section aria-labelledby="progress-muscle-title">
      <SectionTitle><span id="progress-muscle-title">{tt('progress_muscle_title')}</span></SectionTitle>
      <Card>
        {rows.length === 0 ? (
          <p style={{ fontSize: 15, color: 'var(--lg-text-3)' }}>{tt('progress_muscle_empty')}</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--lg-text-3)', fontWeight: 400, marginBottom: 12 }}>
              <span aria-hidden="true" style={{ width: 16, height: 8, borderRadius: 2, background: 'var(--lg-separator)', borderLeft: '1px solid var(--lg-separator)', borderRight: '1px solid var(--lg-separator)' }} />
              {tt('progress_muscle_band')}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map(row => {
                const label = tt(`muscle_${row.muscle}`)
                const value = formatNumber(row.sets, locale, 1)
                return (
                  <li
                    key={row.muscle}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7.5rem) minmax(0, 1fr) 2.6rem', alignItems: 'center', gap: 12, minHeight: 24 }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--lg-text-2)', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                    <span aria-hidden="true" style={{ position: 'relative', height: 20, display: 'block' }}>
                      <span style={{ position: 'absolute', top: 0, bottom: 0, left: pct(BAND_LOW), width: pct(BAND_HIGH - BAND_LOW), background: 'var(--lg-separator)', borderLeft: '1px solid var(--lg-separator)', borderRight: '1px solid var(--lg-separator)' }} />
                      <span style={{ position: 'absolute', top: 4, height: 12, left: 0, width: pct(row.sets), minWidth: 3, background: TRAINING_ACCENT, borderRadius: '0 4px 4px 0' }} />
                    </span>
                    <span title={tt('progress_sets_value', { count: value })} style={{ fontSize: 12, fontWeight: 400, fontFamily: 'var(--font-mono)', color: 'var(--lg-text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                  </li>
                )
              })}
            </ul>
            <p style={{ fontSize: 12, color: 'var(--lg-text-3)', marginTop: 12, lineHeight: 1.4 }}>{tt('progress_muscle_hint')}</p>
          </>
        )}
      </Card>
    </section>
  )
}
