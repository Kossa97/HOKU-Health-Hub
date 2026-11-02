import type { RoutineExercise, TrainingRoutine } from '../types'
import { createClipboard } from './clipboard'
import { cloneExercise, isRoutineExercise } from './exerciseSelection'

/** Ablage fuer kopierte Uebungen (Workout-Editor). */
const exercises = createClipboard<RoutineExercise>('tyd.training.clipboard', isRoutineExercise, cloneExercise)

export const copyToClipboard = exercises.copy
export const clipboardCopies = exercises.copies
export const clearClipboard = exercises.clear
export const useExerciseClipboard = exercises.useItems

/** Ein kopiertes Workout: alles ausser Kennung und Plan (die setzt das Einfuegen). */
export type WorkoutCopy = Pick<TrainingRoutine, 'name' | 'kind' | 'exercises' | 'weekdays'>

const isWorkoutCopy = (value: unknown): value is WorkoutCopy => {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<WorkoutCopy>
  return typeof v.name === 'string' && typeof v.kind === 'string' && Array.isArray(v.weekdays)
    && Array.isArray(v.exercises) && v.exercises.every(isRoutineExercise)
}

const cloneWorkout = (w: WorkoutCopy): WorkoutCopy => ({ name: w.name, kind: w.kind, weekdays: [...w.weekdays], exercises: w.exercises.map(e => JSON.parse(JSON.stringify(e)) as RoutineExercise) })

/** Ablage fuer kopierte Workouts (Plan-Bildschirm, Workout-Editor). */
const workouts = createClipboard<WorkoutCopy>('tyd.training.clipboard.workouts', isWorkoutCopy, cloneWorkout, 10)

export const copyWorkout = (routine: TrainingRoutine | WorkoutCopy) => workouts.copy([{ name: routine.name, kind: routine.kind, weekdays: routine.weekdays, exercises: routine.exercises }])
export const workoutCopies = workouts.copies
export const useWorkoutClipboard = workouts.useItems
