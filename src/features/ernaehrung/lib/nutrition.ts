/**
 * Rechenkern der Ernährung — ohne React, ohne Netz, ohne Supabase.
 * Ein Lebensmittel trägt seine Werte je 100 g bzw. 100 ml; ein Eintrag im
 * Protokoll trägt die ausgerechneten Werte seiner Menge als Schnappschuss.
 */
import type { Recipe } from './recipe'
import { byEntryOrder } from './entryOrder'

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner', 'snack']

export type FoodSource = 'custom' | 'off' | 'bls'
export type EntrySource = FoodSource | 'quick'
export type FoodUnit = 'g' | 'ml'

export interface Per100 {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number | null
  sugar: number | null
  /** Gesättigte Fettsäuren — für die Nährwert-Punkte; ältere Daten haben keinen Wert. */
  satFat: number | null
  salt: number | null
}

export interface Food {
  /** `food_items.id`, wenn es ein eigenes (oder gemerktes) Lebensmittel ist. */
  itemId: string | null
  source: FoodSource
  /** EAN (Open Food Facts) bzw. BLS-Code; bei eigenen null. */
  sourceRef: string | null
  barcode: string | null
  name: string
  brand: string | null
  unit: FoodUnit
  per100: Per100
  /** Portion in g/ml, etwa „1 Scheibe = 40 g". */
  serving: { amount: number; label: string | null } | null
  favorite: boolean
  /** Nur bei Gerichten: Zutaten und Portionen (siehe recipe.ts). */
  recipe?: Recipe | null
  /** Nur bei Gerichten: passt zu dieser Mahlzeit (steht dort beim Hinzufügen oben). */
  meal?: Meal | null
}

export interface Nutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number | null
  sugar: number | null
  satFat: number | null
  salt: number | null
}

export interface LogEntry {
  id: string
  date: string
  meal: Meal
  itemId: string | null
  source: EntrySource
  sourceRef: string | null
  name: string
  brand: string | null
  unit: FoodUnit
  /** null nur beim Schnelleintrag (nur Kalorien). */
  amount: number | null
  nutrients: Nutrients
  createdAt: string
  /** Platz in der Mahlzeit (siehe entryOrder.ts); null = nach Zeitpunkt. */
  sortKey: number | null
}

export const MAX_AMOUNT = 5000
export const EMPTY_NUTRIENTS: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: null, sugar: null, satFat: null, salt: null }

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

// ─── Eingabe ────────────────────────────────────────────────────────────

/**
 * Zahl aus einem Eingabefeld: Komma oder Punkt, Leerzeichen egal.
 * Alles andere (leer, negativ, „1e3", „1,2,3") ergibt NaN.
 */
export function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.')
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN
}

/** Zahl fürs Eingabefeld: auf Deutsch mit Komma. `parseAmount` liest beides. */
export function showDecimal(n: number, lang: string): string {
  return lang.startsWith('de') ? String(n).replace('.', ',') : String(n)
}

export function amountValid(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT
}

// ─── Rechnen ────────────────────────────────────────────────────────────

export function nutrientsFor(per100: Per100, amount: number): Nutrients {
  const f = amount / 100
  const opt = (v: number | null, round: (n: number) => number = r1) => (v == null ? null : round(v * f))
  return {
    kcal: r1(per100.kcal * f),
    protein: r1(per100.protein * f),
    carbs: r1(per100.carbs * f),
    fat: r1(per100.fat * f),
    fiber: opt(per100.fiber),
    sugar: opt(per100.sugar),
    satFat: opt(per100.satFat),
    salt: opt(per100.salt, r2),
  }
}

/** Schnappschuss direkt skalieren — ohne Umweg über gerundete Werte je 100 g. */
export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const r = (v: number, d = 10) => Math.round(v * factor * d) / d
  return {
    kcal: r(n.kcal), protein: r(n.protein), carbs: r(n.carbs), fat: r(n.fat),
    fiber: n.fiber == null ? null : r(n.fiber), sugar: n.sugar == null ? null : r(n.sugar),
    satFat: n.satFat == null ? null : r(n.satFat),
    salt: n.salt == null ? null : r(n.salt, 100),
  }
}

/** Werte eines Eintrags auf 100 g/ml zurückrechnen (zum erneuten Loggen oder Ändern der Menge). */
export function per100FromEntry(e: Pick<LogEntry, 'amount' | 'nutrients'>): Per100 | null {
  if (!e.amount) return null
  const f = 100 / e.amount
  const opt = (v: number | null, round: (n: number) => number = r1) => (v == null ? null : round(v * f))
  return {
    kcal: r1(e.nutrients.kcal * f), protein: r1(e.nutrients.protein * f),
    carbs: r1(e.nutrients.carbs * f), fat: r1(e.nutrients.fat * f),
    fiber: opt(e.nutrients.fiber), sugar: opt(e.nutrients.sugar), satFat: opt(e.nutrients.satFat), salt: opt(e.nutrients.salt, r2),
  }
}

const addOpt = (a: number | null, b: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0))

/** Summe; Ballaststoffe/Zucker/gesättigte Fette/Salz bleiben null, solange kein Eintrag einen Wert kennt. */
export function sumNutrients(list: readonly Nutrients[]): Nutrients {
  const t = list.reduce<Nutrients>((a, n) => ({
    kcal: a.kcal + n.kcal, protein: a.protein + n.protein, carbs: a.carbs + n.carbs, fat: a.fat + n.fat,
    fiber: addOpt(a.fiber, n.fiber), sugar: addOpt(a.sugar, n.sugar), satFat: addOpt(a.satFat, n.satFat), salt: addOpt(a.salt, n.salt),
  }), EMPTY_NUTRIENTS)
  return {
    kcal: r1(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat),
    fiber: t.fiber == null ? null : r1(t.fiber),
    sugar: t.sugar == null ? null : r1(t.sugar),
    satFat: t.satFat == null ? null : r1(t.satFat),
    salt: t.salt == null ? null : r2(t.salt),
  }
}

export function groupByMeal(entries: readonly LogEntry[]): Record<Meal, LogEntry[]> {
  const out: Record<Meal, LogEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] }
  for (const e of entries) out[e.meal].push(e)
  for (const m of MEALS) out[m].sort(byEntryOrder)
  return out
}

/** Vorgeschlagene Mahlzeit nach Uhrzeit — spart beim Loggen einen Tipp. */
export function mealForHour(hour: number): Meal {
  if (hour >= 4 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 15) return 'lunch'
  if (hour >= 17 && hour < 22) return 'dinner'
  return 'snack'
}

// ─── Datenqualität ──────────────────────────────────────────────────────

/** Energie aus Makros (Atwater 4/4/9). */
export function kcalFromMacros(p: Pick<Per100, 'protein' | 'carbs' | 'fat'>): number {
  return p.protein * 4 + p.carbs * 4 + p.fat * 9
}

/**
 * Passen Kalorien und Makros nicht zusammen? Häufigster Fehler fremder
 * Datenbanken (kJ als kcal, Werte je Portion statt je 100 g, Tippfehler).
 * Großzügige Toleranz, weil Ballaststoffe, Alkohol und Polyole abweichen.
 */
export function macroMismatch(p: Pick<Per100, 'kcal' | 'protein' | 'carbs' | 'fat'>): boolean {
  const calc = kcalFromMacros(p)
  const diff = Math.abs(calc - p.kcal)
  return diff > 40 && diff > Math.max(p.kcal, calc) * 0.3
}

// ─── Ziele ──────────────────────────────────────────────────────────────

export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'high'
export type GoalKind = 'lose' | 'maintain' | 'gain'

export const ACTIVITY_FACTOR: Record<Activity, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 }

export interface Goals {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  waterMl: number
  hideKcal: boolean
}

export const DEFAULT_GOALS: Goals = { kcal: 2000, proteinG: 110, carbsG: 230, fatG: 65, waterMl: 2000, hideKcal: false }

/** Grenzen wie in der Datenbank (`nutrition_goals`). */
export const GOAL_LIMITS = {
  kcal: [1000, 6000], proteinG: [0, 500], carbsG: [0, 1000], fatG: [0, 400], waterMl: [0, 8000],
} as const

/** Grundumsatz nach Mifflin-St Jeor (1990). */
export function bmr(p: { sex: Sex; weightKg: number; heightCm: number; age: number }): number {
  return Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161))
}


/** Unter diese Werte geht ein automatischer Vorschlag nie. */
export const MIN_SUGGESTED_KCAL: Record<Sex, number> = { male: 1500, female: 1200 }

export interface GoalInput {
  sex: Sex
  weightKg: number
  heightCm: number
  age: number
  activity: Activity
  goal: GoalKind
}

/**
 * Bezugsgewicht fürs Eiweißziel: höchstens das Gewicht bei BMI 27. Sonst ergäbe
 * ein hohes Körpergewicht ein unrealistisches Ziel (1,6 g × 130 kg = 208 g).
 */
export function proteinReferenceKg(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return Math.min(weightKg, 27 * m * m)
}

/**
 * Zielvorschlag: Gesamtumsatz × Ziel (−15 % / ±0 / +10 %), nie unter die Untergrenze,
 * auf 10 kcal gerundet. Eiweiß je kg Bezugsgewicht — beim Abnehmen höher, damit
 * Muskulatur erhalten bleibt (unter GLP-1 besonders wichtig); Fett 27 % der
 * Energie, Rest Kohlenhydrate.
 */
export function suggestGoals(p: GoalInput): Omit<Goals, 'hideKcal'> {
  const tdee = bmr(p) * ACTIVITY_FACTOR[p.activity]
  const factor = p.goal === 'lose' ? 0.85 : p.goal === 'gain' ? 1.1 : 1
  const kcal = Math.max(MIN_SUGGESTED_KCAL[p.sex], Math.round((tdee * factor) / 10) * 10)
  const proteinG = Math.round(proteinReferenceKg(p.weightKg, p.heightCm) * (p.goal === 'lose' ? 1.6 : 1.4))
  const fatG = Math.round((kcal * 0.27) / 9)
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4))
  const waterMl = Math.min(GOAL_LIMITS.waterMl[1], Math.round((p.weightKg * 35) / 250) * 250)
  return { kcal, proteinG, carbsG, fatG, waterMl }
}

/** Anteil am Ziel (0…, über 1 = überschritten); ohne Ziel 0. */
export function share(value: number, goal: number): number {
  return goal > 0 ? value / goal : 0
}

/**
 * Bewertung ohne Rot und ohne Strafe: ±10 % um das Ziel gilt als „im Ziel".
 * Bewusst ein Bereich statt einer Punktlandung.
 */
export function goalBand(value: number, goal: number): 'under' | 'within' | 'over' {
  if (goal <= 0) return 'under'
  if (value < goal * 0.9) return 'under'
  if (value > goal * 1.1) return 'over'
  return 'within'
}
