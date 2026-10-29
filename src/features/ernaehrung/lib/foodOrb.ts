import type { ColorIndex } from './orbDraw'

export interface FoodOrbValues {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** Anteile der Makros an den Kalorien als Farbmischung (Eiweiß, Kohlenhydrate, Fett). */
export function macroMix(v: FoodOrbValues): [ColorIndex, number][] | null {
  const p = v.protein * 4, c = v.carbs * 4, f = v.fat * 9
  const sum = p + c + f
  if (!(sum > 0)) return null
  return [[2, p / sum], [3, (p + c) / sum], [4, 1]]
}
