import type { PlanSchedule, TrainingRoutine, TrainingSession } from '../types'
import { isoWeekday } from './stats'
import { DEFAULT_SCHEDULE, scheduleStatus, type ScheduleStatus } from './planSchedule'

/**
 * Ordner = Plan. „Als Naechstes" ergibt sich aus dem Verlauf, ohne eigenen
 * Zustand: die Routine nach der zuletzt trainierten im selben Ordner, in der
 * Reihenfolge der Routinen (Rotation). Was fuer heute geplant ist, geht vor.
 *
 * Heute geplant heisst je nach Zeitplan des Plans (`planSchedule.ts`): bei
 * festen Wochentagen ein Workout mit dem heutigen Tag; bei „X-mal pro Woche"
 * und „alle X Tage" das naechste Workout der Rotation, wenn der Plan heute
 * dran ist.
 */

export interface PlanGroup {
  /** null = „Ohne Plan". */
  folder: string | null
  routines: TrainingRoutine[]
}

/** Reihenfolge innerhalb eines Ordners: `sortOrder`, bei Gleichstand der erste Wochentag. */
export function rotationOrder(a: TrainingRoutine, b: TrainingRoutine): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return (a.weekdays[0] ?? 8) - (b.weekdays[0] ?? 8) || a.name.localeCompare(b.name)
}

/**
 * Routinen nach Ordner, in der Reihenfolge ihres ersten Auftretens; Routinen
 * ohne Ordner kommen als letzte Gruppe.
 */
export function groupByFolder(routines: readonly TrainingRoutine[]): PlanGroup[] {
  const sorted = [...routines].sort(rotationOrder)
  const groups = new Map<string | null, TrainingRoutine[]>()
  for (const routine of sorted) {
    const list = groups.get(routine.folder) ?? []
    list.push(routine)
    groups.set(routine.folder, list)
  }
  const result: PlanGroup[] = []
  for (const [folder, list] of groups) if (folder != null) result.push({ folder, routines: list })
  const loose = groups.get(null)
  if (loose) result.push({ folder: null, routines: loose })
  return result
}

export interface NextInPlan {
  routine: TrainingRoutine
  folder: string | null
  /** Alle Routinen des Ordners in Rotationsreihenfolge (fuer die Chip-Zeile). */
  rotation: TrainingRoutine[]
  /** Wann diese Routine zuletzt trainiert wurde; null = noch nie. */
  lastTrainedAt: string | null
  /** Die Routine steht fuer heute im Plan (Wochentag bzw. Zeitplan). */
  plannedToday: boolean
  /** Zeitplan des Plans und sein Stand; „weekdays" ohne eigenen Plan. */
  schedule: PlanSchedule
  status: ScheduleStatus | null
}

/** Juengste Einheit je Routine (ISO-Zeit). */
export function lastTrainedByRoutine(sessions: readonly TrainingSession[]): Map<string, string> {
  const result = new Map<string, string>()
  for (const session of sessions) {
    if (!session.routineId) continue
    const current = result.get(session.routineId)
    if (!current || Date.parse(session.startedAt) > Date.parse(current)) result.set(session.routineId, session.startedAt)
  }
  return result
}

const sameLocalDay = (iso: string, now: Date) => new Date(iso).toDateString() === now.toDateString()

export function nextInPlan(
  routines: readonly TrainingRoutine[],
  sessions: readonly TrainingSession[],
  now: Date,
  /** Zeitplan je Plan-Name; fehlt einer, gilt „weekdays". */
  schedules: ReadonlyMap<string, PlanSchedule> = new Map(),
): NextInPlan | null {
  if (routines.length === 0) return null
  const groups = groupByFolder(routines)
  const last = lastTrainedByRoutine(sessions)

  // Aktiver Ordner: der mit der zuletzt trainierten Routine, sonst der erste.
  let active = groups[0]
  let latest = -Infinity
  for (const group of groups) {
    for (const routine of group.routines) {
      const at = last.get(routine.id)
      if (at && Date.parse(at) > latest) { latest = Date.parse(at); active = group }
    }
  }

  const today = isoWeekday(now)
  const scheduleOf = (group: PlanGroup) => (group.folder != null ? schedules.get(group.folder) : undefined) ?? DEFAULT_SCHEDULE
  const statusOf = (group: PlanGroup) => {
    const schedule = scheduleOf(group)
    return schedule.mode === 'weekdays' ? null : scheduleStatus(schedule, group.routines, sessions, now)
  }
  const result = (routine: TrainingRoutine, group: PlanGroup, plannedToday: boolean): NextInPlan => ({
    routine, folder: group.folder, rotation: group.routines,
    lastTrainedAt: last.get(routine.id) ?? null, plannedToday,
    schedule: scheduleOf(group), status: statusOf(group),
  })

  // Rotation: nach der zuletzt trainierten Routine des Ordners weiter, am Ende von vorn.
  const rotationNext = (group: PlanGroup) => {
    let lastIndex = -1
    let lastAt = -Infinity
    group.routines.forEach((routine, index) => {
      const at = last.get(routine.id)
      if (at && Date.parse(at) > lastAt) { lastAt = Date.parse(at); lastIndex = index }
    })
    return group.routines[(lastIndex + 1) % group.routines.length]
  }

  // Fuer heute geplant und heute noch nicht trainiert — zuerst im aktiven Ordner suchen.
  const openToday = (group: PlanGroup) => {
    if (scheduleOf(group).mode !== 'weekdays') return statusOf(group)?.dueToday ? rotationNext(group) : undefined
    return group.routines.find(r => {
      if (!r.weekdays.includes(today)) return false
      const at = last.get(r.id)
      return !at || !sameLocalDay(at, now)
    })
  }
  const inActive = openToday(active)
  if (inActive) return result(inActive, active, true)
  for (const group of groups) {
    if (group === active) continue
    const hit = openToday(group)
    if (hit) return result(hit, group, true)
  }

  return result(rotationNext(active), active, false)
}
