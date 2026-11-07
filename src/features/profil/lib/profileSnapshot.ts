/**
 * Schnappschuss der eigenen Profilwerte (Teilprojekt 2a).
 *
 * Das Geraet des Nutzers rechnet mit derselben Logik wie die App (Fortschritt,
 * Blutwerte, Training) und legt das Ergebnis in `profile_snapshots.data` ab.
 * Andere lesen es nur gefiltert ueber `profile_view`. Rein: keine Datenbank,
 * keine Uhr — `now` kommt von aussen.
 *
 * Regeln:
 * - Schluessel nur aus `PROFILE_FIELDS`; Bio, Ziele, Land, Geschlecht, Mitglied
 *   seit und Titelbild liest der Server selbst aus `profiles`.
 * - Ein Feld ohne Wert fehlt (kein `null`), damit `profile_view` nichts
 *   Leeres herausgibt.
 * - Substanzen nur als Zahl, nie mit Namen.
 * - Aenderungen „seit Start" wie im Verlauf: `computeDelta`, also erst ab drei Messpunkten.
 */
import { addDays, format, parseISO } from 'date-fns'
import type { BodyMeasurementEntry, DailyLogEntry, DoseLogEntry, WeightLogEntry } from '../../fortschritt/types'
import { computeAdherence, computeDelta, dailyFieldSeries, weightSeries } from '../../fortschritt/lib/metrics'
import { MEASUREMENT_SITES, measurementSeries, type MeasurementSite } from '../../fortschritt/lib/measurements'
import type { BloodworkEntry } from '../../blutwerte/types'
import { buildMarkerSummaries } from '../../blutwerte/lib/bloodwork'
import type { BioProfile } from '../../blutwerte/lib/bioProfile'
import { alterAm } from '../../blutwerte/lib/referenzbereiche'
import type { HealthDailyRow } from '../../wearables/lib/healthDaily'
import { localDay } from '../../wearables/lib/healthDaily'
import type { CustomExercise, TrainingRoutine, TrainingSession } from '../../training/types'
import { bestOf, exerciseSummaries, weeklyModel } from '../../training/components/progress/progressModel'
import { exerciseName } from '../../training/lib/exerciseLookup'
import type { ProfileField } from './profileVisibility'

// ─── Eingabe ────────────────────────────────────────────────────────────────

/** Ein Einnahme-Eintrag; `auto_logged` = vom Auto-Tracking, nicht selbst bestaetigt. */
export type SnapshotDoseLog = DoseLogEntry & { auto_logged?: boolean | null }

/** Was der Dienst fuer den Schnappschuss laedt — nur eigene Zeilen. */
export interface ProfileSnapshotInput {
  lang: 'de' | 'en'
  profile: {
    birthDate: string | null
    heightCm: number | null
    /** Gewicht aus dem Profil — gilt nur, wenn es keine Gewichtseintraege gibt. */
    weightKg: number | null
    favoriteExercise: string | null
    routineId: string | null
  }
  bio: BioProfile
  weightLogs: WeightLogEntry[]
  dailyLogs: DailyLogEntry[]
  measurements: BodyMeasurementEntry[]
  doseLogs: SnapshotDoseLog[]
  /** Nicht archivierte Eintraege im Stack (nur die Zahl). */
  stackItemCount: number
  activeCycleCount: number
  bloodwork: BloodworkEntry[]
  healthDaily: HealthDailyRow[]
  sessions: TrainingSession[]
  routines: TrainingRoutine[]
  customExercises: CustomExercise[]
  /** Sterne der eigenen oeffentlichen, nicht ausgeblendeten Erfahrungsberichte. */
  reviewRatings: number[]
}

// ─── Ausgabe ────────────────────────────────────────────────────────────────

export interface SnapshotNumber<U extends string = string> {
  v: number
  unit: U
  /** Aenderung seit dem Start (erster Messpunkt bzw. erste 7 Tage). */
  delta?: number
}

export interface ProfileSnapshotData {
  age?: { v: number }
  height?: SnapshotNumber<'cm'>
  weight?: SnapshotNumber<'kg'>
  body_fat?: SnapshotNumber<'%'>
  muscle_mass?: SnapshotNumber<'kg'>
  measurements?: { unit: 'cm'; sites: { site: MeasurementSite; v: number; delta?: number }[] }
  adherence?: { pct: number; confirmed: number; missed: number; days: number }
  substances?: { count: number; activeCycles: number }
  markers?: { count: number }
  in_range?: { inRange: number; of: number }
  steps?: SnapshotNumber<'steps'>
  resting_hr?: SnapshotNumber<'bpm'>
  sleep?: SnapshotNumber<'min'>
  active_kcal?: SnapshotNumber<'kcal'>
  spo2?: SnapshotNumber<'%'>
  blood_pressure?: { sys: number; dia: number; unit: 'mmHg'; deltaSys?: number; deltaDia?: number }
  workouts?: { total: number; perWeek: number }
  routine?: { name: string }
  favorite_exercise?: { id: string; name: string }
  e1rm?: { unit: 'kg'; top: { id: string; name: string; v: number }[] }
  reviews?: { count: number; avgRating: number }
  streak?: { days: number }
}

export type SnapshotFieldKey = keyof ProfileSnapshotData
/** Kompiliert nur, solange jeder Schluessel ein Profilfeld ist. */
export const SNAPSHOT_KEYS_ARE_FIELDS: Exclude<SnapshotFieldKey, ProfileField> extends never ? true : false = true

/** Fenster der Einnahmetreue im Profil. */
export const ADHERENCE_DAYS = 90
/** Wie weit der Streak hoechstens zurueckschaut (so weit laedt der Dienst). */
export const STREAK_MAX_DAYS = 365
/** Gesundheitswerte: Durchschnitt ueber so viele Kalendertage. */
export const HEALTH_WINDOW_DAYS = 7
/** Trainings pro Woche: hoechstens ueber so viele Wochen gemittelt. */
const PER_WEEK_MAX_WEEKS = 12
const E1RM_TOP = 3

// ─── Helfer ─────────────────────────────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10
const round0 = (n: number) => Math.round(n)

export const shiftDay = (day: string, days: number): string =>
  format(addDays(parseISO(`${day}T00:00:00`), days), 'yyyy-MM-dd')

/** Zeitstempel → Kalendertag in Ortszeit (Datumswerte bleiben, wie sie sind). */
function dayOf(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : localDay(new Date(t))
}

/** Letzter Wert + Aenderung seit Start, wie der Verlauf sie rechnet. */
function latestWithDelta<U extends string>(
  points: { date: string; value: number }[],
  unit: U,
): SnapshotNumber<U> | undefined {
  if (points.length === 0) return undefined
  const last = points[points.length - 1]
  const d = computeDelta(points)
  return d ? { v: round1(last.value), unit, delta: d.delta } : { v: round1(last.value), unit }
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

type HealthColumn = Exclude<keyof HealthDailyRow, 'day'>

/**
 * Durchschnitt der letzten 7 Kalendertage (bis heute) und Aenderung gegen die
 * ersten 7 Tage ab dem ersten Wert. Die Aenderung gibt es nur, wenn sich die
 * beiden Fenster nicht ueberschneiden.
 */
function healthAverage(rows: HealthDailyRow[], column: HealthColumn, today: string): { v: number; delta?: number } | undefined {
  const withValue = rows
    .filter(r => r[column] != null && Number.isFinite(Number(r[column])) && r.day <= today)
    .sort((a, b) => a.day.localeCompare(b.day))
  const recentFrom = shiftDay(today, -(HEALTH_WINDOW_DAYS - 1))
  const recent = withValue.filter(r => r.day >= recentFrom).map(r => Number(r[column]))
  if (recent.length === 0) return undefined
  const v = mean(recent)
  const firstDay = withValue[0].day
  const firstTo = shiftDay(firstDay, HEALTH_WINDOW_DAYS - 1)
  if (firstTo >= recentFrom) return { v }
  const first = withValue.filter(r => r.day <= firstTo).map(r => Number(r[column]))
  return { v, delta: v - mean(first) }
}

function healthNumber<U extends string>(
  rows: HealthDailyRow[], column: HealthColumn, today: string, unit: U, round: (n: number) => number,
): SnapshotNumber<U> | undefined {
  const avg = healthAverage(rows, column, today)
  if (!avg) return undefined
  return avg.delta === undefined
    ? { v: round(avg.v), unit }
    : { v: round(avg.v), unit, delta: round(avg.delta) }
}

/**
 * Tage in Folge bis heute mit mindestens einem eigenen Eintrag (Einnahme
 * bestaetigt oder ausgelassen, Tageseintrag, Gewicht, Umfang, Training).
 * Auto-Tracking zaehlt nicht. Ist heute noch nichts eingetragen, zaehlt die
 * Serie ab gestern — der Tag ist ja noch offen.
 */
export function entryStreak(days: ReadonlySet<string>, today: string, maxDays = STREAK_MAX_DAYS): number {
  let cursor = days.has(today) ? today : shiftDay(today, -1)
  let streak = 0
  while (streak < maxDays && days.has(cursor)) {
    streak++
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

function entryDays(input: ProfileSnapshotInput): Set<string> {
  const days = new Set<string>()
  const add = (value: string | null | undefined) => {
    const day = value ? dayOf(value) : null
    if (day) days.add(day)
  }
  for (const d of input.doseLogs) if (d.taken != null && !d.auto_logged) add(d.logged_at)
  for (const l of input.dailyLogs) add(l.log_date)
  for (const w of input.weightLogs) add(w.logged_at)
  for (const m of input.measurements) add(m.measured_on)
  for (const s of input.sessions) add(s.startedAt)
  return days
}

// ─── Schnappschuss ──────────────────────────────────────────────────────────

export function buildProfileSnapshot(input: ProfileSnapshotInput, now: Date): ProfileSnapshotData {
  const today = localDay(now)
  const out: ProfileSnapshotData = {}
  const allTime = { from: '0000-01-01', to: today }

  // Ueber mich
  const age = alterAm(input.profile.birthDate, today)
  if (age != null) out.age = { v: age }
  if (input.profile.heightCm != null && input.profile.heightCm > 0) {
    out.height = { v: round0(input.profile.heightCm), unit: 'cm' }
  }
  const weight = latestWithDelta(weightSeries(input.weightLogs, allTime), 'kg')
  if (weight) out.weight = weight
  else if (input.profile.weightKg != null && input.profile.weightKg > 0) {
    out.weight = { v: round1(input.profile.weightKg), unit: 'kg' }
  }

  // Koerper
  const bodyFat = latestWithDelta(dailyFieldSeries(input.dailyLogs, allTime, 'body_fat_pct'), '%')
  if (bodyFat) out.body_fat = bodyFat
  const muscle = latestWithDelta(dailyFieldSeries(input.dailyLogs, allTime, 'muscle_mass_kg'), 'kg')
  if (muscle) out.muscle_mass = muscle
  const sites = MEASUREMENT_SITES.flatMap(site => {
    const value = latestWithDelta(measurementSeries(input.measurements, site, allTime), 'cm')
    return value ? [value.delta === undefined ? { site, v: value.v } : { site, v: value.v, delta: value.delta }] : []
  })
  if (sites.length > 0) out.measurements = { unit: 'cm', sites }

  // Einnahmen — Namen gehen nie hinaus: leere Namenskarte, und bySubstance faellt weg.
  const adherence = computeAdherence(
    input.doseLogs,
    { from: shiftDay(today, -(ADHERENCE_DAYS - 1)), to: today },
    new Map(),
  )
  if (adherence.overall != null) {
    out.adherence = {
      pct: adherence.overall,
      confirmed: adherence.taken,
      missed: adherence.total - adherence.taken,
      days: ADHERENCE_DAYS,
    }
  }
  if (input.stackItemCount > 0 || input.activeCycleCount > 0) {
    out.substances = { count: input.stackItemCount, activeCycles: input.activeCycleCount }
  }

  // Blutwerte: wie die Marker-Ansicht (letzter Wert je Marker gegen seinen Bereich)
  const measured = buildMarkerSummaries(input.bloodwork, {}, input.bio).filter(s => s.latest !== null)
  if (measured.length > 0) out.markers = { count: measured.length }
  const judged = measured.filter(s => s.inRange !== null)
  if (judged.length > 0) {
    out.in_range = { inRange: judged.filter(s => s.inRange === true).length, of: judged.length }
  }

  // Gesundheit & Wearables (HRV, VO2max gibt es erst mit Schritt 1b)
  const steps = healthNumber(input.healthDaily, 'steps', today, 'steps', round0)
  if (steps) out.steps = steps
  const restingHr = healthNumber(input.healthDaily, 'resting_hr', today, 'bpm', round0)
  if (restingHr) out.resting_hr = restingHr
  const sleep = healthNumber(input.healthDaily, 'sleep_min', today, 'min', round0)
  if (sleep) out.sleep = sleep
  const kcal = healthNumber(input.healthDaily, 'active_kcal', today, 'kcal', round0)
  if (kcal) out.active_kcal = kcal
  const spo2 = healthNumber(input.healthDaily, 'spo2_pct', today, '%', round1)
  if (spo2) out.spo2 = spo2
  // Blutdruck nur aus Tagen mit beiden Werten
  const bpRows = input.healthDaily.filter(r => r.bp_sys != null && r.bp_dia != null)
  const sys = healthAverage(bpRows, 'bp_sys', today)
  const dia = healthAverage(bpRows, 'bp_dia', today)
  if (sys && dia) {
    out.blood_pressure = { sys: round0(sys.v), dia: round0(dia.v), unit: 'mmHg' }
    if (sys.delta !== undefined && dia.delta !== undefined) {
      out.blood_pressure.deltaSys = round0(sys.delta)
      out.blood_pressure.deltaDia = round0(dia.delta)
    }
  }

  // Training
  if (input.sessions.length > 0) {
    const starts = input.sessions.map(s => Date.parse(s.startedAt)).filter(t => !Number.isNaN(t))
    const first = starts.length > 0 ? Math.min(...starts) : now.getTime()
    const weeks = Math.min(PER_WEEK_MAX_WEEKS, Math.max(1, Math.ceil((now.getTime() - first) / (7 * 86_400_000))))
    const model = weeklyModel(input.sessions, now, weeks)
    out.workouts = { total: input.sessions.length, perWeek: round1(model.totalSessions / weeks) }
  }
  const routine = input.profile.routineId ? input.routines.find(r => r.id === input.profile.routineId) : undefined
  if (routine && routine.name.trim()) out.routine = { name: routine.name.trim() }
  const favorite = input.profile.favoriteExercise?.trim()
  if (favorite) {
    out.favorite_exercise = { id: favorite, name: exerciseName(favorite, input.lang, input.customExercises) }
  }
  const top = exerciseSummaries(input.sessions, input.lang, input.customExercises)
    .filter(s => s.metrics.includes('e1rm'))
    .flatMap(s => {
      const best = bestOf(s.history, 'e1rm')
      return best ? [{ id: s.id, name: s.name, v: round1(best.value) }] : []
    })
    .sort((a, b) => b.v - a.v || a.name.localeCompare(b.name))
    .slice(0, E1RM_TOP)
  if (top.length > 0) out.e1rm = { unit: 'kg', top }

  // Erfahrungsberichte
  const ratings = input.reviewRatings.filter(r => Number.isFinite(r))
  if (ratings.length > 0) out.reviews = { count: ratings.length, avgRating: round1(mean(ratings)) }

  // Streak
  const streak = entryStreak(entryDays(input), today)
  if (streak > 0) out.streak = { days: streak }

  return out
}
