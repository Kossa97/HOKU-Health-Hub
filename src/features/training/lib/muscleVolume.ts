import type { MuscleGroup, RoutineExercise, TrainingRoutine } from '../types'
import type { MuscleInfo } from './stats'

/**
 * Geplante Saetze je Muskel — das Gegenstueck zu `setsPerMuscle` in
 * `stats.ts`, nur fuer Routinen statt fuer Einheiten. Gleiche Zaehlweise:
 * Hauptmuskel voll, Hilfsmuskel halb, Aufwaermsaetze zaehlen nicht.
 */

/** Richtwert fuer Saetze pro Muskel und Woche; nur Orientierung, kein Ziel. */
export const SETS_BAND = { low: 10, high: 20 } as const

/** Skalenende der Balken: das Band 10–20 liegt dann bei 41,6–83,3 %. */
export const SETS_SCALE_MAX = 24

export type MuscleOf = (exerciseId: string) => MuscleInfo | null

export function routineSetsPerMuscle(
  exercises: readonly RoutineExercise[],
  muscleOf: MuscleOf,
): Map<MuscleGroup, number> {
  const result = new Map<MuscleGroup, number>()
  for (const ex of exercises) {
    const info = muscleOf(ex.exerciseId)
    if (!info) continue
    const sets = ex.sets.filter(set => set.type !== 'warmup').length
    if (sets === 0) continue
    for (const m of info.primary) result.set(m, (result.get(m) ?? 0) + sets)
    for (const m of info.secondary) result.set(m, (result.get(m) ?? 0) + sets / 2)
  }
  return result
}

/**
 * Wochen-Saetze ueber mehrere Routinen (z. B. alle in einem Ordner): jede
 * Routine zaehlt so oft, wie sie Wochentage hat; ohne Wochentage einmal.
 */
export function weeklySetsPerMuscle(
  routines: ReadonlyArray<Pick<TrainingRoutine, 'exercises' | 'weekdays'>>,
  muscleOf: MuscleOf,
): Map<MuscleGroup, number> {
  const result = new Map<MuscleGroup, number>()
  for (const routine of routines) {
    const factor = Math.max(1, routine.weekdays.length)
    for (const [muscle, sets] of routineSetsPerMuscle(routine.exercises, muscleOf)) {
      result.set(muscle, (result.get(muscle) ?? 0) + sets * factor)
    }
  }
  return result
}

export interface MuscleRow {
  muscle: MuscleGroup
  sets: number
}

/** Als Liste, groesste zuerst; `limit` kuerzt (z. B. Top 6 auf „Heute"). */
export function sortedMuscles(sets: ReadonlyMap<MuscleGroup, number>, limit = Infinity): MuscleRow[] {
  return [...sets.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([muscle, value]) => ({ muscle, sets: value }))
}
