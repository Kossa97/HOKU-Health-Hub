/**
 * Nährstoffe im Tag: welche es gibt, welches Ziel gilt und wie der Stand ist.
 *
 * Richtwerte: Referenzwerte der Deutschen Gesellschaft für Ernährung (DGE) für
 * Erwachsene, nach Geschlecht und Alter (ab 51 teils anders). Unbekanntes Geschlecht:
 * der höhere der beiden Werte. Grenzen (Zucker, gesättigte Fette, Transfette) hängen
 * vom Kalorienziel ab (WHO/DGE: höchstens 10 % bzw. 1 % der Energie). Obergrenzen (UL)
 * nach EFSA — nur, wo sie für Lebensmittel und Nahrungsergänzung zusammen gelten.
 * Jeder Wert lässt sich durch ein eigenes Ziel ersetzen.
 */
import { MICRO_UNIT, type MicroKey, type MicroUnit, type Micros } from './micros'

export type NutrientId = MicroKey | 'fiber' | 'sugar' | 'salt' | 'satFat'
export type NutrientGroup = 'limits' | 'fiberFat' | 'minerals' | 'vitamins'
export type NutrientKind = 'min' | 'max'

export interface NutrientDef {
  id: NutrientId
  group: NutrientGroup
  kind: NutrientKind
  unit: MicroUnit
  /** Obergrenze (EFSA), ab der zu viel schaden kann. */
  ul?: number
}

const d = (id: NutrientId, group: NutrientGroup, kind: NutrientKind, ul?: number): NutrientDef => ({
  id, group, kind, ul,
  unit: id === 'fiber' || id === 'sugar' || id === 'salt' || id === 'satFat' ? 'g' : MICRO_UNIT[id],
})

/** Reihenfolge der Anzeige: erst Grenzen, dann Ballaststoffe/Fette, Mineralstoffe, Vitamine. */
export const NUTRIENTS: readonly NutrientDef[] = [
  d('sugar', 'limits', 'max'), d('salt', 'limits', 'max'), d('satFat', 'limits', 'max'), d('trans', 'limits', 'max'), d('chol', 'limits', 'max'),
  d('fiber', 'fiberFat', 'min'), d('omega3', 'fiberFat', 'min'),
  d('k', 'minerals', 'min'), d('ca', 'minerals', 'min', 2500), d('mg', 'minerals', 'min'), d('p', 'minerals', 'min'),
  d('fe', 'minerals', 'min'), d('zn', 'minerals', 'min', 25), d('cu', 'minerals', 'min', 5), d('mn', 'minerals', 'min'),
  d('i', 'minerals', 'min', 600), d('se', 'minerals', 'min', 255),
  d('vitA', 'vitamins', 'min', 3000), d('vitC', 'vitamins', 'min'), d('vitD', 'vitamins', 'min', 100), d('vitE', 'vitamins', 'min', 300),
  d('vitK', 'vitamins', 'min'), d('b1', 'vitamins', 'min'), d('b2', 'vitamins', 'min'), d('b3', 'vitamins', 'min'),
  d('b5', 'vitamins', 'min'), d('b6', 'vitamins', 'min', 12), d('b7', 'vitamins', 'min'), d('b9', 'vitamins', 'min'),
  d('b12', 'vitamins', 'min'),
]

export const NUTRIENT_GROUPS: readonly NutrientGroup[] = ['limits', 'fiberFat', 'minerals', 'vitamins']

export const nutrientDef = (id: NutrientId) => NUTRIENTS.find(n => n.id === id)!

export interface TargetContext {
  sex: 'male' | 'female' | null
  age: number | null
  /** Kalorienziel (ohne Bewegung) — Grundlage für die Grenzen in Prozent der Energie. */
  kcal: number
}

/** [Männer, Frauen] für 25–50 Jahre; `older` ab 51, wo die DGE andere Werte nennt. */
const DGE: Partial<Record<NutrientId, { v: [number, number]; older?: [number, number] }>> = {
  fiber: { v: [30, 30] },
  k: { v: [4000, 4000] }, ca: { v: [1000, 1000] }, mg: { v: [350, 300] }, p: { v: [700, 700] },
  fe: { v: [11, 16], older: [11, 14] }, zn: { v: [14, 8] }, cu: { v: [1.5, 1.25] }, mn: { v: [3.5, 3.5] },
  i: { v: [200, 200], older: [180, 180] }, se: { v: [70, 60] },
  vitA: { v: [850, 700] }, vitC: { v: [110, 95] }, vitD: { v: [20, 20] }, vitE: { v: [14, 12], older: [13, 12] },
  vitK: { v: [70, 60], older: [80, 65] }, b1: { v: [1.2, 1.0] }, b2: { v: [1.4, 1.1], older: [1.3, 1.0] },
  b3: { v: [15, 12], older: [14, 11] }, b5: { v: [5, 5] }, b6: { v: [1.6, 1.4] }, b7: { v: [40, 40] },
  b9: { v: [300, 300] }, b12: { v: [4, 4] },
  salt: { v: [6, 6] }, chol: { v: [300, 300] },
}

/** Richtwert für diesen Menschen (ohne eigenes Ziel). */
export function referenceValue(id: NutrientId, ctx: TargetContext): number {
  const kcal = ctx.kcal > 0 ? ctx.kcal : 2000
  // Anteile der Energie: Zucker ≤ 10 % (4 kcal/g), gesättigte Fette ≤ 10 % und Transfette ≤ 1 % (9 kcal/g),
  // Omega-3 (Alpha-Linolensäure) 0,5 % (DGE).
  if (id === 'sugar') return Math.round((kcal * 0.1) / 4)
  if (id === 'satFat') return Math.round((kcal * 0.1) / 9)
  if (id === 'trans') return Math.round((kcal * 0.01) / 9 * 10) / 10
  if (id === 'omega3') return Math.round((kcal * 0.005) / 9 * 10) / 10
  const row = DGE[id]!
  const pair = ctx.age !== null && ctx.age >= 51 && row.older ? row.older : row.v
  return ctx.sex === 'male' ? pair[0] : ctx.sex === 'female' ? pair[1] : Math.max(pair[0], pair[1])
}

export type OwnGoals = Partial<Record<NutrientId, number>>

export function targetFor(id: NutrientId, ctx: TargetContext, own: OwnGoals): { value: number; own: boolean } {
  const mine = own[id]
  if (mine != null && mine > 0) return { value: mine, own: true }
  return { value: referenceValue(id, ctx), own: false }
}

/** Liest gespeicherte eigene Ziele; Unbekanntes und Unsinn fallen weg. */
export function parseOwnGoals(raw: unknown): OwnGoals {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: OwnGoals = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (NUTRIENTS.some(n => n.id === k) && typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100000) out[k as NutrientId] = v
  }
  return out
}

// ─── Stand des Tages ────────────────────────────────────────────────────

export interface DayNutrients {
  /** Summe je Nährstoff (nur Einträge, die den Wert kennen). */
  total: Partial<Record<NutrientId, number>>
  /** Wie viele Einträge den Wert kennen. */
  count: Partial<Record<NutrientId, number>>
  /** Einträge mit Lebensmittel (Schnelleinträge zählen nicht). */
  entries: number
}

export function dayNutrients(list: readonly { fiber: number | null; sugar: number | null; salt: number | null; satFat: number | null; micros?: Micros | null }[]): DayNutrients {
  const total: DayNutrients['total'] = {}
  const count: DayNutrients['count'] = {}
  const add = (id: NutrientId, v: number | null | undefined) => {
    if (v == null) return
    total[id] = (total[id] ?? 0) + v
    count[id] = (count[id] ?? 0) + 1
  }
  for (const n of list) {
    add('fiber', n.fiber); add('sugar', n.sugar); add('salt', n.salt); add('satFat', n.satFat)
    if (n.micros) for (const [k, v] of Object.entries(n.micros)) add(k as MicroKey, v)
  }
  return { total, count, entries: list.length }
}

export type NutrientState = 'gap' | 'low' | 'ok' | 'full' | 'near' | 'over'

export interface NutrientStatus {
  def: NutrientDef
  value: number
  target: number
  own: boolean
  /** Anteil am Ziel (0…). */
  p: number
  state: NutrientState
  /** Weniger als die Hälfte der Einträge kennt den Wert: zählt nicht als Lücke. */
  lowData: boolean
  known: number
  entries: number
}

/**
 * Lücken gibt es erst, wenn der Tag weit genug ist (sonst wäre morgens alles eine Lücke):
 * `dayDone` = vergangener Tag oder schon 70 % des Kalorienziels gegessen.
 * Mindestwerte: unter 50 % = Lücke, darüber knapp, ab 90 % = im Ziel (nur echte Lücken, kein Alarm
 * für alles, was noch etwas fehlt).
 * Grenzen: ab 80 % = nah dran, über 100 % = drüber — ohne Rot, nie eine „Lücke“.
 */
export function nutrientStatus(day: DayNutrients, ctx: TargetContext, own: OwnGoals, dayDone: boolean): NutrientStatus[] {
  return NUTRIENTS.map(def => {
    const { value: target, own: isOwn } = targetFor(def.id, ctx, own)
    const value = day.total[def.id] ?? 0
    const known = day.count[def.id] ?? 0
    const lowData = day.entries === 0 || known / day.entries < 0.5
    const p = target > 0 ? value / target : 0
    let state: NutrientState
    if (def.kind === 'max') state = p > 1 ? 'over' : p >= 0.8 ? 'near' : 'ok'
    else state = p >= 0.9 ? 'full' : p >= 0.5 ? 'low' : dayDone && !lowData ? 'gap' : 'low'
    return { def, value, target, own: isOwn, p, state, lowData, known, entries: day.entries }
  })
}

/** Im Rahmen: Mindestwert zu 90 % erreicht bzw. Grenze nicht überschritten — nur, wenn ein Eintrag den Wert kennt. */
export const inFrame = (s: NutrientStatus) => s.known > 0 && (s.def.kind === 'min' ? s.p >= 0.9 : s.p <= 1)

/** Lücken zuerst die größten. */
export const gapsOf = (list: readonly NutrientStatus[]) => list.filter(s => s.state === 'gap').sort((a, b) => a.p - b.p)

/** Anzeige einer Menge mit sinnvollen Stellen: 0,4 · 7,6 · 95 · 3200. */
export function formatAmount(v: number, lang: string): string {
  const digits = v >= 100 ? 0 : v >= 10 ? 0 : v >= 1 ? 1 : 2
  // Ohne Tausenderpunkt, wie die Zahlen unter der Kugel und in „Dein Tag“.
  return v.toLocaleString(lang, { maximumFractionDigits: digits, minimumFractionDigits: 0, useGrouping: false })
}
