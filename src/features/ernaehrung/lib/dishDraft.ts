/** Bearbeitungsstand eines Gerichts im Editor (Texte statt Zahlen, damit halbe Eingaben stehen bleiben). */
import { type Food, type Meal, amountValid, parseAmount, showDecimal } from './nutrition'
import { type Ingredient, MAX_INGREDIENTS, ingredientFromFood, portionsValid, recipeFood } from './recipe'

/** Liegt bei der Seite, damit er das Zutat-Suchen übersteht. */
export interface DishDraft {
  itemId: string | null
  name: string
  portions: string
  items: { ing: Ingredient; text: string }[]
  favorite: boolean
  /** „Passt zu“: bei dieser Mahlzeit steht das Gericht beim Hinzufügen oben. */
  meal: Meal | null
}

/** `lang` bestimmt nur das Dezimalzeichen in den Feldern; `meal` ist der Vorschlag für „Passt zu“ bei neuen Gerichten. */
export function draftFromIngredients(list: Ingredient[], lang: string, base?: Food, meal: Meal | null = null): DishDraft {
  return {
    itemId: base?.itemId ?? null,
    name: base?.name ?? '',
    portions: showDecimal(base?.recipe?.portions ?? 1, lang),
    items: list.slice(0, MAX_INGREDIENTS).map(ing => ({ ing, text: showDecimal(ing.amount, lang) })),
    favorite: base?.favorite ?? false,
    meal: base ? (base.meal ?? null) : meal,
  }
}

export const draftFromDish = (dish: Food, lang: string) => draftFromIngredients(dish.recipe?.ingredients ?? [], lang, dish)

export function addToDraft(draft: DishDraft, food: Food, amount: number, lang: string): DishDraft {
  if (draft.items.length >= MAX_INGREDIENTS) return draft
  return { ...draft, items: [...draft.items, { ing: ingredientFromFood(food, amount), text: showDecimal(amount, lang) }] }
}

/** Das Gericht, wie es gespeichert würde — oder null, solange etwas fehlt. */
export function dishFromDraft(d: DishDraft): Food | null {
  const portions = parseAmount(d.portions)
  const amounts = d.items.map(i => parseAmount(i.text))
  if (!d.name.trim() || !d.items.length || !portionsValid(portions) || !amounts.every(amountValid)) return null
  return recipeFood({
    itemId: d.itemId, name: d.name, portions, favorite: d.favorite, meal: d.meal,
    ingredients: d.items.map((i, k) => ({ ...i.ing, amount: amounts[k] })),
  })
}
