/**
 * Gesamtfortschritt (Teilprojekt 2b, Spec Abschnitte 1 und 2): Prozent der
 * positiven Veraenderung seit dem eigenen Start, je Wert, je Bereich, gesamt.
 *
 * Rein: keine Datenbank, keine Uhr — `today` und alle Daten kommen von aussen.
 * Zwei Schichten:
 * 1. `scoreProgress` rechnet aus fertigen Werten (Start, jetzt, Baseline-Stand)
 *    Richtung, Prozent, Bereichsmittel und Gesamt.
 * 2. Die Bausteine `bodyValue`, `bloodValue`, `workoutsValue`, `e1rmValues`,
 *    `adherenceValue`, `wearableValue` (zusammen `buildProgressValues`) machen
 *    aus Messreihen diese Werte und pruefen die Baseline-Regeln.
 *
 * Rechnung (Prozent):
 * - runter: (Start − jetzt) ÷ Start; hoch: (jetzt − Start) ÷ Start.
 * - Anteilswerte (Zielbereich, 0…1): Luecke zum Ziel geschlossen,
 *   (jetzt − Start) ÷ (1 − Start); schlechter: (jetzt − Start) ÷ Start, damit das
 *   Ergebnis wie in der Spec zwischen −100 und +100 % bleibt.
 * - Bereich = Mittel seiner zaehlenden Werte, Gesamt = Mittel der Bereiche mit
 *   Wert. Kein Deckel, keine Untergrenze fuer kleine Startwerte.
 *
 * „Jetzt“ = letzte 28 Tage (Wearables: die 28 abgeschlossenen Tage vor heute,
 * nie vor dem Start). Punktmessungen (Koerper) mitteln die Messungen der
 * letzten 28 Tage ohne die Startmessung, sonst die letzte; e1RM nimmt das Beste
 * der letzten 28 Tage; Blut den letzten Befund.
 */
import { MEASUREMENT_SITES, type MeasurementSite } from '../../fortschritt/lib/measurements'
import type { HealthDailyRow } from '../../wearables/lib/healthDaily'

// ─── Bereiche und Werte ─────────────────────────────────────────────────────

export type ProgressArea = 'koerper' | 'blut' | 'training' | 'einnahmen' | 'erholung'
export const PROGRESS_AREAS: readonly ProgressArea[] = ['koerper', 'blut', 'training', 'einnahmen', 'erholung']

export type Direction = 'down' | 'up' | 'range' | 'off'

export type CircumferenceId = `circ_${MeasurementSite}`
const CIRC_IDS = MEASUREMENT_SITES.map(site => `circ_${site}` as CircumferenceId)

/**
 * Feste Wert-IDs (Schluessel in `progress_settings.directions`). Dazu
 * `e1rm:<Uebungs-ID>`. Muss mit `progress_metric_ok` in
 * `supabase-profil-p2b-fortschritt.sql` uebereinstimmen (Test prueft das).
 */
export const PROGRESS_METRIC_IDS = [
  'weight', 'body_fat', 'muscle_mass', ...CIRC_IDS,
  'markers_in_range',
  'workouts_per_week',
  'adherence',
  'steps', 'active_kcal', 'vo2max', 'resting_hr', 'bp_sys', 'sleep_nights', 'hrv',
] as const

export type FixedMetricId = typeof PROGRESS_METRIC_IDS[number]
export type E1rmId = `e1rm:${string}`
export type MetricId = FixedMetricId | E1rmId

/** Anteilswerte mit natuerlichem Ziel (100 % im Bereich). */
export const SHARE_METRICS: readonly MetricId[] = ['markers_in_range', 'sleep_nights']

/** Aus Apple Health / Health Connect; Baseline aus den 60 Tagen vor dem Start. */
export const WEARABLE_METRICS = ['steps', 'active_kcal', 'resting_hr', 'bp_sys', 'sleep_nights', 'hrv', 'vo2max'] as const
export type WearableMetricId = typeof WEARABLE_METRICS[number]

const E1RM_PATTERN = /^e1rm:([a-z0-9_]{1,64}|custom:[0-9a-f-]{36})$/

export const e1rmId = (exerciseId: string): E1rmId => `e1rm:${exerciseId}`

export function isMetricId(v: unknown): v is MetricId {
  return typeof v === 'string' && ((PROGRESS_METRIC_IDS as readonly string[]).includes(v) || E1RM_PATTERN.test(v))
}

export const isShareMetric = (id: MetricId) => SHARE_METRICS.includes(id)

export function areaOf(id: MetricId): ProgressArea {
  if (id === 'weight' || id === 'body_fat' || id === 'muscle_mass' || id.startsWith('circ_')) return 'koerper'
  if (id === 'markers_in_range') return 'blut'
  if (id === 'workouts_per_week' || id.startsWith('e1rm:')) return 'training'
  if (id === 'adherence') return 'einnahmen'
  return 'erholung'
}

// ─── Richtung ───────────────────────────────────────────────────────────────

/** Woher die Standardrichtung kommt: fest, aus den Ziel-Tags oder Zielbereich. */
export type DirectionSource = 'fixed' | 'goals' | 'range'

const SHRINK_SITES: readonly MeasurementSite[] = ['waist', 'belly', 'hips']
const GROW_SITES: readonly MeasurementSite[] = ['upper_arm', 'chest', 'thigh', 'calf']

export function directionSource(id: MetricId): DirectionSource {
  if (isShareMetric(id)) return 'range'
  if (id === 'weight' || id.startsWith('circ_')) return 'goals'
  return 'fixed'
}

/**
 * Standardrichtung (Spec Abschnitt 2). Gewicht: Fettabbau → runter,
 * Muskelaufbau → hoch, Recomp, beides oder sonst → aus. Umfaenge: Taille,
 * Bauch, Huefte runter; Oberarm, Brust, Oberschenkel, Wade hoch bei
 * Muskelaufbau oder Kraft, sonst runter; Hals, Unterarm aus.
 */
export function defaultDirection(id: MetricId, goals: readonly string[]): Direction {
  if (isShareMetric(id)) return 'range'
  if (id === 'weight') {
    const cut = goals.includes('fettabbau')
    const bulk = goals.includes('muskelaufbau')
    if (goals.includes('recomp') || cut === bulk) return 'off'
    return cut ? 'down' : 'up'
  }
  if (id.startsWith('circ_')) {
    const site = id.slice('circ_'.length) as MeasurementSite
    if (SHRINK_SITES.includes(site)) return 'down'
    if (GROW_SITES.includes(site)) return goals.includes('muskelaufbau') || goals.includes('kraft') ? 'up' : 'down'
    return 'off'
  }
  if (id === 'body_fat' || id === 'resting_hr' || id === 'bp_sys') return 'down'
  return 'up'
}

/** Anteilswerte: Zielbereich oder aus; alle anderen: runter, hoch oder aus. */
export function allowedDirections(id: MetricId): readonly Direction[] {
  return isShareMetric(id) ? ['range', 'off'] : ['down', 'up', 'off']
}

export type DirectionOverrides = Partial<Record<MetricId, Direction>>

/** Bereinigt `progress_settings.directions`: nur bekannte Werte, nur erlaubte Richtungen. */
export function parseDirections(raw: unknown): DirectionOverrides {
  const out: DirectionOverrides = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (isMetricId(key) && typeof value === 'string' && allowedDirections(key).includes(value as Direction)) {
      out[key] = value as Direction
    }
  }
  return out
}

/** Richtung nach Ueberschreiben durch den Nutzer; Unerlaubtes zaehlt nicht. */
export function effectiveDirection(id: MetricId, goals: readonly string[], overrides: DirectionOverrides = {}): Direction {
  const own = overrides[id]
  return own !== undefined && allowedDirections(id).includes(own) ? own : defaultDirection(id, goals)
}

// ─── Formel ─────────────────────────────────────────────────────────────────

/**
 * Veraenderung in Prozent, positiv = besser. `null`, wenn der Wert nicht zaehlt
 * (aus) oder sich nicht rechnen laesst (Startwert 0 bei runter/hoch, Anteil
 * ausserhalb 0…1).
 */
export function changePercent(direction: Direction, start: number, now: number): number | null {
  if (direction === 'off' || !Number.isFinite(start) || !Number.isFinite(now)) return null
  if (direction === 'range') {
    if (start < 0 || start > 1 || now < 0 || now > 1) return null
    if (now >= start) return start === 1 ? 0 : (now - start) / (1 - start) * 100
    return (now - start) / start * 100
  }
  if (start <= 0) return null
  return (direction === 'down' ? start - now : now - start) / start * 100
}

// ─── Baseline-Stand ─────────────────────────────────────────────────────────

export type BaselineUnit = 'days' | 'nights' | 'measurement_days' | 'reports' | 'sessions' | 'weeks'

/**
 * - `counts`: belastbare Baseline, der Wert zaehlt.
 * - `collecting`: „sammelt Baseline: have von need“ — nur in der eigenen Sicht.
 * - `none`: seit dem Start keine Daten; der Wert erscheint nicht.
 */
export type BaselineState =
  | { status: 'counts' }
  | { status: 'collecting'; have: number; need: number; unit: BaselineUnit }
  | { status: 'none' }

export interface ProgressValueInput {
  id: MetricId
  /** Startwert; bei Anteilswerten 0…1. */
  start: number | null
  /** Jetzt-Wert; bei Anteilswerten 0…1. */
  now: number | null
  baseline: BaselineState
  /** Anzeige „12/24 → 19/24“: Zaehler und Nenner bei Anteilswerten. */
  startOf?: { n: number; of: number }
  nowOf?: { n: number; of: number }
}

export interface ProgressValueResult extends ProgressValueInput {
  area: ProgressArea
  direction: Direction
  source: DirectionSource
  /** Prozent, positiv = besser; `null` = zaehlt (noch) nicht. */
  change: number | null
}

export interface ProgressResult {
  values: ProgressValueResult[]
  /** Mittel je Bereich; `null` = keine zaehlenden Werte (faellt aus dem Gesamt). */
  areas: Record<ProgressArea, number | null>
  /** Mittel der Bereiche mit Wert; `null` = noch kein Bereich zaehlt. */
  total: number | null
  /** Wie viele der fuenf Bereiche ins Gesamt eingehen. */
  areaCount: number
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function scoreProgress(
  inputs: readonly ProgressValueInput[],
  goals: readonly string[],
  overrides: DirectionOverrides = {},
): ProgressResult {
  const values = inputs.map((v): ProgressValueResult => {
    const direction = effectiveDirection(v.id, goals, overrides)
    const change = v.baseline.status === 'counts' && v.start != null && v.now != null
      ? changePercent(direction, v.start, v.now)
      : null
    return { ...v, area: areaOf(v.id), direction, source: directionSource(v.id), change }
  })
  const areas = Object.fromEntries(PROGRESS_AREAS.map(area => {
    const xs = values.filter(v => v.area === area && v.change !== null).map(v => v.change as number)
    return [area, xs.length > 0 ? mean(xs) : null]
  })) as Record<ProgressArea, number | null>
  const counted = PROGRESS_AREAS.map(a => areas[a]).filter((x): x is number => x !== null)
  return { values, areas, total: counted.length > 0 ? mean(counted) : null, areaCount: counted.length }
}

// ─── Tage ───────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000
const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))

/** Kalendertag `yyyy-MM-dd` um `days` verschoben (ohne Zeitzone). */
export const addDays = (day: string, days: number): string =>
  new Date(utc(day) + days * DAY_MS).toISOString().slice(0, 10)

/** Ganze Tage von `from` bis `to` (negativ, wenn `to` davor liegt). */
export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / DAY_MS)

/** Montag der Woche eines Tages. */
export function weekOf(day: string): string {
  const dow = new Date(utc(day)).getUTCDay()
  return addDays(day, -((dow + 6) % 7))
}

// ─── Regeln (Spec Abschnitt 2) ──────────────────────────────────────────────

/** „Jetzt“ = letzte 28 Tage. */
export const RECENT_DAYS = 28
/** Wearables: so viele Tage Daten in den 60 Tagen vor dem Start, sonst die ersten 28 Tage danach. */
export const BASELINE_BEFORE_DAYS = 60
export const BASELINE_MIN_DAYS = 14
export const BASELINE_AFTER_DAYS = 28
/** Koerperwerte: zweite Messung mindestens so viele Tage nach der ersten. */
export const BODY_SECOND_AFTER_DAYS = 14
/** Blutwerte ab dem zweiten Befund. */
export const BLOOD_MIN_REPORTS = 2
/** e1RM ab drei Einheiten mit der Uebung. */
export const E1RM_MIN_SESSIONS = 3
/** Workouts pro Woche und Adherence ab vier Wochen. */
export const RATE_MIN_WEEKS = 4
/** Schlaf im Zielbereich: 7–9 Stunden. */
export const SLEEP_RANGE_MIN: readonly [number, number] = [7 * 60, 9 * 60]
export const E1RM_TOP = 3

export interface DatedValue { day: string; value: number }

const sorted = (points: readonly DatedValue[], startOn: string, today: string) =>
  points
    .filter(p => Number.isFinite(p.value) && p.day >= startOn && p.day <= today)
    .sort((a, b) => a.day.localeCompare(b.day))

/**
 * Gewicht, KFA, Muskelmasse, Umfaenge: Start = erste Messung ab dem Start;
 * zaehlt mit einer zweiten mindestens 14 Tage spaeter. Jetzt = Mittel der
 * Messungen der letzten 28 Tage ohne die Startmessung, sonst die letzte.
 */
export function bodyValue(id: MetricId, points: readonly DatedValue[], startOn: string, today: string): ProgressValueInput {
  const ps = sorted(points, startOn, today)
  if (ps.length === 0) return { id, start: null, now: null, baseline: { status: 'none' } }
  const first = ps[0]
  const later = ps.filter(p => daysBetween(first.day, p.day) >= BODY_SECOND_AFTER_DAYS)
  if (later.length === 0) {
    const have = Math.min(BODY_SECOND_AFTER_DAYS - 1, daysBetween(first.day, ps[ps.length - 1].day))
    return { id, start: first.value, now: null, baseline: { status: 'collecting', have, need: BODY_SECOND_AFTER_DAYS, unit: 'days' } }
  }
  const from = addDays(today, -(RECENT_DAYS - 1))
  const recent = ps.slice(1).filter(p => p.day >= from).map(p => p.value)
  const now = recent.length > 0 ? mean(recent) : ps[ps.length - 1].value
  return { id, start: first.value, now, baseline: { status: 'counts' } }
}

export interface BloodReport { day: string; inRange: number; of: number }

/** Marker im Zielbereich: Anteil des ersten Befunds ab Start → des letzten; zaehlt ab dem zweiten. */
export function bloodValue(reports: readonly BloodReport[], startOn: string, today: string): ProgressValueInput {
  const id: MetricId = 'markers_in_range'
  const rs = reports
    .filter(r => r.day >= startOn && r.day <= today && r.of > 0 && r.inRange >= 0 && r.inRange <= r.of)
    .sort((a, b) => a.day.localeCompare(b.day))
  if (rs.length === 0) return { id, start: null, now: null, baseline: { status: 'none' } }
  const first = rs[0]
  const last = rs[rs.length - 1]
  const startOf = { n: first.inRange, of: first.of }
  if (rs.length < BLOOD_MIN_REPORTS) {
    return { id, start: first.inRange / first.of, now: null, startOf, baseline: { status: 'collecting', have: rs.length, need: BLOOD_MIN_REPORTS, unit: 'reports' } }
  }
  return {
    id, start: first.inRange / first.of, now: last.inRange / last.of, startOf, nowOf: { n: last.inRange, of: last.of },
    baseline: { status: 'counts' },
  }
}

/** Fenster [from, to] als Tage. */
const within = (day: string, from: string, to: string) => day >= from && day <= to

/**
 * Raten (Workouts pro Woche, Adherence) zaehlen ab vier Wochen Daten, gerechnet
 * ab dem ersten Datentag seit dem Start („erste Messung“): Start = diese ersten
 * vier Wochen, jetzt = die letzten vier Wochen bis heute.
 */
function rateValue(
  id: MetricId, firstDay: string, today: string, rate: (from: string, to: string) => number | null,
): ProgressValueInput {
  const elapsed = daysBetween(firstDay, today)
  if (elapsed < RATE_MIN_WEEKS * 7) {
    const have = Math.min(RATE_MIN_WEEKS - 1, Math.floor(elapsed / 7))
    return { id, start: null, now: null, baseline: { status: 'collecting', have, need: RATE_MIN_WEEKS, unit: 'weeks' } }
  }
  return {
    id,
    start: rate(firstDay, addDays(firstDay, RECENT_DAYS - 1)),
    now: rate(addDays(today, -(RECENT_DAYS - 1)), today),
    baseline: { status: 'counts' },
  }
}

/** Workouts pro Woche; ohne ein Training seit dem Start erscheint der Wert nicht. */
export function workoutsValue(sessionDays: readonly string[], startOn: string, today: string): ProgressValueInput {
  const days = sessionDays.filter(d => within(d, startOn, today)).sort()
  if (days.length === 0) return { id: 'workouts_per_week', start: null, now: null, baseline: { status: 'none' } }
  return rateValue('workouts_per_week', days[0], today,
    (from, to) => days.filter(d => within(d, from, to)).length / RATE_MIN_WEEKS)
}

export interface DoseDay { day: string; taken: number; due: number }

/** Adherence in % (bestaetigt ÷ faellig); ohne faellige Einnahme seit dem Start erscheint der Wert nicht. */
export function adherenceValue(doseDays: readonly DoseDay[], startOn: string, today: string): ProgressValueInput {
  const days = doseDays.filter(d => within(d.day, startOn, today) && d.due > 0).sort((a, b) => a.day.localeCompare(b.day))
  if (days.length === 0) return { id: 'adherence', start: null, now: null, baseline: { status: 'none' } }
  return rateValue('adherence', days[0].day, today, (from, to) => {
    const w = days.filter(d => within(d.day, from, to))
    const due = w.reduce((a, d) => a + d.due, 0)
    return due > 0 ? Math.min(1, w.reduce((a, d) => a + d.taken, 0) / due) * 100 : null
  })
}

export interface ExerciseE1rm { exerciseId: string; points: readonly DatedValue[] }

/**
 * e1RM der drei Uebungen mit dem hoechsten e1RM seit dem Start. Start = erste
 * Einheit ab dem Start, jetzt = bestes e1RM der letzten 28 Tage (ohne die
 * Starteinheit), sonst die letzte Einheit. Zaehlt ab drei Einheiten.
 */
export function e1rmValues(exercises: readonly ExerciseE1rm[], startOn: string, today: string): ProgressValueInput[] {
  return exercises
    .filter(e => isMetricId(e1rmId(e.exerciseId)))
    .map(e => ({ e, ps: sorted(e.points, startOn, today) }))
    .filter(x => x.ps.length > 0)
    .map(x => ({ ...x, best: Math.max(...x.ps.map(p => p.value)) }))
    .sort((a, b) => b.best - a.best || a.e.exerciseId.localeCompare(b.e.exerciseId))
    .slice(0, E1RM_TOP)
    .map(({ e, ps }): ProgressValueInput => {
      const id = e1rmId(e.exerciseId)
      if (ps.length < E1RM_MIN_SESSIONS) {
        return { id, start: ps[0].value, now: null, baseline: { status: 'collecting', have: ps.length, need: E1RM_MIN_SESSIONS, unit: 'sessions' } }
      }
      const from = addDays(today, -(RECENT_DAYS - 1))
      const recent = ps.slice(1).filter(p => p.day >= from).map(p => p.value)
      const now = recent.length > 0 ? Math.max(...recent) : ps[ps.length - 1].value
      return { id, start: ps[0].value, now, baseline: { status: 'counts' } }
    })
}

// ─── Wearables ──────────────────────────────────────────────────────────────

/**
 * Gespeicherte Baseline eines Wearable-Werts (`progress_settings.baselines`),
 * einmal beim Setzen des Starts gelesen (services/progressBaseline.ts).
 * - `before`: mindestens 14 Tage Daten in den 60 Tagen vor dem Start; `value`
 *   ist deren Mittel (Schlaf: Anteil der Naechte mit 7–9 h, 0…1).
 * - `after_start`: zu wenig davor (`days` gefunden); die ersten 28 Tage nach dem
 *   Start werden die Baseline (mindestens 14 Tage mit Daten), der Wert zaehlt ab Tag 29.
 * `on` = Start, fuer den gelesen wurde; eine Baseline fuer einen anderen Start gilt nicht.
 */
export type StoredBaseline =
  | { source: 'before'; on: string; value: number; days: number }
  | { source: 'after_start'; on: string; days: number }

export type StoredBaselines = Partial<Record<WearableMetricId, StoredBaseline>>

/** Spalte in `health_daily` je Wearable-Wert (HRV, VO2max erst mit Schritt 1b). */
export const WEARABLE_COLUMN: Partial<Record<WearableMetricId, Exclude<keyof HealthDailyRow, 'day'>>> = {
  steps: 'steps', active_kcal: 'active_kcal', resting_hr: 'resting_hr', bp_sys: 'bp_sys', sleep_nights: 'sleep_min',
}

export const isWearableMetric = (id: string): id is WearableMetricId => (WEARABLE_METRICS as readonly string[]).includes(id)

/** Tageswerte eines Wearable-Werts im Fenster [from, to]; ohne Spalte (HRV, VO2max bis 1b) leer. */
export function wearableDays(rows: readonly HealthDailyRow[], id: WearableMetricId, from: string, to: string): number[] {
  const column = WEARABLE_COLUMN[id]
  if (!column) return []
  return rows
    .filter(r => within(r.day, from, to) && r[column] != null && Number.isFinite(Number(r[column])))
    .map(r => Number(r[column]))
}

/** Mittel (bzw. bei Schlaf: Anteil der Naechte mit 7–9 h) ueber Tage mit Daten; `null` ohne Daten. */
export function wearableStat(id: WearableMetricId, values: readonly number[]): number | null {
  if (values.length === 0) return null
  if (id === 'sleep_nights') {
    const [lo, hi] = SLEEP_RANGE_MIN
    return values.filter(m => m >= lo && m <= hi).length / values.length
  }
  return mean(values)
}

/** Bereinigt `progress_settings.baselines`; nur Eintraege fuer genau diesen Start. */
export function parseBaselines(raw: unknown, startOn: string): StoredBaselines {
  const out: StoredBaselines = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, b] of Object.entries(raw as Record<string, unknown>)) {
    if (!isWearableMetric(key) || !b || typeof b !== 'object') continue
    const e = b as Record<string, unknown>
    if (e.on !== startOn || typeof e.days !== 'number') continue
    if (e.source === 'before' && typeof e.value === 'number' && Number.isFinite(e.value)) {
      out[key] = { source: 'before', on: startOn, value: e.value, days: e.days }
    } else if (e.source === 'after_start') {
      out[key] = { source: 'after_start', on: startOn, days: e.days }
    }
  }
  return out
}

/**
 * Wearable-Wert. Jetzt = die 28 abgeschlossenen Tage vor heute, nie vor dem
 * Start (der heutige Tag ist noch nicht vorbei). Mit `before`-Baseline zaehlt
 * er sofort; sonst sammelt er 28 Tage ab dem Start und zaehlt ab Tag 29 mit
 * deren Mittel als Start — aber nur, wenn in diesen 28 Tagen mindestens 14
 * Tage (Naechte) Daten liegen. Kein Rueckfall auf „erste 7 Tage“.
 */
export function wearableValue(
  id: WearableMetricId, rows: readonly HealthDailyRow[], baseline: StoredBaseline | undefined, startOn: string, today: string,
): ProgressValueInput {
  const unit: BaselineUnit = id === 'sleep_nights' ? 'nights' : 'days'
  const nowFrom = [addDays(today, -RECENT_DAYS), startOn].sort().at(-1)!
  const nowDays = wearableDays(rows, id, nowFrom, addDays(today, -1))
  const now = wearableStat(id, nowDays)
  const of = (xs: readonly number[]) => id === 'sleep_nights' && xs.length > 0
    ? { n: Math.round((wearableStat(id, xs) ?? 0) * xs.length), of: xs.length }
    : undefined
  if (baseline?.source === 'before' && baseline.on === startOn) {
    return { id, start: baseline.value, now, nowOf: of(nowDays), baseline: { status: 'counts' } }
  }
  // Ohne Daten seit dem Start (etwa HRV und VO2max bis Schritt 1b) erscheint der Wert nicht.
  if (wearableDays(rows, id, startOn, today).length === 0) return { id, start: null, now: null, baseline: { status: 'none' } }
  const elapsed = daysBetween(startOn, today)
  if (elapsed < BASELINE_AFTER_DAYS) {
    return { id, start: null, now: null, baseline: { status: 'collecting', have: elapsed, need: BASELINE_AFTER_DAYS, unit } }
  }
  // Auch die 28 Tage nach dem Start brauchen mindestens 14 Tage (Naechte) mit
  // Daten; sonst sammelt der Wert weiter („9 von 14 Tagen“), bis ein neuer Start gesetzt wird.
  const firstDays = wearableDays(rows, id, startOn, addDays(startOn, BASELINE_AFTER_DAYS - 1))
  if (firstDays.length < BASELINE_MIN_DAYS) {
    return { id, start: null, now: null, baseline: { status: 'collecting', have: firstDays.length, need: BASELINE_MIN_DAYS, unit } }
  }
  return { id, start: wearableStat(id, firstDays), now, startOf: of(firstDays), nowOf: of(nowDays), baseline: { status: 'counts' } }
}

// ─── Alles zusammen ─────────────────────────────────────────────────────────

export interface ProgressInput {
  /** Heute (Ortszeit), `yyyy-MM-dd`. */
  today: string
  /** Start (`progress_settings.start_on`). */
  startOn: string
  goals: readonly string[]
  overrides?: DirectionOverrides
  weight: readonly DatedValue[]
  bodyFat: readonly DatedValue[]
  muscleMass: readonly DatedValue[]
  circumferences: Partial<Record<MeasurementSite, readonly DatedValue[]>>
  bloodReports: readonly BloodReport[]
  /** Tag je Training (eine Einheit = ein Eintrag). */
  sessionDays: readonly string[]
  e1rm: readonly ExerciseE1rm[]
  doseDays: readonly DoseDay[]
  healthDaily: readonly HealthDailyRow[]
  baselines: StoredBaselines
  /**
   * Ohne gesetzten Start („erste Messung je Wert“): eigener Start je
   * Wearable-Wert = sein erster Tag mit Daten. Sonst gilt `startOn`.
   */
  wearableStarts?: Partial<Record<WearableMetricId, string>>
}

/** Alle Werte der fuenf Bereiche; Werte ohne Daten seit dem Start fehlen. */
export function buildProgressValues(input: ProgressInput): ProgressValueInput[] {
  const { startOn, today } = input
  const values: ProgressValueInput[] = [
    bodyValue('weight', input.weight, startOn, today),
    bodyValue('body_fat', input.bodyFat, startOn, today),
    bodyValue('muscle_mass', input.muscleMass, startOn, today),
    ...MEASUREMENT_SITES.map(site => bodyValue(`circ_${site}`, input.circumferences[site] ?? [], startOn, today)),
    bloodValue(input.bloodReports, startOn, today),
    workoutsValue(input.sessionDays, startOn, today),
    ...e1rmValues(input.e1rm, startOn, today),
    adherenceValue(input.doseDays, startOn, today),
    ...WEARABLE_METRICS.map(id =>
      wearableValue(id, input.healthDaily, input.baselines[id], input.wearableStarts?.[id] ?? startOn, today)),
  ]
  return values.filter(v => v.baseline.status !== 'none')
}

export function computeProgress(input: ProgressInput): ProgressResult {
  return scoreProgress(buildProgressValues(input), input.goals, input.overrides)
}

// ─── Schnappschuss und Wochenreihe ──────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10

/** Form fuer andere (`profile_snapshots.data.progress`): nur Gesamt, Bereiche und Start. */
export interface ProgressSnapshot {
  total: number
  areas: Partial<Record<ProgressArea, number>>
  since: string
}

/** Bereiche mit Wert, auf eine Stelle gerundet (Schnappschuss und Wochenreihe). */
function roundedAreas(result: ProgressResult): Partial<Record<ProgressArea, number>> {
  const areas: Partial<Record<ProgressArea, number>> = {}
  for (const a of PROGRESS_AREAS) {
    const v = result.areas[a]
    if (v !== null) areas[a] = round1(v)
  }
  return areas
}

export function progressSnapshot(result: ProgressResult, startOn: string): ProgressSnapshot | undefined {
  if (result.total === null) return undefined
  return { total: round1(result.total), areas: roundedAreas(result), since: startOn }
}

/** Ein Punkt der Zeitreise (`progress_settings.history`), Woche = Montag. */
export interface ProgressHistoryEntry {
  week: string
  total: number | null
  areas: Partial<Record<ProgressArea, number>>
}

export const HISTORY_MAX_WEEKS = 104

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export function historyEntry(result: ProgressResult, day: string): ProgressHistoryEntry {
  return { week: weekOf(day), total: result.total === null ? null : round1(result.total), areas: roundedAreas(result) }
}

/** Bereinigt `progress_settings.history`. */
export function parseHistory(raw: unknown): ProgressHistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: ProgressHistoryEntry[] = []
  for (const e of raw) {
    if (!e || typeof e !== 'object' || !isDay((e as { week?: unknown }).week)) continue
    const r = e as Record<string, unknown>
    const areas: Partial<Record<ProgressArea, number>> = {}
    const rawAreas = r.areas && typeof r.areas === 'object' ? r.areas as Record<string, unknown> : {}
    for (const a of PROGRESS_AREAS) {
      const v = rawAreas[a]
      if (typeof v === 'number' && Number.isFinite(v)) areas[a] = v
    }
    const total = typeof r.total === 'number' && Number.isFinite(r.total) ? r.total : null
    out.push({ week: r.week as string, total, areas })
  }
  return withHistory([], out)
}

/** Fuegt Eintraege hinzu (dieselbe Woche wird ersetzt), aufsteigend, hoechstens 104 Wochen. */
export function withHistory(history: readonly ProgressHistoryEntry[], entries: readonly ProgressHistoryEntry[]): ProgressHistoryEntry[] {
  const byWeek = new Map(history.map(e => [e.week, e]))
  for (const e of entries) byWeek.set(e.week, e)
  return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-HISTORY_MAX_WEEKS)
}

/**
 * Wochenreihe seit dem Start (hoechstens 104 Wochen): fuer jede Woche der Stand
 * an ihrem Sonntag, die laufende Woche mit dem Stand von heute. Fuer die
 * Zeitreise und zum Nachtragen, wenn die Reihe Luecken hat.
 */
export function progressHistory(input: ProgressInput): ProgressHistoryEntry[] {
  const entries: ProgressHistoryEntry[] = []
  if (input.today < input.startOn) return entries
  const lastWeek = weekOf(input.today)
  let week = [weekOf(addDays(input.today, -7 * (HISTORY_MAX_WEEKS - 1))), weekOf(input.startOn)].sort().at(-1)!
  while (week <= lastWeek) {
    const sunday = addDays(week, 6)
    const day = sunday < input.today ? sunday : input.today
    entries.push(historyEntry(computeProgress({ ...input, today: day }), day))
    week = addDays(week, 7)
  }
  return entries
}
