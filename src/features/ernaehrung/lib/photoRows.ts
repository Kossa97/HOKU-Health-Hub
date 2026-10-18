/**
 * Prüfliste nach der Foto-Erkennung: Die KI liefert nur Namen; zu jeder Zeile
 * wählt der Nutzer Lebensmittel und Menge. Liegt bei der Seite, damit sie das
 * Suchen eines Lebensmittels übersteht.
 */
import type { Food } from './nutrition'

export interface PhotoRow {
  /** Stabil über Entfernen hinweg (React-Schlüssel, Fokus). */
  id: string
  /** Was die KI erkannt hat. */
  name: string
  /** Womit die Suche vorbelegt wird. */
  search: string
  unsure: boolean
  food: Food | null
  amount: number | null
}

let nextId = 0
const newId = () => `row-${++nextId}`

export function rowsFromItems(items: readonly { name: string; search?: string; confidence: 'low' | 'medium' | 'high' }[]): PhotoRow[] {
  return items.map(i => ({ id: newId(), name: i.name, search: i.search || i.name, unsure: i.confidence === 'low', food: null, amount: null }))
}

/** Gewähltes Lebensmittel eintragen: in Zeile `index`, oder als neue Zeile (null). */
export function chooseFood(rows: readonly PhotoRow[], index: number | null, food: Food, amount: number): PhotoRow[] {
  if (index === null || !rows[index]) return [...rows, { id: newId(), name: food.name, search: food.name, unsure: false, food, amount }]
  return rows.map((r, k) => (k === index ? { ...r, food, amount } : r))
}

/** Nur Zeilen mit Lebensmittel und Menge werden eingetragen. */
export function chosenRows(rows: readonly PhotoRow[]): { food: Food; amount: number }[] {
  return rows.flatMap(r => (r.food && r.amount ? [{ food: r.food, amount: r.amount }] : []))
}
