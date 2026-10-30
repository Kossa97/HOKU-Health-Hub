/**
 * Open Food Facts über unsere Edge Function `food-lookup`
 * (`supabase/functions/food-lookup`). Die Funktion liefert schon geprüfte,
 * schlanke Datensätze; hier werden sie nur zum `Food` der App.
 */
import { FUNKTIONS_REGION, supabase } from '../../../lib/supabase'
import type { Food, FoodUnit, Per100 } from '../lib/nutrition'

interface OffFood {
  barcode: string | null
  name: string
  brand: string | null
  unit: FoodUnit
  /** Ältere Fassungen der Edge Function liefern noch keine gesättigten Fettsäuren. */
  per100: Omit<Per100, 'satFat'> & { satFat?: number | null }
  serving: { amount: number; label: string | null } | null
}

export class LookupUnavailableError extends Error {
  constructor() { super('food_lookup_unavailable') }
}

export function fromOff(f: OffFood): Food {
  return {
    itemId: null, source: 'off', sourceRef: f.barcode, barcode: f.barcode,
    name: f.name, brand: f.brand, unit: f.unit === 'ml' ? 'ml' : 'g',
    per100: { ...f.per100, satFat: f.per100.satFat ?? null }, serving: f.serving, favorite: false,
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('food-lookup', { body, region: FUNKTIONS_REGION })
  if (error || !data || typeof data !== 'object') throw new LookupUnavailableError()
  return data as T
}

/** `null` = OFF kennt den Barcode nicht. Wirft `LookupUnavailableError`, wenn OFF/Netz nicht erreichbar ist. */
export async function lookupBarcode(barcode: string, lang: 'de' | 'en'): Promise<Food | null> {
  const data = await invoke<{ product?: OffFood | null }>({ barcode, lang })
  return data.product ? fromOff(data.product) : null
}

export async function searchBrands(query: string, lang: 'de' | 'en'): Promise<Food[]> {
  const data = await invoke<{ results?: OffFood[] }>({ query, lang })
  return (data.results ?? []).map(fromOff)
}
