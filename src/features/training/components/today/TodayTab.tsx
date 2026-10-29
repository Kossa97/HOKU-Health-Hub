import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus, Timer } from 'lucide-react'
import type { TrainingRoutine, TrainingSession } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { sessionKcal } from '../../lib/energy'
import { computeReadiness, type ReadinessFactor } from '../../lib/readiness'
import { weekSummary } from '../../lib/stats'
import { formatDuration, formatNumber, formatVolume } from '../../lib/format'
import { Button, Card, SectionTitle, Stat, TRAINING_ACCENT } from '../ui'
import { Glp1Card } from './Glp1Card'
import { SessionRow } from '../history/SessionRow'
import { nextInPlan } from '../../lib/planRotation'
import { dotHint } from '../../lib/dotHint'
import { dotStore } from '../../../dot/dotStore'
import { PlanSection, WeeklyMuscleCard } from '../plan/PlanSection'
import { WeekStrip } from './WeekStrip'

/**
 * „Heute", von oben nach unten: Wochenleiste, leeres Training starten,
 * Routinen (die von heute bzw. die naechste hervorgehoben), Aktivitaet
 * eintragen, Wochenbilanz, Bereitschaft (nur mit Wert), GLP-1, zuletzt.
 * Was heute dran ist, sagt die Leiste und die hervorgehobene Routine; eine
 * eigene Karte dafuer gibt es nicht mehr.
 */
export function TodayTab({ data, dotQuiet = false, onStartRoutine, onStartEmpty, onLogActivity, onEditRoutine, onOpenSession, onShowHistory }: {
  data: TrainingData
  /** Das Live-Training liegt darueber: Dot schweigt zu „Heute". */
  dotQuiet?: boolean
  onStartRoutine: (routine: TrainingRoutine) => void
  onStartEmpty: () => void
  onLogActivity: () => void
  onEditRoutine: (routine: (Omit<TrainingRoutine, 'id'> & { id?: string }) | null) => void
  onOpenSession: (session: TrainingSession) => void
  onShowHistory: () => void
}) {
  const { tt, locale } = useTrainingText()
  // Ein fester Zeitpunkt je Tag; kommt die App nach Mitternacht zurueck, ruecken Leiste und Plan nach.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible' && new Date().toDateString() !== now.toDateString()) setNow(new Date())
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [now])

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

  const next = useMemo(() => nextInPlan(data.routines, data.sessions, now), [data.routines, data.sessions, now])
  const todaySessions = useMemo(
    () => data.sessions.filter(s => new Date(s.startedAt).toDateString() === now.toDateString()),
    [data.sessions, now],
  )
  // Ruhetag: es gibt einen Wochenplan, fuer heute steht nichts darin und heute wurde nicht trainiert.
  const restDay = next != null && !next.plannedToday && todaySessions.length === 0
    && data.routines.some(r => r.weekdays.length > 0)

  // Dot sagt, was heute dran ist (er lebt in der Leiste, nicht in den Karten)
  const hint = dotHint({
    tt, todaySessions, next, restDay,
    hasRoutines: data.routines.length > 0,
    lowReadiness: readiness?.level === 'low',
    week: { sessions: week.sessions, goal: week.goal },
  })
  useEffect(() => {
    dotStore.setHinweis(dotQuiet ? null : hint || null)
    return () => dotStore.setHinweis(null)
  }, [hint, dotQuiet])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <WeekStrip key={now.toDateString()} data={data} now={now} />

      <Button block onClick={onStartEmpty} style={{ minHeight: 52, fontSize: '1rem', borderRadius: 16 }}>
        <Plus size={20} strokeWidth={2.5} aria-hidden="true" /> {tt('start_empty_cta')}
      </Button>

      <PlanSection data={data} next={next} restDay={restDay} now={now} onStartRoutine={onStartRoutine} onEditRoutine={onEditRoutine} />

      <Card onClick={onLogActivity} style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Timer size={20} aria-hidden="true" style={{ color: '#10b981', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>{tt('log_activity')}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--lg-text-3)' }}>{tt('log_activity_hint')}</div>
          </div>
          <ChevronRight size={18} aria-hidden="true" style={{ color: 'var(--lg-text-3)' }} />
        </div>
      </Card>

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
              <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < week.sessions ? TRAINING_ACCENT : 'var(--lg-fill)' }} />
            ))}
          </div>
          {week.streakWeeks > 1 && (
            <div style={{ fontSize: 13, color: 'var(--lg-text-3)', marginTop: 10 }}>🔥 {tt('streak_weeks', { count: week.streakWeeks })}</div>
          )}
        </Card>
        <WeeklyMuscleCard data={data} now={now} />
      </section>

      {readiness && <ReadinessCard result={readiness} />}

      {data.glp1Active && <Glp1Card data={data} now={now} />}

      <section>
        <SectionTitle action={data.sessions.length > 3 ? (
          <button type="button" onClick={onShowHistory} className="tyd-train-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 36, color: 'var(--lg-accent-text)', fontWeight: 500, fontSize: 15, padding: '0 4px' }}>
            {tt('show_all')} <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : undefined}>
          {tt('recent')}
        </SectionTitle>
        {data.sessions.length === 0 ? (
          <p style={{ fontSize: 15, color: 'var(--lg-text-3)', margin: '0 16px' }}>{tt('no_sessions')}</p>
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

const LEVEL_COLOR = { high: '#30d158', normal: '#64d2ff', low: '#ff9f0a' } as const
/** Schrift in der hellen Variante, damit sie auf Schwarz gut lesbar bleibt */
const LEVEL_TEXT = { high: 'var(--lg-good-text)', normal: 'var(--lg-accent-text)', low: 'var(--lg-warn-text)' } as const

/** Bereitschaft mit Wert; ohne Daten steht auf „Heute" nichts (eintragen: Fortschritt). */
function ReadinessCard({ result }: { result: NonNullable<ReturnType<typeof computeReadiness>> }) {
  const { tt, locale } = useTrainingText()
  const color = LEVEL_COLOR[result.level]
  const circumference = 2 * Math.PI * 26
  const factorText = (f: ReadinessFactor) => tt(`factor_${f.key}` as TrainingTextKey, {
    today: formatNumber(f.today, locale, 1),
    average: formatNumber(f.average, locale, 1),
  })
  return (
    <Card>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${tt('readiness')} ${result.score}`} style={{ flexShrink: 0 }}>
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--lg-fill)" strokeWidth="6" />
          <circle
            cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${(result.score / 100) * circumference} ${circumference}`}
            transform="rotate(-90 32 32)"
          />
          <text x="32" y="38" textAnchor="middle" fontSize="18" fontWeight="600" fill="var(--lg-text)">{result.score}</text>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-text-3)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{tt('readiness')}</div>
          <div style={{ fontWeight: 700, fontSize: 20, color: LEVEL_TEXT[result.level] }}>{tt(`readiness_${result.level}` as TrainingTextKey)}</div>
          <p style={{ fontSize: 15, lineHeight: 1.35, color: 'var(--lg-text-2)', marginTop: 2 }}>{tt(`readiness_${result.level}_hint` as TrainingTextKey)}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {result.factors.map(f => (
          <span key={f.key} className="lg-tag" data-tone={f.points < -2 ? 'warn' : f.points > 2 ? 'good' : undefined} style={{ whiteSpace: 'normal', lineHeight: 1.25, padding: '4px 10px' }}>
            {factorText(f)}
          </span>
        ))}
      </div>
    </Card>
  )
}
