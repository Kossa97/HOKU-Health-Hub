import { normalizeMarker } from './markerCatalog'
import { convert, normalizeUnitString } from './unitConversion'
import { formatNumber } from './format'

/**
 * Liefert einen Hinweistext wie "≈ 1.310 ng/dL", wenn die eingegebene Einheit von
 * der Katalog-Einheit des Markers abweicht und sicher umrechenbar ist. Sonst null
 * (gleiche Einheit, unbekannter Marker, leere Einheit oder molare/nicht umrechenbare Einheit).
 */
export function conversionHint(marker: string, unit: string, value: number): string | null {
  if (!Number.isFinite(value)) return null
  const def = normalizeMarker(marker)
  if (!def || !def.einheit) return null
  if (!unit.trim()) return null
  if (normalizeUnitString(unit) === normalizeUnitString(def.einheit)) return null
  const converted = convert(value, unit, def.einheit, def.name)
  if (converted == null) return null
  return `≈ ${formatNumber(converted)} ${def.einheit}`
}
