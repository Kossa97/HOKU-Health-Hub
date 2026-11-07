import type { RoutineExercise } from '../types'

/**
 * Mehrfachauswahl im Workout-Editor: markierte Uebungen kopieren, verschieben,
 * duplizieren, loeschen. Kopien behalten alle Werte (Saetze, Gewichte, Wdh.,
 * Pause, Notiz) — nur die Supersatz-Gruppe nicht: deren Nummer gilt nur im
 * Workout, aus dem die Uebung kommt.
 */

/** Tiefe Kopie ohne Supersatz-Gruppe. */
export function cloneExercise(exercise: RoutineExercise): RoutineExercise {
  const copy = JSON.parse(JSON.stringify(exercise)) as RoutineExercise
  delete copy.supersetGroup
  return copy
}

/** Die markierten Uebungen in Listenreihenfolge, als Kopien. */
export function pickSelected(list: readonly RoutineExercise[], selected: readonly number[]): RoutineExercise[] {
  return list.filter((_, i) => selected.includes(i)).map(cloneExercise)
}

/** Ohne die markierten Uebungen. */
export function withoutSelected(list: readonly RoutineExercise[], selected: readonly number[]): RoutineExercise[] {
  return list.filter((_, i) => !selected.includes(i))
}

/**
 * Jede markierte Uebung bekommt eine Kopie dahinter — liegt sie in einem
 * Supersatz, erst hinter dessen letzter Uebung, damit der Supersatz
 * zusammenhaengend bleibt.
 */
export function duplicateSelected(list: readonly RoutineExercise[], selected: readonly number[]): RoutineExercise[] {
  const out: RoutineExercise[] = []
  let pending: RoutineExercise[] = []
  list.forEach((ex, i) => {
    out.push(ex)
    if (selected.includes(i)) pending.push(cloneExercise(ex))
    const group = ex.supersetGroup
    const groupContinues = group != null && list[i + 1]?.supersetGroup === group
    if (!groupContinues) { out.push(...pending); pending = [] }
  })
  return out
}

/** Prueft gespeicherte Ablage-Eintraege grob (aus sessionStorage). */
export function isRoutineExercise(value: unknown): value is RoutineExercise {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<RoutineExercise>
  return typeof v.exerciseId === 'string' && Array.isArray(v.sets)
    && v.sets.every(s => !!s && typeof s === 'object' && typeof (s as { type?: unknown }).type === 'string')
}
