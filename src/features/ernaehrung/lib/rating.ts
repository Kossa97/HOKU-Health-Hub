/**
 * Nährwert-Punkte 0–10 — wie „gut zusammengesetzt" ein Lebensmittel je 100 g ist.
 *
 * Angelehnt an die öffentliche Rechnung hinter dem Nutri-Score (Fassung 2017):
 * Energie, Zucker, gesättigte Fettsäuren und Salz zählen dagegen, Ballaststoffe und
 * Eiweiß dafür. Getränke (Einheit ml) haben eigene, strengere Schwellen für Energie
 * und Zucker. Das Ergebnis (−15 … 40) wird linear auf 0–10 gelegt (−6 → 10, 24 → 0),
 * eine Nachkommastelle. Bewusst ein eigener Name und keine Buchstaben: kein
 * Nutri-Score, keine Wertung „ungesund", keine Empfehlung.
 *
 * Fehlende Werte: Ein unbekannter Wert zählt nur dann als 0, wenn er sicher keinen
 * Minuspunkt brächte (gesättigte Fette höchstens so viel wie Fett, Zucker höchstens
 * so viel wie Kohlenhydrate). Sonst gibt es keine Punkte (null) — lieber nichts als
 * ein zu gutes Ergebnis. Obst-/Gemüseanteil kennt die App nicht; er zählt nicht mit.
 */
import type { FoodUnit, Per100 } from './nutrition'

/** Schwellen je Punkt (Nutri-Score 2017, Anhang): über diesem Wert gibt es den Punkt. */
const ENERGY_KJ = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]
const SUGAR_G = [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45]
const DRINK_ENERGY_KJ = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270]
const DRINK_SUGAR_G = [0, 1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5]
const SAT_FAT_G = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const SODIUM_MG = [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]
const FIBER_G = [0.9, 1.9, 2.8, 3.7, 4.7]
const PROTEIN_G = [1.6, 3.2, 4.8, 6.4, 8.0]

/** Punkte = Zahl der überschrittenen Schwellen („größer als“, wie in der Vorlage). */
const points = (value: number, steps: readonly number[]) => steps.filter(s => value > s).length

/** Unbekannter Wert mit Obergrenze: 0, wenn selbst die Obergrenze keinen Punkt bringt; sonst unbekannt. */
const boundedOrNull = (v: number | null, upper: number, steps: readonly number[]) =>
  v != null ? v : points(upper, steps) === 0 ? 0 : null

export function nutritionScore(p: Per100, unit: FoodUnit = 'g'): number | null {
  const drink = unit === 'ml'
  const sugarSteps = drink ? DRINK_SUGAR_G : SUGAR_G
  const sugar = boundedOrNull(p.sugar, p.carbs, sugarSteps)
  const satFat = boundedOrNull(p.satFat, p.fat, SAT_FAT_G)
  if (sugar == null || satFat == null || p.salt == null) return null
  const kj = p.kcal * 4.184
  const negative = points(kj, drink ? DRINK_ENERGY_KJ : ENERGY_KJ) + points(sugar, sugarSteps)
    + points(satFat, SAT_FAT_G) + points(p.salt * 400, SODIUM_MG)
  const fiber = points(p.fiber ?? 0, FIBER_G)
  const protein = points(p.protein, PROTEIN_G)
  // Wie in der Vorlage: ab 11 Minuspunkten zählt Eiweiß nicht mehr mit.
  const score = negative - fiber - (negative >= 11 ? 0 : protein)
  const scaled = 10 - ((score + 6) * 10) / 30
  return Math.round(Math.max(0, Math.min(10, scaled)) * 10) / 10
}

export type ScoreTone = 'good' | 'mid' | 'low'

/** Farbe der Anzeige: ab 7 gut, ab 4 mittel, darunter niedrig (orange, nie rot). */
export function scoreTone(score: number): ScoreTone {
  return score >= 7 ? 'good' : score >= 4 ? 'mid' : 'low'
}

/** „9,7" / „9.7" je nach Sprache. */
export function formatScore(score: number, lang: string): string {
  return score.toLocaleString(lang.startsWith('de') ? 'de-DE' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
