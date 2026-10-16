import type { DateRange } from '../types'
import { dayToTsSafe } from './dates'

const DAY_MS = 24 * 3_600_000

/** Schmaler wird das Sichtfenster nie — sonst stehen bei frischen Daten zwei Punkte am Rand. */
export const MIN_WINDOW_DAYS = 30

/**
 * Datengrenzen des Charts als Timestamps (12:00, wie die Punkte im Chart).
 * `now` ist nie kleiner als `start`, damit clampViewEnd nicht kippt.
 */
export function rangeBounds(range: DateRange): { start: number; now: number } {
  const fallback = Date.now()
  const start = dayToTsSafe(range.from, 12) ?? fallback
  const to = dayToTsSafe(range.to, 12) ?? fallback
  return { start, now: Math.max(start, to) }
}

/**
 * Sichtfenster des Verlaufs aus dem Seiten-Zeitraum (30T, 90T … Alles):
 * so breit wie der Zeitraum, mindestens MIN_WINDOW_DAYS. Ein Regler für die
 * ganze Seite statt eines zweiten im Chart.
 */
export function windowMsForRange(range: DateRange): number {
  const { start, now } = rangeBounds(range)
  // In ganzen Kalendertagen: über die Zeitumstellung wären es sonst 30 Tage ± 1 Stunde.
  const days = Math.round((now - start) / DAY_MS)
  return Math.max(MIN_WINDOW_DAYS, days) * DAY_MS
}
