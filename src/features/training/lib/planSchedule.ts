import { EVERY_DAYS_MAX, PER_WEEK_MAX, type PlanSchedule, type TrainingRoutine, type TrainingSession } from '../types'
import { startOfWeek } from './stats'

/**
 * Zeitplan eines Plans auswerten: ist heute etwas dran, wann ist das naechste
 * Training, wie viele Einheiten diese Woche. Gezaehlt werden Einheiten, die
 * aus einem Workout des Plans gestartet wurden (`routineId`).
 */

export const DEFAULT_SCHEDULE: PlanSchedule = { mode: 'weekdays' }

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback

export function normalizeSchedule(raw: unknown): PlanSchedule {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (v.mode === 'per_week') return { mode: 'per_week', perWeek: clampInt(v.perWeek, 1, PER_WEEK_MAX, 3) }
  if (v.mode === 'interval') return { mode: 'interval', everyDays: clampInt(v.everyDays, 1, EVERY_DAYS_MAX, 2) }
  return DEFAULT_SCHEDULE
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export interface ScheduleStatus {
  /** Heute ist laut Zeitplan ein Training dran (und heute noch keins aus dem Plan). */
  dueToday: boolean
  /** Heute schon aus diesem Plan trainiert. */
  trainedToday: boolean
  /** Naechster Trainingstag (heute oder spaeter); null bei „weekdays" (steht an den Workouts). */
  nextDate: Date | null
  /** Einheiten aus dem Plan in dieser Woche. */
  doneThisWeek: number
  /** Juengste Einheit aus dem Plan. */
  lastAt: Date | null
}

export function scheduleStatus(
  schedule: PlanSchedule,
  workouts: readonly TrainingRoutine[],
  sessions: readonly TrainingSession[],
  now: Date,
): ScheduleStatus {
  const ids = new Set(workouts.map(w => w.id))
  const own = sessions.filter(s => s.routineId != null && ids.has(s.routineId))
  const today = dayStart(now)
  const weekStart = startOfWeek(now).getTime()
  const doneThisWeek = own.filter(s => Date.parse(s.startedAt) >= weekStart).length
  const trainedToday = own.some(s => dayStart(new Date(s.startedAt)).getTime() === today.getTime())
  const lastMs = own.reduce((max, s) => Math.max(max, Date.parse(s.startedAt)), -Infinity)
  const lastAt = Number.isFinite(lastMs) ? new Date(lastMs) : null

  if (schedule.mode === 'per_week') {
    // Wochenziel offen: heute dran, sonst (heute schon trainiert) morgen;
    // erreicht: ab dem naechsten Montag.
    const nextWeek = addDays(startOfWeek(now), 7)
    const open = doneThisWeek < schedule.perWeek
    let nextDate = !open ? nextWeek : trainedToday ? addDays(today, 1) : today
    if (nextDate.getTime() > nextWeek.getTime()) nextDate = nextWeek
    return { dueToday: open && !trainedToday, trainedToday, nextDate, doneThisWeek, lastAt }
  }
  if (schedule.mode === 'interval') {
    // X Tage nach der letzten Einheit; ueberfaellig heisst: heute.
    let nextDate = lastAt ? addDays(dayStart(lastAt), schedule.everyDays) : today
    if (nextDate.getTime() < today.getTime()) nextDate = today
    return { dueToday: !trainedToday && nextDate.getTime() === today.getTime(), trainedToday, nextDate, doneThisWeek, lastAt }
  }
  return { dueToday: false, trainedToday, nextDate: null, doneThisWeek, lastAt }
}

/** Tage dieser Woche (Montag = 0 … Sonntag = 6), an denen ein „alle X Tage"-Plan dran waere — ab heute. */
export function intervalDaysInWeek(status: ScheduleStatus, everyDays: number, now: Date): number[] {
  if (!status.nextDate) return []
  const weekStart = startOfWeek(now)
  const weekEnd = addDays(weekStart, 7).getTime()
  const days: number[] = []
  for (let d = status.nextDate; d.getTime() < weekEnd; d = addDays(d, everyDays)) {
    days.push(Math.round((d.getTime() - weekStart.getTime()) / 86_400_000))
  }
  return days
}
