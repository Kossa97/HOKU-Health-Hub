/**
 * Gerichte: eigene Lebensmittel aus mehreren Zutaten.
 *
 * Ein Gericht ist ein ganz normales eigenes Lebensmittel (`food_items`) mit
 * Werten je 100 g — ausgerechnet aus seinen Zutaten — und einer Portion
 * (Gesamtgewicht / Portionen). Dadurch funktionieren Eintragen, Häufig,
 * Suche, Stern und Schnappschuss ohne Sonderweg. Die Zutaten stehen als
 * Schnappschuss daneben, damit sich das Gericht später bearbeiten lässt.
 *
 * Zutaten in ml zählen beim Gewicht wie Gramm (Milch, Brühe: Abweichung
 * wenige Prozent).
 */
import { type Food, type FoodSource, type FoodUnit, type LogEntry, type Meal, type Nutrients, type Per100, MAX_AMOUNT, nutrientsFor, per100FromEntry, sumNutrients } from './nutrition'

export interface Ingredient {
  name: string
  brand: string | null
  source: FoodSource
  sourceRef: string | null
  unit: FoodUnit
  amount: number
  per100: Per100
}

export interface Recipe {
  portions: number
  ingredients: Ingredient[]
}

export const MAX_INGREDIENTS = 60
export const MIN_PORTIONS = 0.1
export const MAX_PORTIONS = 50

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

/** Wie in der Datenbank (`portions numeric(5,2)`): gespeichert wird auf zwei Stellen gerundet. */
export function portionsValid(n: number): boolean {
  return Number.isFinite(n) && r2(n) >= MIN_PORTIONS && r2(n) <= MAX_PORTIONS
}

export function ingredientFromFood(food: Food, amount: number): Ingredient {
  return { name: food.name, brand: food.brand, source: food.source, sourceRef: food.sourceRef, unit: food.unit, amount, per100: food.per100 }
}

/** Ein Protokolleintrag als Zutat (für „Als Gericht speichern"). Schnelleinträge haben keine Menge → null. */
export function ingredientFromEntry(e: LogEntry): Ingredient | null {
  if (e.source === 'quick') return null
  const per100 = per100FromEntry(e)
  if (!per100 || !e.amount) return null
  return { name: e.name, brand: e.brand, source: e.source, sourceRef: e.sourceRef, unit: e.unit, amount: e.amount, per100 }
}

export function recipeTotals(ingredients: readonly Ingredient[]): { weight: number; nutrients: Nutrients } {
  return {
    weight: r1(ingredients.reduce((s, i) => s + i.amount, 0)),
    nutrients: sumNutrients(ingredients.map(i => nutrientsFor(i.per100, i.amount))),
  }
}

/**
 * Das Gericht als Lebensmittel. null, wenn es nichts wiegt oder eine Portion
 * schwerer wäre, als ein Eintrag sein darf.
 */
export function recipeFood(d: { itemId: string | null; name: string; portions: number; ingredients: Ingredient[]; favorite: boolean; meal?: Meal | null }): Food | null {
  const { weight, nutrients: n } = recipeTotals(d.ingredients)
  if (!(weight > 0) || !portionsValid(d.portions)) return null
  const portions = r2(d.portions)
  const portion = r1(weight / portions)
  if (!(portion > 0) || portion > MAX_AMOUNT) return null
  const f = 100 / weight
  const opt = (v: number | null, round = r1) => (v == null ? null : round(v * f))
  return {
    itemId: d.itemId, source: 'custom', sourceRef: null, barcode: null,
    name: d.name.trim().slice(0, 120), brand: null, unit: 'g',
    per100: {
      kcal: r1(n.kcal * f), protein: r1(n.protein * f), carbs: r1(n.carbs * f), fat: r1(n.fat * f),
      fiber: opt(n.fiber), sugar: opt(n.sugar), satFat: opt(n.satFat), salt: opt(n.salt, r2),
    },
    serving: { amount: portion, label: null },
    favorite: d.favorite,
    recipe: { portions, ingredients: d.ingredients },
    meal: d.meal ?? null,
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const optNum = (v: unknown) => (isNum(v) ? v : null)

/** Zutaten aus der Datenbank lesen; Unbrauchbares fällt weg statt die Seite zu sprengen. */
export function parseIngredients(raw: unknown): Ingredient[] | null {
  if (!Array.isArray(raw)) return null
  const out: Ingredient[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const p = (o.per100 ?? {}) as Record<string, unknown>
    if (typeof o.name !== 'string' || !isNum(o.amount) || o.amount <= 0 || !isNum(p.kcal)) continue
    out.push({
      name: o.name,
      brand: typeof o.brand === 'string' ? o.brand : null,
      source: o.source === 'off' || o.source === 'bls' ? o.source : 'custom',
      sourceRef: typeof o.sourceRef === 'string' ? o.sourceRef : null,
      unit: o.unit === 'ml' ? 'ml' : 'g',
      amount: o.amount,
      per100: {
        kcal: p.kcal, protein: optNum(p.protein) ?? 0, carbs: optNum(p.carbs) ?? 0, fat: optNum(p.fat) ?? 0,
        fiber: optNum(p.fiber), sugar: optNum(p.sugar), satFat: optNum(p.satFat), salt: optNum(p.salt),
      },
    })
  }
  return out
}

/** Gramm als Portionen, höchstens zwei Nachkommastellen (Komma ist Sache der Anzeige). */
export function portionsText(amount: number, portion: number): number {
  return Math.round((amount / portion) * 100) / 100
}
