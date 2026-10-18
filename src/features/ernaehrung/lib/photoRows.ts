/**
 * Foto-Erkennung, Schritt für Schritt — die KI liefert nur Namen:
 * 1. Auswahl: mögliche Zutaten (sicher drin, üblich, Alternativen, optional);
 *    der Nutzer tippt an, was er wirklich genommen hat.
 * 2. Zuordnung: zu jeder gewählten Zutat Lebensmittel und Menge über die
 *    gewohnte Suche. Die Nährwerte kommen nur von dort.
 * Liegt bei der Seite, damit es das Suchen eines Lebensmittels übersteht.
 */
import type { Food } from './nutrition'

export type IngredientKind = 'visible' | 'usual' | 'alternative' | 'optional'

export interface Candidate {
  id: string
  name: string
  search: string
  kind: IngredientKind
  /** Nur bei Alternativen: wofür sie stehen, z. B. „Für die Cremigkeit". */
  group: string
  selected: boolean
}

export interface PhotoRow {
  /** Stabil über Entfernen hinweg (React-Schlüssel, Fokus); bei erkannten Zutaten die der Auswahl. */
  id: string
  /** Was erkannt wurde bzw. was der Nutzer ergänzt hat. */
  name: string
  /** Womit die Suche vorbelegt wird. */
  search: string
  food: Food | null
  amount: number | null
}

let nextId = 0
const newId = () => `photo-${++nextId}`

/** Vorausgewählt ist, was sicher oder üblicherweise drin ist — Alternativen und Optionales wählt der Nutzer. */
export function candidatesFrom(ingredients: readonly { name: string; search?: string; kind: IngredientKind; group?: string }[]): Candidate[] {
  return ingredients.map(i => ({
    id: newId(), name: i.name, search: i.search || i.name, kind: i.kind, group: i.group ?? '',
    selected: i.kind === 'visible' || i.kind === 'usual',
  }))
}

/** Für die Anzeige: sichere/übliche, dann je Gruppe die Alternativen, dann Optionales. */
export function groupCandidates(list: readonly Candidate[]): { core: Candidate[]; groups: { label: string; items: Candidate[] }[]; optional: Candidate[] } {
  const groups = new Map<string, Candidate[]>()
  for (const c of list) if (c.kind === 'alternative') groups.set(c.group, [...(groups.get(c.group) ?? []), c])
  return {
    core: list.filter(c => c.kind === 'visible' || c.kind === 'usual'),
    groups: [...groups].map(([label, items]) => ({ label, items })),
    optional: list.filter(c => c.kind === 'optional'),
  }
}

/**
 * Von der Auswahl zur Zuordnung. Schon zugeordnete Zeilen bleiben erhalten
 * (wer zurück zur Auswahl geht und wiederkommt, verliert nichts), selbst
 * ergänzte auch.
 */
export function rowsFromSelection(candidates: readonly Candidate[], previous: readonly PhotoRow[] | null): PhotoRow[] {
  const kept = new Map((previous ?? []).map(r => [r.id, r]))
  const candidateIds = new Set(candidates.map(c => c.id))
  const fromCandidates = candidates.filter(c => c.selected)
    .map(c => kept.get(c.id) ?? { id: c.id, name: c.name, search: c.search, food: null, amount: null })
  const added = (previous ?? []).filter(r => !candidateIds.has(r.id))
  return [...fromCandidates, ...added]
}

/** Gewähltes Lebensmittel eintragen: in Zeile `index`, oder als neue Zeile (null). */
export function chooseFood(rows: readonly PhotoRow[], index: number | null, food: Food, amount: number): PhotoRow[] {
  if (index === null || !rows[index]) return [...rows, { id: newId(), name: food.name, search: food.name, food, amount }]
  return rows.map((r, k) => (k === index ? { ...r, food, amount } : r))
}

/** Nur Zeilen mit Lebensmittel und Menge werden eingetragen. */
export function chosenRows(rows: readonly PhotoRow[]): { food: Food; amount: number }[] {
  return rows.flatMap(r => (r.food && r.amount ? [{ food: r.food, amount: r.amount }] : []))
}

/** Gesamter Stand der Foto-Erkennung (liegt bei der Seite). */
export interface PhotoFlow {
  /** Notiz, meist der Name des Gerichts — empfohlen, bei Suppen & Co. nötig. */
  hint: string
  /** Für „Neu erkennen" mit Notiz, ohne neu zu fotografieren. */
  file: File | null
  /** null = noch nichts erkannt. */
  result: { dish: string; needsNote: boolean; candidates: Candidate[] } | null
  /** Zuordnungen; bleiben erhalten, wenn der Nutzer zurück zur Auswahl geht. */
  rows: PhotoRow[] | null
  /** Welcher Schritt nach dem Erkennen gerade zu sehen ist. */
  step: 'select' | 'assign'
}

export const EMPTY_FLOW: PhotoFlow = { hint: '', file: null, result: null, rows: null, step: 'select' }
