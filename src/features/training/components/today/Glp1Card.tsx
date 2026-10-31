import { useMemo } from 'react'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { glp1Insight } from '../../lib/glp1'
import { formatNumber } from '../../lib/format'
import { Card, Stat } from '../ui'

const STATUS_COLOR = { good: 'var(--lg-good)', neutral: 'var(--accent)', watch: 'var(--lg-warn)', insufficient: 'var(--lg-text-3)' } as const
/** Schrift in der hellen Variante — lesbar auf Schwarz */
const STATUS_TEXT = { good: 'var(--lg-good-text)', neutral: 'var(--lg-accent-text)', watch: 'var(--lg-warn-text)', insufficient: 'var(--lg-text-2)' } as const

/**
 * GLP-1-Ansicht: Kraft gegen Gewicht der letzten 8 Wochen, Trainingsumfang,
 * Training nach Tag seit der Injektion, Eiweiss (sobald der Kalorientracker
 * es liefert). Immer mit dem Hinweis, dass es eine Beobachtung ist.
 */
export function Glp1Card({ data, now, avgProteinG = null }: { data: TrainingData; now: Date; avgProteinG?: number | null }) {
  const { tt, locale } = useTrainingText()
  const insight = useMemo(() => glp1Insight({
    sessions: data.sessions,
    weights: data.context.weights,
    injections: data.context.glp1Doses,
    now,
    avgProteinG,
  }), [data.sessions, data.context.weights, data.context.glp1Doses, now, avgProteinG])

  const color = STATUS_COLOR[insight.status]
  const pct = (value: number | null) => value == null ? '—' : `${value > 0 ? '+' : ''}${formatNumber(value, locale, 1)} %`
  const maxDay = insight.byInjectionDay ? Math.max(1, ...insight.byInjectionDay.map(d => d.sessions)) : 1

  return (
    <section aria-labelledby="glp1-title">
      <Card>
        <h2 id="glp1-title" style={{ fontSize: 13, fontWeight: 500, color: 'var(--lg-text-3)' }}>
          {tt('glp1_title')} · {tt('glp1_window', { days: insight.windowDays })}
        </h2>
        <div style={{ fontWeight: 500, fontSize: 20, color: STATUS_TEXT[insight.status], marginTop: 4 }}>{tt(`glp1_status_${insight.status}` as TrainingTextKey)}</div>
        <p style={{ fontSize: 15, lineHeight: 1.35, color: 'var(--lg-text-2)', marginTop: 4 }}>{tt(`glp1_hint_${insight.status}` as TrainingTextKey)}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <Stat label={tt('glp1_weight')} value={pct(insight.weightChangePct)} />
          <Stat
            label={tt('glp1_strength')}
            value={pct(insight.strengthChangePct)}
            sub={insight.strengthExercises > 0 ? tt('glp1_strength_n', { count: insight.strengthExercises }) : undefined}
          />
        </div>

        <p style={{ fontSize: 13, color: 'var(--lg-text-3)', marginTop: 12 }}>
          {tt('glp1_sets', { now: insight.setsLast7, before: insight.setsAvgPrev == null ? '—' : formatNumber(insight.setsAvgPrev, locale, 1) })}
        </p>
        {insight.volumeDrop && <p style={{ fontSize: 13, color: 'var(--lg-warn-text)', marginTop: 4 }}>{tt('glp1_volume_drop')}</p>}

        {insight.byInjectionDay && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--lg-text-3)', marginBottom: 8 }}>{tt('glp1_by_day')}</div>
            <div role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, alignItems: 'end', height: 64 }}>
              {insight.byInjectionDay.map(d => (
                <div key={d.day} role="listitem" aria-label={`${tt('glp1_day', { day: d.day })}: ${d.sessions}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', borderRadius: 4, background: color, opacity: 0.8, height: `${Math.max(4, (d.sessions / maxDay) * 44)}px` }} />
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--lg-text-3)' }}>{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ fontSize: 13, color: 'var(--lg-text-3)', marginTop: 12 }}>
          {insight.proteinPerKg != null
            ? tt('glp1_protein', { value: formatNumber(insight.proteinPerKg, locale, 1) })
            : tt('glp1_protein_missing')}
        </p>
        <p style={{ fontSize: 12, color: 'var(--lg-text-3)', marginTop: 12 }}>{tt('not_medical')}</p>
      </Card>
    </section>
  )
}
