import type { StackItemDraft, StackItemIngredient } from '../types'

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

function normalizeNumber(value: number | null): string {
  return value === null ? '' : value.toString()
}

function ingredientFingerprint(ingredient: StackItemIngredient): string {
  const catalogSubstanceId = normalizeText(ingredient.catalog_substance_id ?? '')
  const identity = catalogSubstanceId
    ? `catalog:${catalogSubstanceId}`
    : `custom:${normalizeText(ingredient.custom_name ?? '')}`

  return JSON.stringify([
    identity,
    normalizeNumber(ingredient.amount_value),
    normalizeText(ingredient.amount_unit ?? ''),
    normalizeNumber(ingredient.basis_value),
    normalizeText(ingredient.basis_unit ?? ''),
  ])
}

export function buildDuplicateFingerprint(draft: StackItemDraft): string {
  const ingredients = draft.ingredients.map(ingredientFingerprint).sort()
  return JSON.stringify([normalizeText(draft.dosageForm ?? ''), ingredients])
}
