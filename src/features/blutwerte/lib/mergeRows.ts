import { normalizeMarker } from './markerCatalog'
import { convert, normalizeUnitString } from './unitConversion'

export interface MergeItem {
  marker: string
  value: number
  unit: string
  ref_min: number | null
  ref_max: number | null
}

export interface MergeConflict {
  key: string
  existing: MergeItem
  incoming: MergeItem
}

export interface MergeResult {
  /** Marker, die es noch nicht gab. */
  added: MergeItem[]
  /** Gleicher Marker, abweichender Wert — der Nutzer entscheidet. */
  conflicts: MergeConflict[]
  /** Anzahl exakter Dubletten, die übersprungen wurden. */
  duplicates: number
}

/** Dedup-Schlüssel: Katalog-kanonischer Name, sonst getrimmter Kleinbuchstaben-Name. */
export function markerKey(marker: string): string {
  const def = normalizeMarker(marker)
  return def ? def.name.toLowerCase() : marker.trim().toLowerCase()
}

const approxEqual = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))

/** Gleich, wenn der eingehende Wert – in die vorhandene Einheit umgerechnet – dem
 *  vorhandenen entspricht. Nicht umrechenbar: nur bei identischer Einheit und Wert. */
function sameValue(existing: MergeItem, incoming: MergeItem): boolean {
  const converted = convert(incoming.value, incoming.unit, existing.unit, normalizeMarker(incoming.marker)?.name)
  if (converted == null) {
    return (
      normalizeUnitString(existing.unit) === normalizeUnitString(incoming.unit) &&
      approxEqual(existing.value, incoming.value)
    )
  }
  return approxEqual(existing.value, converted)
}

/**
 * Führt eingehende Werte in einen vorhandenen Satz zusammen. Verändert die
 * übergebenen Arrays nicht. Neue Marker landen in added, exakte Dubletten werden
 * gezählt (duplicates), abweichende gleiche Marker werden zu conflicts.
 */
export function mergeIncoming(existing: MergeItem[], incoming: MergeItem[]): MergeResult {
  const byKey = new Map<string, MergeItem>()
  existing.forEach(item => byKey.set(markerKey(item.marker), item))

  const added: MergeItem[] = []
  const conflicts: MergeConflict[] = []
  let duplicates = 0

  incoming.forEach(item => {
    const key = markerKey(item.marker)
    const match = byKey.get(key)
    if (!match) {
      added.push(item)
      // Damit mehrere eingehende Werte desselben neuen Markers nicht doppeln:
      byKey.set(key, item)
      return
    }
    if (sameValue(match, item)) {
      duplicates += 1
      return
    }
    conflicts.push({ key, existing: match, incoming: item })
  })

  return { added, conflicts, duplicates }
}
