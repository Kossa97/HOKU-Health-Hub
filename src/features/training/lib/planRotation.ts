import type { TrainingRoutine, TrainingSession } from '../types'
import { isoWeekday } from './stats'

/**
 * Ordner = Plan. „Als Naechstes" ergibt sich aus dem Verlauf, ohne eigenen
 * Zustand: die Routine nach der zuletzt trainierten im selben Ordner, in der
 * Reihenfolge der Routinen (Rotation). Was fuer heute geplant ist, geht vor.
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
  /** Die Routine steht fuer heute im Plan (Wochentag). */
  plannedToday: boolean
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
  const result = (routine: TrainingRoutine, group: PlanGroup, plannedToday: boolean): NextInPlan => ({
    routine, folder: group.folder, rotation: group.routines,
    lastTrainedAt: last.get(routine.id) ?? null, plannedToday,
  })

  // Fuer heute geplant und heute noch nicht trainiert — zuerst im aktiven Ordner suchen.
  const openToday = (group: PlanGroup) => group.routines.find(r => {
    if (!r.weekdays.includes(today)) return false
    const at = last.get(r.id)
    return !at || !sameLocalDay(at, now)
  })
  const inActive = openToday(active)
  if (inActive) return result(inActive, active, true)
  for (const group of groups) {
    if (group === active) continue
    const hit = openToday(group)
    if (hit) return result(hit, group, true)
  }

  // Rotation: nach der zuletzt trainierten Routine des Ordners weiter, am Ende von vorn.
  const rotation = active.routines
  let lastIndex = -1
  let lastAt = -Infinity
  rotation.forEach((routine, index) => {
    const at = last.get(routine.id)
    if (at && Date.parse(at) > lastAt) { lastAt = Date.parse(at); lastIndex = index }
  })
  const next = rotation[(lastIndex + 1) % rotation.length]
  return result(next, active, false)
}
