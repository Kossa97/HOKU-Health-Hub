/**
 * Häufig gegessen, Zusammenführen und Sortieren der Suchtreffer.
 *
 * Reihenfolge der Quellen bei gleicher Trefferqualität: eigene Lebensmittel
 * (vom Nutzer geprüft) → BLS (amtlich, ohne Marke) → Open Food Facts
 * (Markenprodukte, freiwillig gepflegt). Gleiche Produkte erscheinen nur einmal.
 */
import { type Food, type LogEntry, type Meal, per100FromEntry } from './nutrition'

export interface FrequentFood {
  food: Food
  /** Zuletzt geloggte Menge — wird beim Antippen vorgeschlagen. */
  lastAmount: number
  count: number
  lastMeal: Meal
}

const identity = (name: string, brand: string | null) => `${name.trim().toLowerCase()}|${(brand ?? '').trim().toLowerCase()}`

/** Schlüssel für „dasselbe Lebensmittel" über Einträge hinweg. */
export function entryKey(e: Pick<LogEntry, 'itemId' | 'source' | 'sourceRef' | 'name' | 'brand'>): string {
  if (e.itemId) return `item:${e.itemId}`
  if (e.sourceRef) return `${e.source}:${e.sourceRef}`
  return `name:${identity(e.name, e.brand)}`
}

/**
 * Ein Eintrag als Lebensmittel (Werte je 100 g aus dem Schnappschuss) — zum
 * erneuten Loggen und Bearbeiten. Schnelleinträge haben keins (null).
 * Kennt die Liste „Meine Lebensmittel" das Lebensmittel, gewinnt deren Fassung.
 */
export function foodFromEntry(e: LogEntry, myFoods: readonly Food[] = []): Food | null {
  const mine = e.itemId ? myFoods.find(f => f.itemId === e.itemId) : undefined
  if (mine) return mine
  if (e.source === 'quick') return null
  const per100 = per100FromEntry(e)
  if (!per100) return null
  return {
    itemId: e.itemId, source: e.source, sourceRef: e.sourceRef,
    barcode: e.source === 'off' ? e.sourceRef : null,
    name: e.name, brand: e.brand, unit: e.unit, per100, serving: null, favorite: false,
  }
}

/**
 * Aus den letzten Einträgen (neueste zuerst) die häufigsten Lebensmittel.
 * Häufigkeit zählt, bei Gleichstand gewinnt das zuletzt gegessene.
 * Bevorzugt die Mahlzeit, für die gerade geloggt wird.
 */
export function frequentFoods(recent: readonly LogEntry[], meal: Meal | null, myFoods: readonly Food[] = [], limit = 15): FrequentFood[] {
  const map = new Map<string, FrequentFood & { order: number; mealHits: number }>()
  recent.forEach((e, order) => {
    if (e.source === 'quick' || !e.amount) return
    const key = entryKey(e)
    const hit = map.get(key)
    if (hit) {
      hit.count += 1
      if (meal && e.meal === meal) hit.mealHits += 1
      return
    }
    const food = foodFromEntry(e, myFoods)
    if (!food) return
    map.set(key, { food, lastAmount: e.amount, count: 1, lastMeal: e.meal, order, mealHits: meal && e.meal === meal ? 1 : 0 })
  })
  return [...map.values()]
    .sort((a, b) => b.mealHits - a.mealHits || b.count - a.count || a.order - b.order)
    .slice(0, limit)
    .map(({ food, lastAmount, count, lastMeal }) => ({ food, lastAmount, count, lastMeal }))
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')

/** 3 = beginnt mit der Anfrage, 2 = ein Wort beginnt damit, 1 = enthalten, 0 = kein Treffer. Alle Wörter müssen passen. */
export function matchScore(query: string, food: Pick<Food, 'name' | 'brand'>): number {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return 0
  const name = fold(food.name)
  const hay = `${name} ${fold(food.brand ?? '')}`
  if (!words.every(w => hay.includes(w))) return 0
  if (name.startsWith(words.join(' '))) return 3
  return name.split(/[\s,()/-]+/).some(part => part.startsWith(words[0])) ? 2 : 1
}

const SOURCE_RANK: Record<Food['source'], number> = { custom: 0, bls: 1, off: 2 }

/**
 * Treffer aller Quellen zusammenführen. Eigene Lebensmittel und BLS werden
 * hier gefiltert; Open-Food-Facts-Treffer kommen schon gefiltert vom Server
 * und behalten ihre Reihenfolge, wenn der Name die Anfrage nicht enthält.
 */
export function mergeResults(query: string, groups: { own: readonly Food[]; bls: readonly Food[]; off: readonly Food[] }, limit = 40): Food[] {
  const scored: { food: Food; score: number; order: number }[] = []
  let order = 0
  for (const f of groups.own) { const s = matchScore(query, f); if (s) scored.push({ food: f, score: s + 10, order: order++ }) }
  // Amtliche Grunddaten eine Stufe vor Markenprodukten: „Quark" → erst Speisequark, dann Skyr.
  for (const f of groups.bls) { const s = matchScore(query, f); if (s) scored.push({ food: f, score: s + 1, order: order++ }) }
  for (const f of groups.off) scored.push({ food: f, score: Math.max(matchScore(query, f), 0.5), order: order++ })

  const seen = new Set<string>()
  return scored
    .sort((a, b) => b.score - a.score || SOURCE_RANK[a.food.source] - SOURCE_RANK[b.food.source] || a.order - b.order)
    .filter(({ food }) => {
      const keys = [
        food.barcode ? `ean:${food.barcode}` : null,
        food.sourceRef ? `${food.source}:${food.sourceRef}` : null,
        `name:${identity(food.name, food.brand)}:${Math.round(food.per100.kcal)}`,
      ].filter((k): k is string => k !== null)
      if (keys.some(k => seen.has(k))) return false
      keys.forEach(k => seen.add(k))
      return true
    })
    .slice(0, limit)
    .map(s => s.food)
}
