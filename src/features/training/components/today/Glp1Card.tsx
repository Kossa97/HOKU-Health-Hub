import { useMemo } from 'react'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { glp1Insight } from '../../lib/glp1'
import { formatNumber } from '../../lib/format'
import { Card, Stat } from '../ui'

const STATUS_COLOR = { good: '#10b981', neutral: '#06b6d4', watch: '#f59e0b', insufficient: 'var(--text-dim)' } as const

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
      <Card accent={color}>
        <h2 id="glp1-title" style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {tt('glp1_title')} · {tt('glp1_window', { days: insight.windowDays })}
        </h2>
        <div style={{ fontWeight: 850, fontSize: '1.1rem', color, marginTop: 4 }}>{tt(`glp1_status_${insight.status}` as TrainingTextKey)}</div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-dim)', marginTop: 4 }}>{tt(`glp1_hint_${insight.status}` as TrainingTextKey)}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <Stat label={tt('glp1_weight')} value={pct(insight.weightChangePct)} />
          <Stat
            label={tt('glp1_strength')}
            value={pct(insight.strengthChangePct)}
            sub={insight.strengthExercises > 0 ? tt('glp1_strength_n', { count: insight.strengthExercises }) : undefined}
          />
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 12 }}>
          {tt('glp1_sets', { now: insight.setsLast7, before: insight.setsAvgPrev == null ? '—' : formatNumber(insight.setsAvgPrev, locale, 1) })}
        </p>
        {insight.volumeDrop && <p style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: 4 }}>{tt('glp1_volume_drop')}</p>}

        {insight.byInjectionDay && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 750, color: 'var(--text-dim)', marginBottom: 6 }}>{tt('glp1_by_day')}</div>
            <div role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, alignItems: 'end', height: 64 }}>
              {insight.byInjectionDay.map(d => (
                <div key={d.day} role="listitem" aria-label={`${tt('glp1_day', { day: d.day })}: ${d.sessions}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', borderRadius: 4, background: color, opacity: 0.8, height: `${Math.max(4, (d.sessions / maxDay) * 44)}px` }} />
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 12 }}>
          {insight.proteinPerKg != null
            ? tt('glp1_protein', { value: formatNumber(insight.proteinPerKg, locale, 1) })
            : tt('glp1_protein_missing')}
        </p>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10 }}>{tt('not_medical')}</p>
      </Card>
    </section>
  )
}
