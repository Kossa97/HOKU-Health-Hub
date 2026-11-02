import type { CustomExercise, RoutineExercise, TrainingRoutine, TrainingSession, TrainingSet, WeightUnit } from '../types'
import type { SuggestFn } from './activeWorkout'
import { exerciseInfo } from './exerciseLookup'
import { suggestNextSets, type Suggestion, type SuggestedSet } from './progression'
import { previousSets } from './stats'

/**
 * Den Vorschlag (`suggestNextSets`) mit Katalog, Verlauf und Einheit versorgen.
 * Dieselbe Funktion fuettert `startWorkout`, `add_exercises` und
 * `replace_exercise` — und den Vorschlagskasten je Uebung im Logger.
 */
export function buildSuggestFn(options: {
  history: readonly TrainingSession[]
  unit: WeightUnit
  customExercises: readonly CustomExercise[]
  /** Beim Bearbeiten: nur Einheiten vor diesem Zeitpunkt zaehlen als „Vorher". */
  beforeIso?: string
}): SuggestFn {
  return (exerciseId, template) => {
    const info = exerciseInfo(exerciseId, 'en', options.customExercises)
    if (!info) return null
    return suggestNextSets({
      exerciseId,
      equipment: info.equipment,
      tracking: info.tracking,
      previous: previousSets(options.history, exerciseId, options.beforeIso),
      template,
      unit: options.unit,
    })
  }
}

/**
 * Die Vorgabe der Routine fuer die Uebung an Position `index` des Trainings
 * (`exerciseIds` = Kennungen der Uebungen in Reihenfolge). Kommt dieselbe
 * Uebung mehrfach vor, zaehlt das n-te Vorkommen — wie in `routineDiff`.
 */
export function routineTemplateFor(
  exerciseIds: readonly string[],
  routine: TrainingRoutine | null | undefined,
  index: number,
): RoutineExercise['sets'] | undefined {
  if (!routine) return undefined
  const id = exerciseIds[index]
  if (!id) return undefined
  const occurrence = exerciseIds.slice(0, index).filter(other => other === id).length
  return routine.exercises.filter(ex => ex.exerciseId === id)[occurrence]?.sets
}

const VALUE_KEYS = ['weightKg', 'reps', 'durationS', 'distanceM'] as const

/** Zeigt der Satz genau die Werte des Vorschlags? (Dann erscheinen sie im Logger als Vorschlag.) */
export function setMatchesSuggestion(set: TrainingSet, suggested: SuggestedSet | undefined): boolean {
  if (!suggested) return false
  return VALUE_KEYS.every(key => (set[key] ?? null) === (suggested[key] ?? null))
}

/** Steht der Vorschlag schon in allen offenen, nicht getippten Saetzen? */
export function suggestionApplied(sets: readonly TrainingSet[], suggestion: Suggestion): boolean {
  return sets.every((s, i) => s.done || s.touched || !suggestion.sets[i] || setMatchesSuggestion(s, suggestion.sets[i]))
}
