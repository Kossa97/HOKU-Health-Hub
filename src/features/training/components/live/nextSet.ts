import type { CustomExercise, WeightUnit } from '../../types'
import type { TrainingLang } from '../../i18n'
import { nextOpenSet, type ActiveWorkout } from '../../lib/activeWorkout'
import { exerciseName, exerciseTracking } from '../../lib/exerciseLookup'
import { previousLabel } from './SetRow'

/** Der naechste offene Satz, wie Pausen-Timer und minimierte Leiste ihn zeigen. */
export interface NextSetInfo {
  /** Anzeigename der Uebung. */
  exercise: string
  /** Satznummer (Position, ab 1). */
  set: number
  /** Zielwerte, z. B. „82,5 × 8"; leer, wenn der Satz noch keine Werte hat. */
  target: string
}

export function describeNextSet(
  workout: Pick<ActiveWorkout, 'exercises'>,
  lang: TrainingLang,
  locale: string,
  unit: WeightUnit,
  customExercises: readonly CustomExercise[],
): NextSetInfo | null {
  const next = nextOpenSet(workout)
  if (!next) return null
  const exercise = workout.exercises[next.index]
  const set = exercise.sets[next.setIndex]
  const tracking = exerciseTracking(exercise.exerciseId, customExercises) ?? 'weight_reps'
  const target = previousLabel(set, tracking, unit, locale)
  return {
    exercise: exerciseName(exercise.exerciseId, lang, customExercises),
    set: next.setIndex + 1,
    target: target === '—' ? '' : target,
  }
}
