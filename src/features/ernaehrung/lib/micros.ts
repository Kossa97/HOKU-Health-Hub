/**
 * Mikronährstoffe: Schlüssel, Einheiten und Rechnen.
 *
 * Gespeichert werden sie je 100 g (Lebensmittel, `food_items.micros`, `food_catalog.micros`)
 * bzw. für die Menge eines Eintrags (`food_logs.micros`) als JSON — nur, was bekannt ist.
 * Ein fehlender Schlüssel heißt „unbekannt“, nicht 0. Quellen: BLS 4.0 (fast alle Werte),
 * Open Food Facts (was der Hersteller angibt). Einheiten wie hier; der BLS-Generator
 * (scripts/generate-bls-sql.py) rechnet B6, Kupfer und Mangan von µg in mg um.
 */

export const MICRO_KEYS = [
  'vitA', 'vitD', 'vitE', 'vitK', 'b1', 'b2', 'b3', 'b5', 'b6', 'b7', 'b9', 'b12', 'vitC',
  'k', 'ca', 'mg', 'p', 'fe', 'zn', 'cu', 'mn', 'i', 'se',
  'omega3', 'chol', 'trans',
] as const

export type MicroKey = (typeof MICRO_KEYS)[number]
export type Micros = Partial<Record<MicroKey, number>>

export type MicroUnit = 'g' | 'mg' | 'µg'

export const MICRO_UNIT: Record<MicroKey, MicroUnit> = {
  vitA: 'µg', vitD: 'µg', vitE: 'mg', vitK: 'µg', b1: 'mg', b2: 'mg', b3: 'mg', b5: 'mg', b6: 'mg', b7: 'µg',
  b9: 'µg', b12: 'µg', vitC: 'mg', k: 'mg', ca: 'mg', mg: 'mg', p: 'mg', fe: 'mg', zn: 'mg', cu: 'mg',
  mn: 'mg', i: 'µg', se: 'µg', omega3: 'g', chol: 'mg', trans: 'g',
}

const isKey = (k: string): k is MicroKey => (MICRO_KEYS as readonly string[]).includes(k)

/** Liest gespeichertes JSON; Unbekanntes und Unsinn (negativ, keine Zahl) fallen weg. Leer → null. */
export function parseMicros(raw: unknown): Micros | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: Micros = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
    if (isKey(k) && Number.isFinite(n) && n >= 0) out[k] = n
  }
  return Object.keys(out).length ? out : null
}

/** Rundet auf 4 signifikante Stellen — genug für µg bis g, ohne JSON-Ballast. */
const round = (v: number) => (v === 0 ? 0 : Number(v.toPrecision(4)))

export function scaleMicros(m: Micros | null | undefined, factor: number): Micros | null {
  if (!m) return null
  const out: Micros = {}
  for (const k of MICRO_KEYS) {
    const v = m[k]
    if (v != null) out[k] = round(v * factor)
  }
  return Object.keys(out).length ? out : null
}

/**
 * Summe mehrerer Einträge. `count` je Schlüssel: wie viele Einträge einen Wert hatten
 * (für „wenig Daten“: aus 3 von 7 Einträgen).
 */
export function sumMicros(list: readonly (Micros | null | undefined)[]): { total: Micros; count: Partial<Record<MicroKey, number>> } {
  const total: Micros = {}
  const count: Partial<Record<MicroKey, number>> = {}
  for (const m of list) {
    if (!m) continue
    for (const k of MICRO_KEYS) {
      const v = m[k]
      if (v == null) continue
      total[k] = (total[k] ?? 0) + v
      count[k] = (count[k] ?? 0) + 1
    }
  }
  for (const k of MICRO_KEYS) if (total[k] != null) total[k] = round(total[k]!)
  return { total, count }
}
