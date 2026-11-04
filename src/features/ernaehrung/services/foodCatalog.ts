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
