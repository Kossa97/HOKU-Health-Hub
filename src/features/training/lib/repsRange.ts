import type { RoutineSet } from '../types'

/**
 * v1-Routinen haben je Satz eine Wdh.-Zahl `reps`, v2 einen Bereich
 * `repsMin`–`repsMax`. Beim ersten Bearbeiten einer Grenze wird die alte Zahl
 * in beide Grenzen uebernommen; so bleibt die andere Grenze erhalten, wenn der
 * Nutzer nur eine aendert. Saetze ohne `reps` oder mit schon gesetztem Bereich
 * bleiben, wie sie sind.
 */
export function migrateRepsRange(set: RoutineSet): Pick<RoutineSet, 'repsMin' | 'repsMax'> {
  return {
    repsMin: set.repsMin ?? set.reps ?? null,
    repsMax: set.repsMax ?? set.reps ?? null,
  }
}
