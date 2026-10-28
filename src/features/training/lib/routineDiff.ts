import type { RoutineExercise, RoutineSet, TrainingRoutine, TrainingSet } from '../types'
import type { ActiveWorkout } from './activeWorkout'

/**
 * Weicht ein Training von seiner Routine ab? Beim Beenden fragt die App dann
 * „Änderungen in die Routine übernehmen?" — statt dass die Routine still
 * veraltet, wie es bei Hevy und Strong passiert.
 *
 * Strukturell zaehlt: welche Uebungen, in welcher Reihenfolge, wie viele
 * Saetze. Gewichte sind kein Grund zur Nachfrage (die wandern ueber den
 * Vorschlag weiter), landen aber als Startwerte im Vorschlag `proposed`.
 *
 * Was im Training steht, aber nicht abgehakt wurde, zaehlt nicht: eine
 * Uebung, die heute nur ausgelassen wurde, bleibt in der Routine, wie sie
 * ist; eine, die der Nutzer aus dem Training entfernt hat, fehlt im
 * Vorschlag.
 */

export interface RoutineDiff {
  /** Kennungen neu hinzugekommener Uebungen. */
  added: string[]
  /** Kennungen aus der Routine entfernter Uebungen. */
  removed: string[]
  reordered: boolean
  /** Satzzahl je Uebung, wo sie sich geaendert hat. */
  setChanges: Array<{ exerciseId: string; from: number; to: number }>
  /** Die Uebungen des Trainings als neue Vorlage. */
  proposed: RoutineExercise[]
}

const isWorking = (s: TrainingSet) => s.done && s.type !== 'warmup'

/** Schluessel je Vorkommen, damit dieselbe Uebung zweimal in einer Routine nicht verwechselt wird. */
function keyed<T extends { exerciseId: string }>(items: readonly T[]): Array<{ key: string; item: T }> {
  const seen = new Map<string, number>()
  return items.map(item => {
    const n = seen.get(item.exerciseId) ?? 0
    seen.set(item.exerciseId, n + 1)
    return { key: `${item.exerciseId}#${n}`, item }
  })
}

function proposeExercise(ex: ActiveWorkout['exercises'][number], template: RoutineExercise | undefined): RoutineExercise {
  const done = ex.sets.filter(s => s.done)
  const working = done.filter(isWorking)
  const heaviest = working.reduce<number | null>((max, s) =>
    s.weightKg != null && (max == null || s.weightKg > max) ? s.weightKg : max, null)
  const first = working[0]
  const tplSets = template?.sets ?? []
  const sets: RoutineSet[] = done.map((s, i) => {
    if (template) {
      const tpl = tplSets[Math.min(i, tplSets.length - 1)]
      const base: RoutineSet = tpl ? { ...tpl, type: s.type } : { type: s.type }
      if (s.type === 'warmup') return tpl ? base : { type: 'warmup', weightKg: s.weightKg ?? null, reps: s.reps ?? null }
      return { ...base, weightKg: heaviest ?? base.weightKg ?? null }
    }
    if (s.type === 'warmup') return { type: 'warmup', weightKg: s.weightKg ?? null, reps: s.reps ?? null }
    const reps = first?.reps ?? null
    return {
      type: s.type,
      weightKg: heaviest,
      reps,
      repsMin: reps,
      repsMax: reps,
      durationS: first?.durationS ?? null,
      distanceM: first?.distanceM ?? null,
    }
  })
  return {
    exerciseId: ex.exerciseId,
    supersetGroup: ex.supersetGroup ?? null,
    restS: ex.restS ?? null,
    notes: ex.notes ?? null,
    sets,
  }
}

export function routineDiff(workout: ActiveWorkout, routine: TrainingRoutine): RoutineDiff | null {
  const routineKeyed = keyed(routine.exercises)
  const templates = new Map(routineKeyed.map(r => [r.key, r.item]))
  // Uebungen des Trainings, die zaehlen: abgehakt oder in der Routine vorhanden.
  const trained = keyed(workout.exercises).filter(({ key, item }) =>
    item.sets.some(s => s.done) || templates.has(key))

  const added = trained.filter(t => !templates.has(t.key)).map(t => t.item.exerciseId)
  const trainedKeys = new Set(trained.map(t => t.key))
  const removed = routineKeyed.filter(r => !trainedKeys.has(r.key)).map(r => r.item.exerciseId)

  const commonWorkout = trained.filter(t => templates.has(t.key)).map(t => t.key)
  const commonRoutine = routineKeyed.filter(r => trainedKeys.has(r.key)).map(r => r.key)
  const reordered = commonWorkout.some((key, i) => key !== commonRoutine[i])

  const setChanges: RoutineDiff['setChanges'] = []
  const proposed: RoutineExercise[] = trained.map(({ key, item }) => {
    const template = templates.get(key)
    const doneCount = item.sets.filter(s => s.done).length
    if (template && doneCount === 0) return template
    if (template && doneCount !== template.sets.length) {
      setChanges.push({ exerciseId: item.exerciseId, from: template.sets.length, to: doneCount })
    }
    return proposeExercise(item, template)
  })

  if (added.length === 0 && removed.length === 0 && !reordered && setChanges.length === 0) return null
  return { added, removed, reordered, setChanges, proposed }
}

/** Die Routine mit der Struktur des Trainings; Kennung, Name, Ordner, Wochentage und Reihenfolge bleiben. */
export function applyRoutineDiff(routine: TrainingRoutine, diff: RoutineDiff): TrainingRoutine {
  return { ...routine, exercises: diff.proposed }
}
