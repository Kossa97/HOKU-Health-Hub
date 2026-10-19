import type { CustomExercise, MuscleGroup, SessionKind, TrackingMode, TrainingSession, TrainingSet, WeightUnit } from '../../types'
import type { ChartMarker } from '../../hooks/useTrainingData'
import {
  exerciseHistory, isWorkingSet, sessionVolumeKg, setsPerMuscle, startOfWeek, toDisplayWeight,
  type ExercisePoint,
} from '../../lib/stats'
import { exerciseInfo, exerciseName } from '../../lib/exerciseLookup'
import { formatClock, formatDistance, formatVolume, formatWeight } from '../../lib/format'

/**
 * Rechenteil des Fortschritt-Tabs — reine Funktionen, damit die Ansicht nur
 * zeichnet. Gewichte bleiben kg, bis eine Anzeige sie umrechnet.
 */

const DAY = 24 * 60 * 60 * 1000

/** Achsenbeschriftung aller Fortschritts-Charts: Text-Farbe, nie Datenfarbe. */
export const AXIS_TICK = { fill: 'var(--lg-text-3)', fontSize: 11, fontFamily: 'inherit' } as const

// ─── Wochen ─────────────────────────────────────────────────────────────────

export const REST_KEY = '__rest'
export type WeekSeriesKey = SessionKind | typeof REST_KEY

export interface WeekRow {
  /** Montag 00:00 Ortszeit, ms. */
  start: number
  total: number
  volumeKg: number
  counts: Partial<Record<WeekSeriesKey, number>>
}

export interface WeeklyModel {
  weeks: WeekRow[]
  /** Arten, die einzeln gezeigt werden — haeufigste zuerst; der Rest steckt in REST_KEY. */
  series: WeekSeriesKey[]
  totalSessions: number
  totalVolumeKg: number
}

/** Hoechstens so viele Farben im Stapel; mehr Arten fallen unter „Weitere". */
const MAX_SERIES = 4

export function weeklyModel(sessions: readonly TrainingSession[], now: Date, weekCount = 12): WeeklyModel {
  const current = startOfWeek(now)
  const starts: number[] = []
  for (let i = weekCount - 1; i >= 0; i--) {
    const d = new Date(current)
    d.setDate(d.getDate() - i * 7)
    starts.push(d.getTime())
  }
  const index = new Map(starts.map((start, i) => [start, i]))
  const rows = starts.map(start => ({ start, total: 0, volumeKg: 0, kinds: new Map<SessionKind, number>() }))
  const kindTotals = new Map<SessionKind, number>()

  for (const session of sessions) {
    const at = new Date(session.startedAt)
    if (Number.isNaN(at.getTime())) continue
    const i = index.get(startOfWeek(at).getTime())
    if (i == null) continue
    const row = rows[i]
    row.total++
    row.volumeKg += sessionVolumeKg(session)
    row.kinds.set(session.kind, (row.kinds.get(session.kind) ?? 0) + 1)
    kindTotals.set(session.kind, (kindTotals.get(session.kind) ?? 0) + 1)
  }

  const ranked = [...kindTotals.entries()].sort((a, b) => b[1] - a[1]).map(([kind]) => kind)
  const shown = ranked.length <= MAX_SERIES ? ranked : ranked.slice(0, MAX_SERIES - 1)
  const shownSet = new Set(shown)
  const series: WeekSeriesKey[] = ranked.length > shown.length ? [...shown, REST_KEY] : shown

  const weeks = rows.map(row => {
    const counts: WeekRow['counts'] = {}
    for (const [kind, count] of row.kinds) {
      const key: WeekSeriesKey = shownSet.has(kind) ? kind : REST_KEY
      counts[key] = (counts[key] ?? 0) + count
    }
    return { start: row.start, total: row.total, volumeKg: Math.round(row.volumeKg), counts }
  })

  return {
    weeks,
    series,
    totalSessions: weeks.reduce((sum, w) => sum + w.total, 0),
    totalVolumeKg: weeks.reduce((sum, w) => sum + w.volumeKg, 0),
  }
}

// ─── Muskeln ────────────────────────────────────────────────────────────────

export interface MuscleRow { muscle: MuscleGroup; sets: number }

/** Arbeitssaetze je Muskel in den letzten 7 Tagen, meiste zuerst. „Ausdauer" ist kein Muskel und faellt raus. */
export function muscleBalance(
  sessions: readonly TrainingSession[],
  custom: readonly CustomExercise[],
  now: Date,
): MuscleRow[] {
  const since = now.getTime() - 7 * DAY
  const recent = sessions.filter(s => {
    const t = Date.parse(s.startedAt)
    return t >= since && t <= now.getTime()
  })
  const counts = setsPerMuscle(recent, id => exerciseInfo(id, 'en', custom))
  return [...counts.entries()]
    .filter(([muscle, sets]) => muscle !== 'cardio' && sets > 0)
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle))
}

// ─── Uebungen ───────────────────────────────────────────────────────────────

export type Metric = 'e1rm' | 'weight' | 'volume' | 'reps' | 'duration' | 'distance'
export type Trend = 'up' | 'down' | 'flat'

export function metricValue(point: ExercisePoint, metric: Metric): number | null {
  switch (metric) {
    case 'e1rm': return point.bestE1rm
    case 'weight': return point.maxWeightKg
    case 'volume': return point.volumeKg > 0 ? point.volumeKg : null
    case 'reps': return point.maxReps
    case 'duration': return point.bestDurationS
    case 'distance': return point.bestDistanceM
  }
}

/** Fehlt die Uebung im Katalog (geloescht, Import), aus den Saetzen erraten. */
export function inferTracking(points: readonly ExercisePoint[]): TrackingMode {
  const has = (pick: (p: ExercisePoint) => number | null) => points.some(p => pick(p) != null)
  const weight = has(p => p.maxWeightKg)
  const reps = has(p => p.maxReps)
  const duration = has(p => p.bestDurationS)
  const distance = has(p => p.bestDistanceM)
  if (weight && reps) return 'weight_reps'
  if (weight && distance) return 'weight_distance'
  if (weight && duration) return 'weight_duration'
  if (distance) return 'distance_duration'
  if (duration) return 'duration'
  return 'reps'
}

const METRIC_ORDER: Record<TrackingMode, Metric[]> = {
  weight_reps: ['e1rm', 'weight', 'volume', 'reps'],
  bodyweight_reps: ['reps', 'weight', 'volume'],
  // Bei Unterstuetzung ist weniger Gewicht besser — e1RM und Volumen wuerden luegen.
  assisted_reps: ['reps'],
  reps: ['reps'],
  duration: ['duration'],
  weight_duration: ['weight', 'duration'],
  distance_duration: ['distance', 'duration'],
  weight_distance: ['weight', 'distance'],
}

/** Kennzahlen, fuer die es mindestens einen Wert gibt — in sinnvoller Reihenfolge. */
export function metricsFor(tracking: TrackingMode, points: readonly ExercisePoint[]): Metric[] {
  return METRIC_ORDER[tracking].filter(metric => points.some(p => metricValue(p, metric) != null))
}

/** Letzte bis zu 4 Einheiten: letzter Wert gegen den ersten; unter 1 % gilt als gleich. */
export function trendOf(points: readonly ExercisePoint[], metric: Metric): Trend | null {
  const values = points.map(p => metricValue(p, metric)).filter((v): v is number => v != null).slice(-4)
  if (values.length < 2) return null
  const first = values[0]
  const last = values[values.length - 1]
  if (first <= 0) return last > first ? 'up' : 'flat'
  const change = (last - first) / first
  if (change > 0.01) return 'up'
  if (change < -0.01) return 'down'
  return 'flat'
}

export interface ExerciseSummary {
  id: string
  name: string
  tracking: TrackingMode
  history: ExercisePoint[]
  last: ExercisePoint
  metrics: Metric[]
  trend: Trend | null
}

/** Alle Uebungen mit mindestens einem Arbeitssatz, zuletzt gemachte zuerst. */
export function exerciseSummaries(
  sessions: readonly TrainingSession[],
  lang: 'de' | 'en',
  custom: readonly CustomExercise[],
): ExerciseSummary[] {
  const ids = new Set<string>()
  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (ex.sets.some(isWorkingSet)) ids.add(ex.exerciseId)
    }
  }
  const result: ExerciseSummary[] = []
  for (const id of ids) {
    const history = exerciseHistory(sessions, id)
    if (history.length === 0) continue
    const tracking = exerciseInfo(id, lang, custom)?.tracking ?? inferTracking(history)
    const metrics = metricsFor(tracking, history)
    result.push({
      id,
      name: exerciseName(id, lang, custom),
      tracking,
      history,
      last: history[history.length - 1],
      metrics,
      trend: metrics.length ? trendOf(history, metrics[0]) : null,
    })
  }
  return result.sort((a, b) => Date.parse(b.last.date) - Date.parse(a.last.date) || a.name.localeCompare(b.name, lang))
}

export interface BestOf { value: number; date: string }

export function bestOf(points: readonly ExercisePoint[], metric: Metric): BestOf | null {
  let best: BestOf | null = null
  for (const p of points) {
    const v = metricValue(p, metric)
    if (v != null && (best == null || v > best.value)) best = { value: v, date: p.date }
  }
  return best
}

// ─── Formate ────────────────────────────────────────────────────────────────

export function formatMetric(metric: Metric, value: number, unit: WeightUnit, locale: string, repsUnit: string): string {
  switch (metric) {
    case 'e1rm':
    case 'weight': return formatWeight(value, unit, locale)
    case 'volume': return formatVolume(value, unit, locale)
    case 'reps': return `${new Intl.NumberFormat(locale).format(value)} ${repsUnit}`
    case 'duration': return formatClock(value)
    case 'distance': return formatDistance(value, locale)
  }
}

/** Achsenwert: Gewichte in der Anzeige-Einheit, Zeit als Uhr, Strecke als m/km. */
export function chartValue(metric: Metric, value: number, unit: WeightUnit): number {
  return metric === 'e1rm' || metric === 'weight' || metric === 'volume' ? toDisplayWeight(value, unit) : value
}

/** „80 kg × 5" · „12 Wdh." · „1 km · 4:30" · „−20 kg × 8" (Unterstuetzung). */
export function formatSet(set: TrainingSet, tracking: TrackingMode, unit: WeightUnit, locale: string, repsUnit: string): string {
  const parts: string[] = []
  const weight = set.weightKg != null && set.weightKg > 0
    ? `${tracking === 'assisted_reps' ? '−' : ''}${formatWeight(set.weightKg, unit, locale)}`
    : null
  if (weight && set.reps) parts.push(`${weight} × ${set.reps}`)
  else {
    if (weight) parts.push(weight)
    if (set.reps) parts.push(`${set.reps} ${repsUnit}`)
  }
  if (set.distanceM != null && set.distanceM > 0) parts.push(formatDistance(set.distanceM, locale))
  if (set.durationS != null && set.durationS > 0) parts.push(formatClock(set.durationS))
  return parts.join(' · ') || '—'
}

// ─── Marker ─────────────────────────────────────────────────────────────────

/** `YYYY-MM-DD` als Mittag Ortszeit, damit der Marker mitten im Tag sitzt. */
export function markerTime(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (!m) return Date.parse(date)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime()
}

export function markersInRange(markers: readonly ChartMarker[], from: number, to: number): Array<ChartMarker & { t: number }> {
  return markers
    .map(marker => ({ ...marker, t: markerTime(marker.date) }))
    .filter(marker => Number.isFinite(marker.t) && marker.t >= from && marker.t <= to)
    .sort((a, b) => a.t - b.t)
}
