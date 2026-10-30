import type { TrainingSession } from '../types'
import type { TrainingTextKey } from '../i18n'
import type { NextInPlan } from './planRotation'

/**
 * Was Dot auf „Heute" sagt: was dran ist, oder ein Satz Motivation. Ein
 * Satz zum Tag, dazu einer zur Woche, wenn es ein Wochenziel gibt.
 */
export function dotHint({ tt, todaySessions, hasRoutines, next, restDay, lowReadiness, week }: {
  tt: (key: TrainingTextKey, vars?: Record<string, string | number>) => string
  /** Einheiten von heute. */
  todaySessions: readonly TrainingSession[]
  hasRoutines: boolean
  next: NextInPlan | null
  restDay: boolean
  lowReadiness: boolean
  week: { sessions: number; goal: number }
}): string {
  const weekLine = week.goal <= 0 ? ''
    : week.sessions >= week.goal ? tt('dot_week_done')
    : tt('dot_week_left', { count: week.goal - week.sessions })
  const join = (...parts: string[]) => parts.filter(Boolean).join(' ')

  if (todaySessions.length > 0) {
    const s = todaySessions[0]
    return join(tt('dot_done_today', { name: s.title || tt(`kind_${s.kind}` as TrainingTextKey) }), weekLine)
  }
  if (!hasRoutines) return tt('dot_start')
  if (next?.plannedToday) {
    return join(tt('dot_planned_today', { name: next.routine.name }), lowReadiness ? tt('dot_low_readiness') : weekLine)
  }
  if (restDay) return tt('dot_rest_day')
  if (next) return join(tt('dot_next', { name: next.routine.name }), weekLine)
  return ''
}
