/**
 * Open Food Facts: Anfragen bauen und Antworten in ein schlankes, geprüftes
 * Format bringen. Ohne Deno-APIs, damit Vitest es testen kann.
 *
 * OFF ist freiwillig gepflegt; Einträge ohne Namen oder Energie und solche mit
 * unmöglichen Werten werden verworfen, kJ ohne kcal wird umgerechnet.
 */

export const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'
export const OFF_SEARCH_URL = 'https://search.openfoodfacts.org/search'
export const USER_AGENT = 'TYD-TrackYourDose/1.0 (https://tyd-track-your-dose.vercel.app)'
export const FIELDS = [
  'code', 'product_name', 'product_name_de', 'product_name_en', 'brands',
  'nutriments', 'serving_size', 'serving_quantity', 'product_quantity_unit', 'quantity',
].join(',')

export interface OffFood {
  barcode: string | null
  name: string
  brand: string | null
  unit: 'g' | 'ml'
  per100: { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null; sugar: number | null; satFat: number | null; salt: number | null }
  serving: { amount: number; label: string | null } | null
}

type Raw = Record<string, unknown>

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null
}
const text = (v: unknown, max: number): string | null => {
  if (typeof v === 'string') { const s = v.trim(); return s ? s.slice(0, max) : null }
  // Search-a-licious liefert Marken teils als Liste.
  if (Array.isArray(v) && typeof v[0] === 'string') return text(v[0], max)
  return null
}
const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Ziffern prüfen und in die Form bringen, unter der OFF Produkte führt:
 * UPC-A (12 Stellen) als GTIN-13 mit führender 0. Gleiche Regel wie
 * `src/features/ernaehrung/lib/barcode.ts` (dort zusätzlich Prüfziffer).
 */
export function normalizeBarcode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/[\s-]/g, '')
  if (!/^\d{8,14}$/.test(digits)) return null
  return digits.length === 12 ? `0${digits}` : digits
}

export function normalizeQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const q = raw.replace(/\s+/g, ' ').trim()
  return q.length >= 2 && q.length <= 80 ? q : null
}

export function mapProduct(p: Raw, lang: 'de' | 'en'): OffFood | null {
  const name = text(p[`product_name_${lang}`], 120) ?? text(p.product_name, 120)
  const n = (p.nutriments && typeof p.nutriments === 'object' ? p.nutriments : {}) as Raw
  let kcal = num(n['energy-kcal_100g'])
  if (kcal == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g'])
    if (kj != null) kcal = kj / 4.184
  }
  if (!name || kcal == null || kcal > 900) return null
  const protein = num(n.proteins_100g) ?? 0
  const carbs = num(n.carbohydrates_100g) ?? 0
  const fatRaw = num(n.fat_100g)
  const fat = fatRaw ?? 0
  if (protein > 100 || carbs > 100 || fat > 100 || protein + carbs + fat > 105) return null
  const salt = num(n.salt_100g)
  // Gesättigte Fettsäuren: mehr als das Fett insgesamt ist unmöglich → verwerfen statt das Produkt
  // (bis 0,5 g Rundung auf der Packung wird auf das Fett gekappt). Ohne Fettangabe gilt der Wert, wie er ist.
  const satRaw = num(n['saturated-fat_100g'])
  const satFat = satRaw == null || satRaw > 100 ? null
    : fatRaw == null ? satRaw
      : satRaw <= fatRaw + 0.5 ? Math.min(satRaw, fatRaw) : null
  const unitRaw = String(p.product_quantity_unit ?? '').toLowerCase()
  const unit = unitRaw === 'ml' || /\d\s*(ml|l|cl)\b/i.test(String(p.quantity ?? '')) ? 'ml' : 'g'
  const serving = num(p.serving_quantity)
  const code = normalizeBarcode(p.code)
  return {
    barcode: code,
    name,
    brand: text(typeof p.brands === 'string' ? p.brands.split(',')[0] : p.brands, 120),
    unit,
    per100: {
      kcal: r1(kcal), protein: r1(protein), carbs: r1(carbs), fat: r1(fat),
      fiber: num(n.fiber_100g) == null ? null : r1(num(n.fiber_100g)!),
      sugar: num(n.sugars_100g) == null ? null : r1(num(n.sugars_100g)!),
      satFat: satFat == null ? null : r1(satFat),
      salt: salt == null ? null : Math.round(salt * 100) / 100,
    },
    serving: serving != null && serving > 0 && serving <= 2000
      ? { amount: r1(serving), label: text(p.serving_size, 40) }
      : null,
  }
}

/** Produktantwort (v2: `status: 1`, v3: `status: "success"`). */
export function parseProductResponse(json: unknown, lang: 'de' | 'en'): OffFood | null {
  if (!json || typeof json !== 'object') return null
  const j = json as Raw
  const ok = j.status === 1 || j.status === 'success' || j.status === 'success_with_warnings'
  if (!ok || !j.product || typeof j.product !== 'object') return null
  return mapProduct({ code: j.code, ...(j.product as Raw) }, lang)
}

/** Suchantwort (Search-a-licious: `hits`); Unbrauchbares und Dubletten fliegen raus. */
export function parseSearchResponse(json: unknown, lang: 'de' | 'en', limit = 25): OffFood[] {
  const hits = json && typeof json === 'object' && Array.isArray((json as Raw).hits) ? (json as Raw).hits as Raw[] : []
  const seen = new Set<string>()
  const out: OffFood[] = []
  for (const hit of hits) {
    const food = mapProduct(hit, lang)
    if (!food) continue
    const key = `${food.name.toLowerCase()}|${(food.brand ?? '').toLowerCase()}|${food.per100.kcal}`
    if (seen.has(key) || (food.barcode && seen.has(food.barcode))) continue
    seen.add(key)
    if (food.barcode) seen.add(food.barcode)
    out.push(food)
    if (out.length >= limit) break
  }
  return out
}

/**
 * Ein Produkt für den Substanz-Scan in My Stack. Supplements stehen oft ohne
 * Energieangabe in OFF; `mapProduct` würde sie verwerfen. Hier genügt ein
 * Name. Eiweiß kommt mit, wo es steht: bei Proteinpulver ist es die Stärke
 * („24 g je 30 g Portion").
 */
export interface OffItem {
  barcode: string | null
  name: string
  brand: string | null
  quantity: string | null
  /** Gramm Eiweiß je `per` Gramm — je Portion, sonst je 100 g. */
  protein: { amount: number; per: number } | null
}

export const ITEM_FIELDS = [
  'code', 'product_name', 'product_name_de', 'product_name_en', 'generic_name', 'brands', 'quantity',
  'nutriments', 'serving_quantity', 'serving_quantity_unit',
].join(',')

/** Eiweiß je Portion (wenn die Portion in Gramm angegeben ist), sonst je 100 g. */
function eiweiss(p: Raw): OffItem['protein'] {
  const n = (p.nutriments && typeof p.nutriments === 'object' ? p.nutriments : {}) as Raw
  const portion = num(p.serving_quantity)
  const portionInGramm = !p.serving_quantity_unit || String(p.serving_quantity_unit).toLowerCase() === 'g'
  const jePortion = num(n.proteins_serving)
  if (portion != null && portion > 0 && portion <= 500 && portionInGramm && jePortion != null && jePortion > 0 && jePortion <= portion) {
    return { amount: r1(jePortion), per: r1(portion) }
  }
  const je100 = num(n.proteins_100g)
  return je100 != null && je100 > 0 && je100 <= 100 ? { amount: r1(je100), per: 100 } : null
}

export function mapItem(p: Raw, lang: 'de' | 'en'): OffItem | null {
  const name = text(p[`product_name_${lang}`], 120) ?? text(p.product_name, 120) ?? text(p.generic_name, 120)
  if (!name) return null
  return {
    barcode: normalizeBarcode(p.code),
    name,
    brand: text(typeof p.brands === 'string' ? p.brands.split(',')[0] : p.brands, 120),
    quantity: text(p.quantity, 40),
    protein: eiweiss(p),
  }
}

export function parseItemResponse(json: unknown, lang: 'de' | 'en'): OffItem | null {
  if (!json || typeof json !== 'object') return null
  const j = json as Raw
  const ok = j.status === 1 || j.status === 'success' || j.status === 'success_with_warnings'
  if (!ok || !j.product || typeof j.product !== 'object') return null
  return mapItem({ code: j.code, ...(j.product as Raw) }, lang)
}

export function itemUrl(barcode: string): string {
  return `${OFF_PRODUCT_URL}/${barcode}.json?fields=${ITEM_FIELDS}`
}

export function productUrl(barcode: string): string {
  return `${OFF_PRODUCT_URL}/${barcode}.json?fields=${FIELDS}`
}

export function searchUrl(query: string, lang: 'de' | 'en'): string {
  const params = new URLSearchParams({ q: query, page_size: '30', langs: lang === 'de' ? 'de,en' : 'en,de', fields: FIELDS })
  return `${OFF_SEARCH_URL}?${params}`
}

/**
 * Gleitendes Fenster: höchstens `limit` Vorgänge je `windowMs` und Schlüssel.
 * Je Funktions-Instanz — ein grober Schutz, kein exakter globaler Zähler.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>()
  constructor(private limit: number, private windowMs: number, private now: () => number = Date.now) {}
  take(key: string): boolean {
    const t = this.now()
    const recent = (this.hits.get(key) ?? []).filter(x => x > t - this.windowMs)
    if (recent.length >= this.limit) { this.hits.set(key, recent); return false }
    recent.push(t)
    this.hits.set(key, recent)
    if (this.hits.size > 5000) this.hits.delete(this.hits.keys().next().value as string)
    return true
  }
}

/** Kleiner Zwischenspeicher je Funktions-Instanz (OFF-Limits schonen). */
export class TtlCache<T> {
  private map = new Map<string, { value: T; until: number }>()
  constructor(private ttlMs: number, private max = 500, private now: () => number = Date.now) {}
  get(key: string): T | undefined {
    const hit = this.map.get(key)
    if (!hit) return undefined
    if (hit.until < this.now()) { this.map.delete(key); return undefined }
    return hit.value
  }
  set(key: string, value: T): void {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value as string)
    this.map.set(key, { value, until: this.now() + this.ttlMs })
  }
}
