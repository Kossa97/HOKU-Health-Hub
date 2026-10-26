/**
 * Gericht-Kugel im Editor: eine Portion als Kugel, 1 Punkt = 1 kcal — gleicher
 * Mechanismus wie die Tageskugel, nur ein Orb statt vier. Die Plätze werden von
 * unten nach Zutaten vergeben, damit sich die Punkte einer Zutat hervorheben lassen.
 */
import type { DishDraft } from './dishDraft'
import { MAX_DOTS } from './orb'
import { type Nutrients, type Per100, EMPTY_NUTRIENTS, amountValid, nutrientsFor, parseAmount, scaleNutrients, sumNutrients } from './nutrition'
import { portionsValid, recipeFood } from './recipe'

export interface DishOrbModel {
  /** Gültige Portionenzahl, sonst `fallback` (die zuletzt gültige — die Kugel springt nicht, während man tippt). */
  portions: number
  /** Je Portion; Zutaten ohne gültige Menge zählen nicht. */
  portion: Nutrients
  /** Plätze je Zutat (von unten gezählt, je Portion): [from, to). */
  parts: { from: number; to: number }[]
  /** Ganzes Gericht je 100 g (für die Nährwert-Punkte), aus den Zutaten mit gültiger Menge; ohne solche null. */
  per100: Per100 | null
}

export function dishOrbModel(draft: DishDraft, fallback = 1): DishOrbModel {
  const typed = parseAmount(draft.portions)
  const portions = portionsValid(typed) ? typed : fallback
  const each = draft.items.map(({ ing, text }) => {
    const amount = parseAmount(text)
    return amountValid(amount) ? scaleNutrients(nutrientsFor(ing.per100, amount), 1 / portions) : EMPTY_NUTRIENTS
  })
  let at = 0
  const parts = each.map(n => {
    const from = Math.min(MAX_DOTS, Math.round(at))
    at += Math.max(0, n.kcal)
    return { from, to: Math.min(MAX_DOTS, Math.round(at)) }
  })
  const valid = draft.items.flatMap(({ ing, text }) => (amountValid(parseAmount(text)) ? [{ ...ing, amount: parseAmount(text) }] : []))
  const per100 = valid.length ? recipeFood({ itemId: null, name: '', portions, ingredients: valid, favorite: false })?.per100 ?? null : null
  return { portions, portion: each.length ? sumNutrients(each) : EMPTY_NUTRIENTS, parts, per100 }
}

/** Punkte der Kugel: 1 je kcal, höchstens so viele wie die Tageskugel haben kann. */
export const dishDots = (kcal: number) => Math.max(0, Math.min(MAX_DOTS, Math.round(kcal)))
