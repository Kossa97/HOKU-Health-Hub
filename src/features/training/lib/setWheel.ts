import type { TrackingMode, TrainingSet, WeightUnit } from '../types'
import { usesReps, usesWeight } from './exerciseLookup'
import { fromDisplayWeight, toDisplayWeight } from './stats'

/**
 * Rechnen fuer die Raeder im Logger (components/live/SetWheelSheet): Gewicht
 * in ganze Zahl + Nachkomma zerlegen und zurueck in einen Satz-Patch.
 */

export const REPS_MAX = 100
export const WEIGHT_MAX: Record<WeightUnit, number> = { kg: 500, lb: 1100 }
/** Nachkommastellen je Einheit: kg in Vierteln (1,25er-Scheiben), lb in Halben. */
export const FRACTIONS: Record<WeightUnit, number[]> = { kg: [0, 0.25, 0.5, 0.75], lb: [0, 0.5] }

export interface Draft { reps: number; whole: number; frac: number }

export function toDraft(weightKg: number | null | undefined, reps: number | null | undefined, unit: WeightUnit, fallbackKg: number): Draft {
  const fractions = FRACTIONS[unit]
  const display = toDisplayWeight(weightKg ?? fallbackKg, unit)
  let whole = Math.floor(display + 1e-6)
  // Naechstes Nachkomma; rundet es auf 1,0, wandert es in die ganze Zahl.
  let frac = 0
  let best = Infinity
  for (let i = 0; i <= fractions.length; i++) {
    const value = i === fractions.length ? 1 : fractions[i]
    const diff = Math.abs(display - whole - value)
    if (diff < best) { best = diff; frac = i }
  }
  if (frac === fractions.length) { whole += 1; frac = 0 }
  return {
    reps: Math.min(REPS_MAX, Math.max(0, Math.round(reps ?? 10))),
    whole: Math.min(WEIGHT_MAX[unit], Math.max(0, whole)),
    frac,
  }
}

export type WheelField = 'weight' | 'reps'

/** Gedrehte Felder immer; beim Abhaken dazu die leeren. */
export function draftPatch(draft: Draft, turned: ReadonlySet<WheelField>, set: TrainingSet, markDone: boolean, tracking: TrackingMode, unit: WeightUnit): Partial<TrainingSet> | null {
  const patch: Partial<TrainingSet> = {}
  if (usesWeight(tracking) && (turned.has('weight') || (markDone && set.weightKg == null))) {
    patch.weightKg = fromDisplayWeight(draft.whole + FRACTIONS[unit][draft.frac], unit)
  }
  if (usesReps(tracking) && (turned.has('reps') || (markDone && set.reps == null))) patch.reps = draft.reps
  return Object.keys(patch).length ? patch : null
}
