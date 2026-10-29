import type { TrainingRoutine, TrainingSession } from '../types'
import { isoWeekday, sessionDurationS, startOfWeek } from './stats'

/**
 * Die Wochenleiste auf „Heute": Montag bis Sonntag der laufenden Woche, je
 * Tag die Einheiten und was laut Wochentag der Routinen geplant ist.
 * Geplant zaehlt nur fuer heute und spaeter — vergangene Tage zeigen, was war.
 */

export interface WeekDay {
  date: Date
  /** 1 = Montag … 7 = Sonntag. */
  weekday: number
  isToday: boolean
  isPast: boolean
  /** Einheiten des Tages, die laengste zuerst. */
  sessions: TrainingSession[]
  /** Routinen mit diesem Wochentag; leer fuer vergangene Tage. */
  planned: TrainingRoutine[]
}

export function weekDays(now: Date, sessions: readonly TrainingSession[], routines: readonly TrainingRoutine[]): WeekDay[] {
  const start = startOfWeek(now)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
  const todayKey = now.toDateString()
  // Einmal durch den Verlauf: nur die Woche, nach Wochentag sortiert.
  const byWeekday = new Map<number, TrainingSession[]>()
  for (const session of sessions) {
    const at = new Date(session.startedAt)
    if (at < start || at >= end) continue
    const list = byWeekday.get(isoWeekday(at)) ?? []
    list.push(session)
    byWeekday.set(isoWeekday(at), list)
  }
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const isToday = date.toDateString() === todayKey
    const isPast = !isToday && date.getTime() < now.getTime()
    const weekday = isoWeekday(date)
    const daySessions = (byWeekday.get(weekday) ?? []).sort((a, b) => sessionDurationS(b) - sessionDurationS(a))
    const planned = isPast ? [] : routines.filter(r => r.weekdays.includes(weekday))
    return { date, weekday, isToday, isPast, sessions: daySessions, planned }
  })
}
