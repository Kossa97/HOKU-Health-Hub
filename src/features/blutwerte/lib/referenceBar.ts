import type { EffectiveRange } from './bloodwork'

export interface ReferenceBarGeometry {
  /** Position des aktuellen Werts auf der Skala, 0–100. */
  valuePercent: number
  /** Start der grünen Zone, 0–100. */
  zoneStartPercent: number
  /** Ende der grünen Zone, 0–100. */
  zoneEndPercent: number
  /** Skalenränder für die Beschriftung. */
  scaleMin: number
  scaleMax: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Die Skala umfasst den Referenzbereich plus 50% Puffer auf beiden Seiten, damit
 * die grüne Zone mittig sitzt und Ausreißer sichtbar am Rand kleben — links
 * aber nie unter 0.
 * Ohne Obergrenze ist keine sinnvolle Skala bestimmbar — dann kein Balken.
 */
export function referenceBarGeometry(value: number, range: EffectiveRange): ReferenceBarGeometry | null {
  if (!Number.isFinite(value)) return null
  if (range.max == null) return null

  const min = range.min ?? 0
  const max = range.max
  if (!(max > min)) return null

  const puffer = (max - min) * 0.5
  // Laborwerte sind nicht negativ: beginnt der Bereich bei 0 oder darueber,
  // endet die Skala links bei 0 statt bei einer negativen Zahl.
  const scaleMin = min >= 0 ? Math.max(0, min - puffer) : min - puffer
  const scaleMax = max + puffer
  const spanne = scaleMax - scaleMin

  const percent = (n: number) => clamp(((n - scaleMin) / spanne) * 100, 0, 100)

  return {
    valuePercent: percent(value),
    zoneStartPercent: percent(min),
    zoneEndPercent: percent(max),
    scaleMin,
    scaleMax,
  }
}
