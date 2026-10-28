import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Play, Timer } from 'lucide-react'
import type { TrainingRoutine, TrainingSession } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { sessionKcal } from '../../lib/energy'
import { computeReadiness, type ReadinessFactor } from '../../lib/readiness'
import { weekSummary } from '../../lib/stats'
import { formatDuration, formatNumber, formatVolume } from '../../lib/format'
import { Card, SectionTitle, Stat, TRAINING_ACCENT } from '../ui'
import { Glp1Card } from './Glp1Card'
import { SessionRow } from '../history/SessionRow'
import { NextInPlanCard, PlanSection, WeeklyMuscleCard } from '../plan/PlanSection'

/**
 * „Heute": Bereitschaft, was als Naechstes im Plan ist, Schnellstart,
 * Routinen nach Plan, Wochenbilanz, GLP-1 — in der Reihenfolge, in der man
 * es vor dem Training braucht.
 */
export function TodayTab({ data, onStartRoutine, onStartEmpty, onLogActivity, onEditRoutine, onOpenSession, onShowHistory }: {
  data: TrainingData
  onStartRoutine: (routine: TrainingRoutine) => void
  onStartEmpty: () => void
  onLogActivity: () => void
  onEditRoutine: (routine: (Omit<TrainingRoutine, 'id'> & { id?: string }) | null) => void
  onOpenSession: (session: TrainingSession) => void
  onShowHistory: () => void
}) {
  const { tt, locale } = useTrainingText()
  const now = useMemo(() => new Date(), [])

  const readiness = useMemo(() => computeReadiness({
    now,
    ...data.context.health,
    wellness: data.context.wellnessToday ?? undefined,
    sessions: data.sessions,
  }), [now, data.context.health, data.context.wellnessToday, data.sessions])

  const week = useMemo(
    () => weekSummary(data.sessions, now, data.settings.weeklyGoal, s => sessionKcal(s, data.context.latestWeightKg)),
    [data.sessions, now, data.settings.weeklyGoal, data.context.latestWeightKg],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ReadinessCard result={readiness} />

      <NextInPlanCard data={data} now={now} onStartRoutine={onStartRoutine} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Card onClick={onStartEmpty} style={{ padding: 14 }}>
          <Play size={20} aria-hidden="true" style={{ color: TRAINING_ACCENT }} />
          <div style={{ fontWeight: 800, marginTop: 8 }}>{tt('start_empty')}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{tt('kind_strength')}</div>
        </Card>
        <Card onClick={onLogActivity} style={{ padding: 14 }}>
          <Timer size={20} aria-hidden="true" style={{ color: '#10b981' }} />
          <div style={{ fontWeight: 800, marginTop: 8 }}>{tt('log_activity')}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{tt('log_activity_hint')}</div>
        </Card>
      </div>

      <PlanSection data={data} onStartRoutine={onStartRoutine} onEditRoutine={onEditRoutine} />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SectionTitle>{tt('this_week')}</SectionTitle>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            <Stat label={tt('week_sessions')} value={tt('week_goal', { done: week.sessions, goal: week.goal })} />
            <Stat label={tt('week_time')} value={formatDuration(week.durationS, tt('min'))} />
            <Stat label={tt('week_volume')} value={formatVolume(week.volumeKg, data.settings.unit, locale)} />
            <Stat label={tt('week_kcal')} value={week.kcal > 0 ? formatNumber(week.kcal, locale, 0) : '—'} />
          </div>
          <div aria-hidden="true" style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {Array.from({ length: Math.max(week.goal, week.sessions) }, (_, i) => (
              <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < week.sessions ? TRAINING_ACCENT : 'var(--surface-raised)' }} />
            ))}
          </div>
          {week.streakWeeks > 1 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 10 }}>🔥 {tt('streak_weeks', { count: week.streakWeeks })}</div>
          )}
        </Card>
        <WeeklyMuscleCard data={data} now={now} />
      </section>

      {data.glp1Active && <Glp1Card data={data} now={now} />}

      <section>
        <SectionTitle action={data.sessions.length > 3 ? (
          <button type="button" onClick={onShowHistory} className="tyd-train-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 36, color: TRAINING_ACCENT, fontWeight: 750, fontSize: '0.85rem' }}>
            {tt('show_all')} <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : undefined}>
          {tt('recent')}
        </SectionTitle>
        {data.sessions.length === 0 ? (
          <p style={{ fontSize: '0.88rem', color: 'var(--text-dim)', margin: '0 2px' }}>{tt('no_sessions')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.sessions.slice(0, 3).map(s => (
              <SessionRow key={s.id} session={s} data={data} onOpen={() => onOpenSession(s)} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const LEVEL_COLOR = { high: '#10b981', normal: '#06b6d4', low: '#f59e0b' } as const

function ReadinessCard({ result }: { result: ReturnType<typeof computeReadiness> }) {
  const { tt, locale } = useTrainingText()
  if (!result) {
    return (
      <Card>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tt('readiness')}</div>
        <div style={{ fontWeight: 750, marginTop: 4 }}>{tt('readiness_empty')}</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: 4 }}>{tt('readiness_empty_hint')}</p>
        <Link to="/progress" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, minHeight: 36, fontWeight: 750, color: TRAINING_ACCENT, fontSize: '0.88rem' }}>
          {tt('readiness_log_today')} <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </Card>
    )
  }
  const color = LEVEL_COLOR[result.level]
  const circumference = 2 * Math.PI * 26
  const factorText = (f: ReadinessFactor) => tt(`factor_${f.key}` as TrainingTextKey, {
    today: formatNumber(f.today, locale, 1),
    average: formatNumber(f.average, locale, 1),
  })
  return (
    <Card accent={color}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${tt('readiness')} ${result.score}`} style={{ flexShrink: 0 }}>
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--surface-raised)" strokeWidth="6" />
          <circle
            cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${(result.score / 100) * circumference} ${circumference}`}
            transform="rotate(-90 32 32)"
          />
          <text x="32" y="38" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--text)">{result.score}</text>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tt('readiness')}</div>
          <div style={{ fontWeight: 850, fontSize: '1.05rem', color }}>{tt(`readiness_${result.level}` as TrainingTextKey)}</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: 2 }}>{tt(`readiness_${result.level}_hint` as TrainingTextKey)}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {result.factors.map(f => (
          <span key={f.key} style={{
            fontSize: '0.75rem', fontWeight: 650, padding: '4px 10px', borderRadius: 999,
            background: 'var(--surface-raised)', color: f.points < -2 ? '#f59e0b' : f.points > 2 ? '#10b981' : 'var(--text-dim)',
          }}>
            {factorText(f)}
          </span>
        ))}
      </div>
    </Card>
  )
}
