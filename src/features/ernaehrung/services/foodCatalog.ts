/**
 * Bundeslebensmittelschlüssel (BLS 4.0, Max Rubner-Institut, CC BY 4.0) als Datei in der App:
 * `public/data/bls-4.0.json`, generiert von scripts/generate-bls-json.py (npm run bls:json).
 * Grundnahrungsmittel ohne Marke, je 100 g, mit Vitaminen und Mineralstoffen.
 * Geladen beim ersten Suchen (rund 0,6 MB komprimiert), danach aus dem Speicher; gesucht
 * wird lokal — schnell und auch ohne Netz.
 */
import type { Food } from '../lib/nutrition'
import { MICRO_KEYS, type MicroKey, type Micros } from '../lib/micros'
import { matchScore } from '../lib/foodSearch'

type Row = [string, string, string, number, number, number, number, number | null, number | null, number | null, number | null, (number | null)[]]

interface CatalogFile {
  micros: string[]
  rows: Row[]
}

interface Entry {
  row: Row
  /** Kleingeschrieben, Deutsch + Englisch, dazu ohne Leerzeichen: für den Vorfilter. */
  hay: string
}

let loading: Promise<{ entries: Entry[]; keys: (MicroKey | null)[] }> | null = null

const isKey = (k: string): k is MicroKey => (MICRO_KEYS as readonly string[]).includes(k)

function load() {
  loading ??= fetch(`${import.meta.env.BASE_URL}data/bls-4.0.json`)
    .then(r => { if (!r.ok) throw new Error(`bls ${r.status}`); return r.json() as Promise<CatalogFile> })
    .then(file => ({
      keys: file.micros.map(k => (isKey(k) ? k : null)),
      entries: file.rows.map(row => {
        const de = row[1].toLowerCase()
        return { row, hay: `${de} ${row[2].toLowerCase()} ${de.replace(/[\s,()/-]+/g, '')}` }
      }),
    }))
    .catch(e => { loading = null; throw e })
  return loading
}

function toFood(row: Row, keys: (MicroKey | null)[], lang: 'de' | 'en'): Food {
  const [code, de, en, kcal, protein, carbs, fat, fiber, sugar, salt, satFat, values] = row
  const micros: Micros = {}
  values.forEach((v, i) => { const k = keys[i]; if (k && v != null) micros[k] = v })
  return {
    itemId: null, source: 'bls', sourceRef: code, barcode: null,
    name: lang === 'en' && en ? en : de, brand: null, unit: 'g',
    per100: { kcal, protein, carbs, fat, fiber, sugar, satFat, salt, micros: Object.keys(micros).length ? micros : null },
    serving: null, favorite: false,
  }
}

/**
 * Alle Wörter müssen vorkommen (Deutsch oder Englisch, auch zusammengeschrieben).
 * Bessere Treffer und kürzere Namen (meist das Grundlebensmittel) zuerst.
 */
export async function searchCatalog(query: string, lang: 'de' | 'en', limit = 60): Promise<Food[]> {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length >= 2).slice(0, 5)
  if (!words.length) return []
  const { entries, keys } = await load()
  const hits: { food: Food; score: number; len: number }[] = []
  for (const e of entries) {
    if (!words.every(w => e.hay.includes(w))) continue
    const food = toFood(e.row, keys, lang)
    hits.push({ food, score: matchScore(query, food), len: food.name.length })
  }
  return hits
    .sort((a, b) => b.score - a.score || a.len - b.len)
    .slice(0, limit)
    .map(h => h.food)
}

/** Spalte eines Nährstoffs außerhalb von `micros` (Ballaststoffe, Zucker, Salz, gesättigte Fette). */
const MACRO_COL: Record<string, number> = { fiber: 7, sugar: 8, salt: 9, satFat: 10 }

/**
 * Alltagslebensmittel (BLS-Codes), aus denen die „guten Quellen“ eines Nährstoffs gewählt werden.
 * Reine Rangfolge je 100 g brächte sonst Innereien, Kleie, Jodsalz und Lebertran nach vorn.
 */
const EVERYDAY = new Set([
  'C133000', 'B101000', 'H725100', 'F302100', 'T410100', 'Q160000', 'H120100', 'Q180000', 'K110100', 'F503100',
  'G211100', 'M304600', 'M111300', 'M141300', 'G322100', 'H430100', 'H170100', 'V416100', 'U201000', 'H310100',
  'H130100', 'C359000', 'T207100', 'T204100', 'G620100', 'K420100', 'G543100', 'G312100', 'F603100', 'F514100',
  'T102100', 'K701100', 'E111100', 'H210100', 'Q320000', 'G250100', 'U601000', 'G760100', 'T121100', 'H110600',
  'F502100', 'G770400', 'Q630000', 'T105100',
])

/** Gute Quellen eines Nährstoffs: die reichsten Alltagslebensmittel je 100 g. */
export async function topSources(id: string, lang: 'de' | 'en', limit = 4): Promise<{ name: string; per100: number }[]> {
  const { entries, keys } = await load()
  const mi = keys.indexOf(id as MicroKey)
  const col = MACRO_COL[id]
  if (mi < 0 && col === undefined) return []
  return entries
    .filter(e => EVERYDAY.has(e.row[0]))
    .map(({ row }) => ({ row, v: col !== undefined ? row[col] : row[11][mi] }))
    .filter((x): x is { row: Row; v: number } => typeof x.v === 'number' && x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, limit)
    .map(({ row, v }) => ({ name: lang === 'en' && row[2] ? row[2] : row[1], per100: v }))
}
