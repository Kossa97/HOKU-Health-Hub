import { METRIC_THRESHOLDS, MAX_TOP_CHANGES, MIN_POINTS_FOR_TREND, WELLNESS_FIELDS } from '../constants'
import type { BloodworkEntry, DailyLogEntry, DateRange, DoseLogEntry, MetricChange, MetricKey, WeightLogEntry } from '../types'
import { dateKeyFromTimestamp } from './substances'
import { filterByDateRange } from './range'
import { normalizeMarker } from '../../blutwerte/lib/markerCatalog'
import { convert } from '../../blutwerte/lib/unitConversion'
import { pickDisplayUnit } from '../../blutwerte/lib/bloodwork'

export interface SeriesPoint {
  date: string
  value: number
}

function numeric(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function computeDelta(points: SeriesPoint[]): { from: number; to: number; delta: number } | null {
  if (points.length < MIN_POINTS_FOR_TREND) return null
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const from = sorted[0].value
  const to = sorted[sorted.length - 1].value
  const delta = Math.round((to - from) * 10) / 10
  return { from, to, delta }
}

export function passesThreshold(key: MetricKey, delta: number, from: number): boolean {
  if (key === 'weight') return Math.abs(delta) >= METRIC_THRESHOLDS.weight_kg
  if (key === 'body_fat') return Math.abs(delta) >= METRIC_THRESHOLDS.body_fat_pct
  if (key === 'energie' || key === 'schlaf' || key === 'wohlbefinden' || key === 'libido') {
    return Math.abs(delta) >= METRIC_THRESHOLDS.wellness
  }
  if (from === 0) return Math.abs(delta) > 0
  return Math.abs(delta / from) >= METRIC_THRESHOLDS.lab_relative
}

function weightSeries(logs: WeightLogEntry[], range: DateRange): SeriesPoint[] {
  return filterByDateRange(logs, range, l => dateKeyFromTimestamp(l.logged_at))
    .map(l => ({ date: dateKeyFromTimestamp(l.logged_at), value: l.weight_kg }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function dailyFieldSeries(
  logs: DailyLogEntry[],
  range: DateRange,
  field: keyof Pick<DailyLogEntry, 'energie' | 'schlaf' | 'wohlbefinden' | 'libido' | 'body_fat_pct'>,
): SeriesPoint[] {
  return filterByDateRange(logs, range, l => l.log_date)
    .filter(l => l[field] != null)
    .map(l => ({ date: l.log_date, value: l[field] as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Baut die Zeitreihe eines Markers in EINER Einheit auf: alle Werte werden in die
 * Katalog-Einheit (bzw. die Einheit des neuesten Eintrags) umgerechnet. Nicht sicher
 * umrechenbare Werte (z.B. molare Einheiten) werden übersprungen, damit die
 * Veränderung nicht durch gemischte Einheiten verfälscht wird.
 */
function labSeries(
  bloodwork: BloodworkEntry[],
  marker: string,
  range: DateRange,
): { points: SeriesPoint[]; unit: string } {
  const inRange = filterByDateRange(bloodwork, range, b => b.tested_at)
    .filter(b => b.marker === marker)
    .sort((a, b) => a.tested_at.localeCompare(b.tested_at))
  if (inRange.length === 0) return { points: [], unit: '' }

  const newest = inRange[inRange.length - 1]
  const displayUnit = pickDisplayUnit(normalizeMarker(marker), newest.value, newest.unit)
  const points: SeriesPoint[] = []
  for (const b of inRange) {
    const raw = numeric(b.value)
    if (raw == null) continue
    const converted = convert(raw, b.unit, displayUnit, normalizeMarker(marker)?.name)
    if (converted == null) continue
    points.push({ date: b.tested_at, value: converted })
  }
  return { points, unit: displayUnit }
}

const WELLNESS_LABELS: Record<string, string> = {
  energie: 'Energie',
  schlaf: 'Schlaf',
  wohlbefinden: 'Wohlbefinden',
  libido: 'Libido',
}

export function computeTopChanges(
  range: DateRange,
  weights: WeightLogEntry[],
  dailyLogs: DailyLogEntry[],
  bloodwork: BloodworkEntry[],
): MetricChange[] {
  const candidates: MetricChange[] = []

  const weightPts = weightSeries(weights, range)
  const weightDelta = computeDelta(weightPts)
  if (weightDelta && passesThreshold('weight', weightDelta.delta, weightDelta.from)) {
    candidates.push({
      key: 'weight',
      label: 'Gewicht',
      unit: 'kg',
      ...weightDelta,
      rank: 0,
    })
  }

  for (const field of WELLNESS_FIELDS) {
    const pts = dailyFieldSeries(dailyLogs, range, field)
    const d = computeDelta(pts)
    if (d && passesThreshold(field, d.delta, d.from)) {
      candidates.push({
        key: field,
        label: WELLNESS_LABELS[field] ?? field,
        unit: '/10',
        ...d,
        rank: 0,
      })
    }
  }

  const kfaPts = dailyFieldSeries(dailyLogs, range, 'body_fat_pct')
  const kfaDelta = computeDelta(kfaPts)
  if (kfaDelta && passesThreshold('body_fat', kfaDelta.delta, kfaDelta.from)) {
    candidates.push({
      key: 'body_fat',
      label: 'Körperfett',
      unit: '%',
      ...kfaDelta,
      rank: 0,
    })
  }

  const markers = [...new Set(bloodwork.map(b => b.marker))]
  for (const marker of markers) {
    const { points, unit } = labSeries(bloodwork, marker, range)
    const d = computeDelta(points)
    if (d && passesThreshold(marker, d.delta, d.from)) {
      candidates.push({
        key: marker,
        label: marker,
        unit,
        ...d,
        rank: 0,
      })
    }
  }

  return candidates
    .sort((a, b) => {
      const scoreA = Math.abs(a.key === 'weight' ? a.delta : a.delta)
      const scoreB = Math.abs(b.key === 'weight' ? b.delta : b.delta)
      return scoreB - scoreA
    })
    .slice(0, MAX_TOP_CHANGES)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

export function wellnessAverage(logs: DailyLogEntry[], range: DateRange): number | null {
  const inRange = filterByDateRange(logs, range, l => l.log_date)
  const values: number[] = []
  for (const log of inRange) {
    const parts = WELLNESS_FIELDS
      .map(f => log[f])
      .filter((v): v is number => v != null)
    if (parts.length > 0) {
      values.push(parts.reduce((s, v) => s + v, 0) / parts.length)
    }
  }
  if (values.length === 0) return null
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
}

export function wellnessFieldDelta(
  logs: DailyLogEntry[],
  range: DateRange,
  field: (typeof WELLNESS_FIELDS)[number],
): number | null {
  const pts = dailyFieldSeries(logs, range, field)
  const d = computeDelta(pts)
  return d?.delta ?? null
}

export function strongestWellnessField(
  logs: DailyLogEntry[],
  range: DateRange,
): (typeof WELLNESS_FIELDS)[number] | null {
  let best: { field: (typeof WELLNESS_FIELDS)[number]; abs: number } | null = null
  for (const field of WELLNESS_FIELDS) {
    const delta = wellnessFieldDelta(logs, range, field)
    if (delta == null) continue
    const abs = Math.abs(delta)
    if (!best || abs > best.abs) best = { field, abs }
  }
  return best?.field ?? null
}

export function computeAdherence(
  doseLogs: DoseLogEntry[],
  range: DateRange,
  stackItemNames: Map<string, string>,
): { overall: number | null; taken: number; total: number; bySubstance: { name: string; pct: number }[] } {
  const inRange = filterByDateRange(doseLogs, range, d => dateKeyFromTimestamp(d.logged_at))
    .filter(d => d.taken != null && d.stack_item_id)

  if (inRange.length === 0) {
    return { overall: null, taken: 0, total: 0, bySubstance: [] }
  }

  const taken = inRange.filter(d => d.taken).length
  const grouped = new Map<string, { taken: number; total: number }>()

  for (const log of inRange) {
    const id = log.stack_item_id!
    const entry = grouped.get(id) ?? { taken: 0, total: 0 }
    entry.total++
    if (log.taken) entry.taken++
    grouped.set(id, entry)
  }

  const bySubstance = Array.from(grouped.entries())
    .map(([id, stats]) => ({
      name: stackItemNames.get(id) ?? id,
      pct: Math.round((stats.taken / stats.total) * 100),
    }))
    .sort((a, b) => b.pct - a.pct)

  return {
    overall: Math.round((taken / inRange.length) * 100),
    taken,
    total: inRange.length,
    bySubstance,
  }
}

export function sparklineValues(points: SeriesPoint[], maxPoints = 14): number[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.slice(-maxPoints).map(p => p.value)
}

export function buildMetricSeries(
  key: MetricKey,
  range: DateRange,
  weights: WeightLogEntry[],
  dailyLogs: DailyLogEntry[],
  bloodwork: BloodworkEntry[],
): SeriesPoint[] {
  if (key === 'weight') return weightSeries(weights, range)
  if (key === 'body_fat') return dailyFieldSeries(dailyLogs, range, 'body_fat_pct')
  if (key === 'energie' || key === 'schlaf' || key === 'wohlbefinden' || key === 'libido') {
    return dailyFieldSeries(dailyLogs, range, key)
  }
  return labSeries(bloodwork, key, range).points
}

export { numeric, weightSeries, dailyFieldSeries, labSeries }
