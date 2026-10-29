/**
 * Reihenfolge der Einträge in einer Mahlzeit. Ohne eigenen Wert zählt der Zeitpunkt
 * des Eintrags (ms); verschoben bekommt ein Eintrag die Mitte zwischen seinen neuen
 * Nachbarn — so ändert sich beim Verschieben nur diese eine Zeile.
 */
import type { LogEntry } from './nutrition'

/** Abstand zum Rand, wenn ganz oben oder ganz unten abgelegt wird (eine Sekunde). */
const STEP = 1000

export function entryKey(e: Pick<LogEntry, 'sortKey' | 'createdAt'>): number {
  if (e.sortKey != null && Number.isFinite(e.sortKey)) return e.sortKey
  const t = Date.parse(e.createdAt)
  return Number.isFinite(t) ? t : 0
}

export function byEntryOrder(a: LogEntry, b: LogEntry): number {
  return entryKey(a) - entryKey(b) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/**
 * Schlüssel für Platz `index` in `list` (die Ziel-Mahlzeit ohne den verschobenen Eintrag,
 * in Anzeigereihenfolge). Leere Liste: jetzt. `null`, wenn zwischen den Nachbarn kein Platz
 * ist — gleiche Zeit (in einem Rutsch eingetragen, etwa per Foto) oder zu oft halbiert;
 * dann `renumber`.
 */
export function keyAt(list: readonly LogEntry[], index: number, now = Date.now()): number | null {
  const i = Math.max(0, Math.min(index, list.length))
  const prev = list[i - 1]
  const next = list[i]
  if (prev && next) {
    const a = entryKey(prev)
    const b = entryKey(next)
    const mid = (a + b) / 2
    return mid > a && mid < b ? mid : null
  }
  if (prev) return entryKey(prev) + STEP
  if (next) return entryKey(next) - STEP
  return now
}

/**
 * Neue, gleichmäßige Schlüssel für die ganze Mahlzeit (mit dem verschobenen Eintrag an `index`).
 * Nur die Einträge, deren Schlüssel sich ändert, werden zurückgegeben.
 */
export function renumber(list: readonly LogEntry[], moved: LogEntry, index: number): { id: string; sortKey: number }[] {
  const i = Math.max(0, Math.min(index, list.length))
  const order = [...list.slice(0, i), moved, ...list.slice(i)]
  const base = Math.min(...order.map(entryKey))
  return order
    .map((e, n) => ({ id: e.id, sortKey: base + n * STEP, old: e.id === moved.id ? null : e.sortKey }))
    .filter(u => u.id === moved.id || u.old !== u.sortKey)
    .map(({ id, sortKey }) => ({ id, sortKey }))
}
