import type { BodyMeasurementEntry, DateRange } from '../types'
import type { SeriesPoint } from './metrics'
import { filterByDateRange } from './range'

export type MeasurementSite =
  | 'neck' | 'chest' | 'waist' | 'belly' | 'hips' | 'upper_arm' | 'forearm' | 'thigh' | 'calf'

export const MEASUREMENT_SITES: readonly MeasurementSite[] = [
  'neck', 'chest', 'waist', 'belly', 'hips', 'upper_arm', 'forearm', 'thigh', 'calf',
]

export type { BodyMeasurementEntry }

const KEY_PREFIX = 'umfang:'
const MIN_CM = 10
const MAX_CM = 250

/** Komma oder Punkt, eine Nachkommastelle, gültig 10–250 (wie der DB-Check), sonst null. */
export function parseCircumference(input: string): number | null {
  const text = input.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  const value = Math.round(Number(text) * 10) / 10
  return value >= MIN_CM && value <= MAX_CM ? value : null
}

export function measurementMetricKey(site: MeasurementSite): string {
  return `${KEY_PREFIX}${site}`
}

export function siteFromMetricKey(key: string): MeasurementSite | null {
  if (!key.startsWith(KEY_PREFIX)) return null
  const site = key.slice(KEY_PREFIX.length)
  return MEASUREMENT_SITES.find(s => s === site) ?? null
}

export function measurementSeries(
  entries: BodyMeasurementEntry[],
  site: MeasurementSite,
  range: DateRange,
): SeriesPoint[] {
  return filterByDateRange(entries, range, e => e.measured_on)
    .filter(e => e.site === site)
    .map(e => ({ date: e.measured_on, value: e.value_cm }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Wert dieser Stelle am `date` (YYYY-MM-DD), sonst der jüngste davor, sonst null. */
export function lastMeasurementUpTo(
  entries: BodyMeasurementEntry[],
  site: MeasurementSite,
  date: string,
): number | null {
  let latest: BodyMeasurementEntry | null = null
  for (const e of entries) {
    if (e.site !== site || e.measured_on > date) continue
    if (latest === null || e.measured_on > latest.measured_on) latest = e
  }
  return latest ? latest.value_cm : null
}

export function measurementRowsToSave(
  userId: string,
  date: string,
  typed: Partial<Record<MeasurementSite, number>>,
): { user_id: string; measured_on: string; site: MeasurementSite; value_cm: number }[] {
  return MEASUREMENT_SITES.flatMap(site => {
    const value = typed[site]
    return value === undefined ? [] : [{ user_id: userId, measured_on: date, site, value_cm: value }]
  })
}
