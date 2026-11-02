/**
 * Baut aus den eigenen Rohdaten (dieselben wie fuer den Schnappschuss) die
 * Eingabe der Fortschrittsrechnung (`ProgressInput`). Rein.
 */
import { MEASUREMENT_SITES, type MeasurementSite } from '../../fortschritt/lib/measurements'
import { buildMarkerSummaries } from '../../blutwerte/lib/bloodwork'
import { exerciseSummaries } from '../../training/components/progress/progressModel'
import { localDay } from '../../wearables/lib/healthDaily'
import type { ProfileSnapshotInput } from './profileSnapshot'
import {
  WEARABLE_METRICS, WEARABLE_COLUMN, parseBaselines, type BloodReport, type DatedValue, type DoseDay, type ExerciseE1rm,
  type ProgressInput, type WearableMetricId,
} from './progressScore'
import type { ProgressSettings } from './progressSettings'

/** Zeitstempel → Kalendertag (Datumswerte bleiben). */
export function dayOfStamp(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : localDay(new Date(t))
}

const point = (day: string | null, value: number | null | undefined): DatedValue[] =>
  day && value != null && Number.isFinite(value) ? [{ day, value }] : []

export interface ProgressSeries {
  weight: DatedValue[]
  bodyFat: DatedValue[]
  muscleMass: DatedValue[]
  circumferences: Partial<Record<MeasurementSite, DatedValue[]>>
  bloodReports: BloodReport[]
  sessionDays: string[]
  e1rm: ExerciseE1rm[]
  /** Anzeigename je Uebung (fuer „Kreuzheben e1RM“). */
  exerciseNames: Record<string, string>
  doseDays: DoseDay[]
}

/** Blutbefund = alle Werte eines Tages; Anteil der beurteilbaren Marker im Bereich. */
export function bloodReports(input: Pick<ProfileSnapshotInput, 'bloodwork' | 'bio'>): BloodReport[] {
  const byDay = new Map<string, ProfileSnapshotInput['bloodwork']>()
  for (const e of input.bloodwork) {
    const day = dayOfStamp(e.tested_at)
    if (!day) continue
    byDay.set(day, [...(byDay.get(day) ?? []), e])
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([day, entries]) => {
    const judged = buildMarkerSummaries(entries, {}, input.bio).filter(s => s.latest !== null && s.inRange !== null)
    return judged.length > 0 ? [{ day, inRange: judged.filter(s => s.inRange === true).length, of: judged.length }] : []
  })
}

export function progressSeries(input: ProfileSnapshotInput): ProgressSeries {
  const circumferences: Partial<Record<MeasurementSite, DatedValue[]>> = {}
  for (const site of MEASUREMENT_SITES) {
    const pts = input.measurements.filter(m => m.site === site).flatMap(m => point(m.measured_on, m.value_cm))
    if (pts.length > 0) circumferences[site] = pts
  }
  const summaries = exerciseSummaries(input.sessions, input.lang, input.customExercises)
  const e1rm: ExerciseE1rm[] = summaries.map(s => ({
    exerciseId: s.id,
    points: s.history.flatMap(p => point(dayOfStamp(p.date), p.bestE1rm)),
  })).filter(e => e.points.length > 0)

  // Einnahmen je Tag: bestaetigt ÷ faellig (eingetragen = faellig; Auto-Tracking zaehlt wie in der Einnahmetreue)
  const dose = new Map<string, DoseDay>()
  for (const d of input.doseLogs) {
    if (d.taken == null || !d.stack_item_id) continue
    const day = d.logged_at.slice(0, 10)
    const e = dose.get(day) ?? { day, taken: 0, due: 0 }
    e.due++
    if (d.taken) e.taken++
    dose.set(day, e)
  }

  return {
    weight: input.weightLogs.flatMap(w => point(w.logged_at.slice(0, 10), w.weight_kg)),
    bodyFat: input.dailyLogs.flatMap(l => point(l.log_date, l.body_fat_pct)),
    muscleMass: input.dailyLogs.flatMap(l => point(l.log_date, l.muscle_mass_kg)),
    circumferences,
    bloodReports: bloodReports(input),
    sessionDays: input.sessions.flatMap(s => { const d = dayOfStamp(s.startedAt); return d ? [d] : [] }),
    e1rm,
    exerciseNames: Object.fromEntries(summaries.map(s => [s.id, s.name])),
    doseDays: [...dose.values()].sort((a, b) => a.day.localeCompare(b.day)),
  }
}

const firstDay = (days: Iterable<string>): string | null => {
  let first: string | null = null
  for (const d of days) if (first === null || d < first) first = d
  return first
}

/** „Erste Messung“: der frueheste Tag mit Daten fuer die Rechnung; `null` ohne Daten. */
export function implicitStart(series: ProgressSeries, input: Pick<ProfileSnapshotInput, 'healthDaily'>, today: string): string | null {
  const days = [
    ...series.weight.map(p => p.day), ...series.bodyFat.map(p => p.day), ...series.muscleMass.map(p => p.day),
    ...Object.values(series.circumferences).flatMap(ps => ps?.map(p => p.day) ?? []),
    ...series.bloodReports.map(r => r.day), ...series.sessionDays, ...series.doseDays.map(d => d.day),
    ...WEARABLE_METRICS.flatMap(id => { const d = firstWearableDay(input, id, today); return d ? [d] : [] }),
  ].filter(d => d <= today)
  return firstDay(days)
}

function firstWearableDay(input: Pick<ProfileSnapshotInput, 'healthDaily'>, id: WearableMetricId, today: string): string | null {
  const c = WEARABLE_COLUMN[id]
  if (!c) return null
  return firstDay(input.healthDaily.filter(r => r.day <= today && r[c] != null).map(r => r.day))
}

export interface ProgressSetup {
  input: ProgressInput
  /** Start, gegen den gerechnet wird (gesetzt oder erste Messung). */
  startOn: string
  /** `true`: kein Start gesetzt, es gilt die erste Messung je Wert. */
  implicit: boolean
  exerciseNames: Record<string, string>
}

/** Eingabe der Rechnung; `null`, wenn es noch keinen einzigen Datentag gibt. */
export function progressSetup(
  input: ProfileSnapshotInput, settings: ProgressSettings, goals: readonly string[], today: string,
): ProgressSetup | null {
  const series = progressSeries(input)
  const implicit = settings.startOn === null
  const startOn = settings.startOn ?? implicitStart(series, input, today)
  if (!startOn) return null
  const wearableStarts: Partial<Record<WearableMetricId, string>> = {}
  if (implicit) {
    for (const id of WEARABLE_METRICS) {
      const d = firstWearableDay(input, id, today)
      if (d) wearableStarts[id] = d
    }
  }
  const { exerciseNames, ...rest } = series
  return {
    input: {
      today, startOn, goals, overrides: settings.directions,
      ...rest,
      healthDaily: input.healthDaily,
      baselines: implicit ? {} : parseBaselines(settings.baselines, startOn),
      wearableStarts,
    },
    startOn,
    implicit,
    exerciseNames,
  }
}
