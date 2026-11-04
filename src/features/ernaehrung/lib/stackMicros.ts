/**
 * Vitamine und Mineralstoffe aus My Stack: was an einem Tag als „genommen“ eingetragen
 * ist (`dose_logs.taken = true`), mit der Stärke je Inhaltsstoff aus `stack_item_ingredients`
 * („25 mcg je 1 Kapsel“). Die Menge auf der Packung gilt so, wie sie dort steht — bei
 * Mineralstoffen ist das fast immer schon der elementare Anteil („Magnesium 300 mg“).
 */
import { MICRO_UNIT, type MicroKey, type Micros } from './micros'

/** Wirkstoffname → Nährstoff. Kombinationen („D3 + K2“) stehen als eigene Inhaltsstoffe im Stack. */
const NAME_TO_KEY: [RegExp, MicroKey][] = [
  [/vitamin\s*d|cholecalciferol|ergocalciferol/i, 'vitD'],
  [/vitamin\s*k|menachinon|menaquinone|phyllochinon|phylloquinone|\bmk-?7\b/i, 'vitK'],
  [/vitamin\s*c\b|ascorbin/i, 'vitC'],
  [/vitamin\s*a\b|retinol/i, 'vitA'],
  [/vitamin\s*e\b|tocopherol/i, 'vitE'],
  [/vitamin\s*b\s*12|cobalamin/i, 'b12'],
  [/vitamin\s*b\s*6|pyridox/i, 'b6'],
  [/vitamin\s*b\s*1\b|thiamin/i, 'b1'],
  [/vitamin\s*b\s*2\b|riboflavin/i, 'b2'],
  [/vitamin\s*b\s*3\b|niacin|nicotinamid/i, 'b3'],
  [/vitamin\s*b\s*5\b|pantothen/i, 'b5'],
  [/vitamin\s*b\s*7\b|biotin/i, 'b7'],
  [/vitamin\s*b\s*9\b|fols[äa]ure|folat|folic|folate/i, 'b9'],
  [/magnesium/i, 'mg'],
  [/zink|zinc/i, 'zn'],
  [/eisen|\biron\b|ferro/i, 'fe'],
  [/calcium|kalzium/i, 'ca'],
  [/kalium|potassium/i, 'k'],
  [/selen/i, 'se'],
  [/\bjod|\biod/i, 'i'],
  [/kupfer|copper/i, 'cu'],
  [/mangan/i, 'mn'],
  // Nur ausdrücklich Omega-3/EPA/DHA: bei „Fischöl 1000 mg“ ist die Menge das Öl, nicht die Fettsäuren.
  [/omega.?3|\bepa\b|\bdha\b/i, 'omega3'],
]

export function microKeyFor(name: string | null | undefined): MicroKey | null {
  if (!name) return null
  // Mehrere Wirkstoffe in einem Namen („D3 + K2“, „ZMA“): nicht raten.
  if (/\+|&|\bund\b|\band\b/i.test(name)) return null
  for (const [re, key] of NAME_TO_KEY) if (re.test(name)) return key
  return null
}

const MASS: Record<string, number> = { g: 1, mg: 1e-3, mcg: 1e-6, 'µg': 1e-6, ug: 1e-6, 'μg': 1e-6 }
const APP: Record<string, number> = { g: 1, mg: 1e-3, 'µg': 1e-6 }

/** Menge in der App-Einheit des Nährstoffs; IE nur für Vitamin D (40 IE = 1 µg) und A (1 IE = 0,3 µg). */
export function toAppUnit(value: number, unit: string | null | undefined, key: MicroKey): number | null {
  if (!(value > 0) || !unit) return null
  const u = unit.trim().toLowerCase()
  if (u === 'iu' || u === 'ie' || u === 'i.e.') {
    if (key === 'vitD') return value / 40
    if (key === 'vitA') return value * 0.3
    return null
  }
  const g = MASS[u]
  if (g === undefined) return null
  return (value * g) / APP[MICRO_UNIT[key]]
}

export interface StackIngredient {
  name: string | null
  amount: number | null
  unit: string | null
  basisValue: number | null
  basisUnit: string | null
}

export interface StackLog {
  itemId: string
  itemName: string
  /** Eingetragene Menge (Produkteinheit, z. B. 2 Kapseln) — fehlt sie, gilt eine Basis-Einheit. */
  dose: number | null
  unit: string | null
}

export interface StackPart { key: MicroKey; item: string; amount: number }

/** Wie viel eines Inhaltsstoffs in dieser Einnahme steckt (in der Einheit des Inhaltsstoffs). */
function perIntake(ing: StackIngredient, log: StackLog, single: boolean): { value: number; unit: string } | null {
  if (!(ing.amount && ing.amount > 0) || !ing.unit) return null
  const basis = ing.basisValue && ing.basisValue > 0 ? ing.basisValue : 1
  if (log.dose == null || !(log.dose > 0)) return { value: ing.amount, unit: ing.unit }
  const doseUnit = (log.unit ?? '').trim().toLowerCase()
  const basisUnit = (ing.basisUnit ?? '').trim().toLowerCase()
  // „2 Kapseln“ bei „25 mcg je 1 Kapsel“ → 50 mcg
  if (!doseUnit || doseUnit === basisUnit) return { value: (log.dose / basis) * ing.amount, unit: ing.unit }
  // Als Masse eingetragen („300 mg“) bei nur einem Inhaltsstoff: das ist die Menge selbst.
  if (single && MASS[doseUnit] !== undefined) return { value: log.dose, unit: doseUnit }
  return null
}

export function stackMicros(logs: readonly StackLog[], ingredientsOf: (itemId: string) => readonly StackIngredient[]): { total: Micros; parts: StackPart[] } {
  const total: Micros = {}
  const byItem = new Map<string, StackPart>()
  for (const log of logs) {
    const ings = ingredientsOf(log.itemId)
    for (const ing of ings) {
      const key = microKeyFor(ing.name)
      if (!key) continue
      const raw = perIntake(ing, log, ings.length === 1)
      const v = raw ? toAppUnit(raw.value, raw.unit, key) : null
      if (v == null) continue
      total[key] = (total[key] ?? 0) + v
      const id = `${log.itemId}:${key}`
      const prev = byItem.get(id)
      byItem.set(id, { key, item: log.itemName, amount: (prev?.amount ?? 0) + v })
    }
  }
  return { total, parts: [...byItem.values()] }
}
