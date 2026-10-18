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
          <p style={{ fontSize: '0.88rem', color: 'var(--text-dim)' }}>{tt('progress_muscle_empty')}</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 650, marginBottom: 10 }}>
              <span aria-hidden="true" style={{ width: 14, height: 10, borderRadius: 2, background: 'var(--border)', borderLeft: '1px solid var(--border-strong)', borderRight: '1px solid var(--border-strong)' }} />
              {tt('progress_muscle_band')}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map(row => {
                const label = tt(`muscle_${row.muscle}`)
                const value = formatNumber(row.sets, locale, 1)
                return (
                  <li
                    key={row.muscle}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7.5rem) minmax(0, 1fr) 2.6rem', alignItems: 'center', gap: 10, minHeight: 24 }}
                  >
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                    <span aria-hidden="true" style={{ position: 'relative', height: 20, display: 'block' }}>
                      <span style={{ position: 'absolute', top: 0, bottom: 0, left: pct(BAND_LOW), width: pct(BAND_HIGH - BAND_LOW), background: 'var(--border)', borderLeft: '1px solid var(--border-strong)', borderRight: '1px solid var(--border-strong)' }} />
                      <span style={{ position: 'absolute', top: 4, height: 12, left: 0, width: pct(row.sets), minWidth: 3, background: TRAINING_ACCENT, borderRadius: '0 4px 4px 0' }} />
                    </span>
                    <span title={tt('progress_sets_value', { count: value })} style={{ fontSize: '0.82rem', fontWeight: 750, color: 'var(--text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                  </li>
                )
              })}
            </ul>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.4 }}>{tt('progress_muscle_hint')}</p>
          </>
        )}
      </Card>
    </section>
  )
}
