import type { PlanSchedule, TrainingRoutine, TrainingSession } from '../types'
import { isoWeekday, sessionDurationS, startOfWeek } from './stats'
import { groupByFolder, nextInPlan } from './planRotation'
import { intervalDaysInWeek, scheduleStatus } from './planSchedule'

/**
 * Die Wochenleiste auf „Heute": Montag bis Sonntag der laufenden Woche, je
 * Tag die Einheiten und was laut Wochentag der Routinen geplant ist.
 * Geplant zaehlt nur fuer heute und spaeter — vergangene Tage zeigen, was war.
 *
 * Plaene mit Zeitplan: „alle X Tage" markiert die faelligen Tage dieser Woche
 * mit dem naechsten Workout der Rotation; „X-mal pro Woche" hat keine festen
 * Tage und markiert nur heute, wenn heute dran ist. Die Wochentage an deren Workouts zaehlen nicht.
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

export function weekDays(
  now: Date,
  sessions: readonly TrainingSession[],
  routines: readonly TrainingRoutine[],
  schedules: ReadonlyMap<string, PlanSchedule> = new Map(),
): WeekDay[] {
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
  // Workouts, deren Plan feste Wochentage hat (oder die ohne Plan sind)
  const modeOf = (folder: string | null) => (folder != null ? schedules.get(folder)?.mode : undefined) ?? 'weekdays'
  const byWeekdays = routines.filter(r => modeOf(r.folder) === 'weekdays')
  // „alle X Tage": Montag = 0 … Sonntag = 6 → das naechste Workout der Rotation
  const intervalPlanned = new Map<number, TrainingRoutine[]>()
  for (const group of groupByFolder(routines)) {
    const schedule = group.folder != null ? schedules.get(group.folder) : undefined
    if (!schedule || schedule.mode === 'weekdays') continue
    const status = scheduleStatus(schedule, group.routines, sessions, now)
    const next = nextInPlan(group.routines, sessions, now, schedules)?.routine
    if (!next) continue
    // „X-mal pro Woche" hat keine festen Tage — nur heute, wenn heute dran ist.
    const todayIndex = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - startOfWeek(now).getTime()) / 86_400_000)
    const days = schedule.mode === 'interval' ? intervalDaysInWeek(status, schedule.everyDays, now) : status.dueToday ? [todayIndex] : []
    for (const day of days) intervalPlanned.set(day, [...(intervalPlanned.get(day) ?? []), next])
  }
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const isToday = date.toDateString() === todayKey
    const isPast = !isToday && date.getTime() < now.getTime()
    const weekday = isoWeekday(date)
    const daySessions = (byWeekday.get(weekday) ?? []).sort((a, b) => sessionDurationS(b) - sessionDurationS(a))
    const planned = isPast ? [] : [...byWeekdays.filter(r => r.weekdays.includes(weekday)), ...(intervalPlanned.get(i) ?? [])]
    return { date, weekday, isToday, isPast, sessions: daySessions, planned }
  })
}
