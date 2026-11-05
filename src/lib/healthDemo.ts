/**
 * Erfundene Uhrdaten für Entwicklung und Tests — ohne Wearable, ohne Handy.
 *
 * Nur in Entwicklungs-Builds und in Builds mit VITE_HEALTH_DEMO=1 (Playwright).
 * Der Schalter steht in health.ts; im Produktions-Build fällt dieser Code
 * beim Bündeln heraus.
 *
 * Einschalten: `?healthDemo=normal` an die URL hängen (bleibt im Browser
 * gespeichert), ausschalten mit `?healthDemo=aus`.
 *
 * Die Werte sind deterministisch (kein Zufall) und hängen nur vom Abstand zu
 * heute ab — Tests bekommen bei gleicher Uhrzeit immer dieselben Zahlen.
 */
import type {
  HealthHeartRate,
  HealthPermissionResult,
  HealthSleep,
  HealthSteps,
  HealthWeight,
  HealthWorkout,
} from './health'

export const HEALTH_DEMO_SCENARIOS = ['normal', 'leer', 'luecken', 'extrem', 'android'] as const
export type HealthDemoScenario = (typeof HEALTH_DEMO_SCENARIOS)[number]

export const HEALTH_DEMO_STORAGE_KEY = 'hoku:health-demo'
const OFF_VALUES = new Set(['aus', 'off', '0', ''])

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
/** Schritte und aktive Energie fallen gleichmäßig zwischen 7 und 22 Uhr an. */
const WAKE_START_H = 7
const WAKE_END_H = 22

export interface HealthDemoRange {
  startDate: Date
  endDate: Date
  limit: number
}

export interface HealthDemo {
  scenario: HealthDemoScenario
  platform: 'ios' | 'android'
  requestPermissions(): HealthPermissionResult
  weight(range: HealthDemoRange): HealthWeight | null
  steps(range: HealthDemoRange): HealthSteps
  sleep(range: HealthDemoRange): HealthSleep[]
  heartRate(range: HealthDemoRange): HealthHeartRate[]
  restingHeartRate(range: HealthDemoRange): HealthHeartRate[]
  workouts(range: HealthDemoRange): HealthWorkout[]
  activeEnergy(range: HealthDemoRange): number | null
}

function isScenario(value: string | null | undefined): value is HealthDemoScenario {
  return !!value && (HEALTH_DEMO_SCENARIOS as readonly string[]).includes(value)
}

/**
 * Szenario aus der URL (`?healthDemo=…`) oder aus dem Browser-Speicher.
 * Ein Wert in der URL wird gespeichert, damit er Seitenwechsel übersteht.
 */
export function readHealthDemoScenario(
  search: string = typeof location === 'undefined' ? '' : location.search,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeLocalStorage(),
): HealthDemoScenario | null {
  const fromUrl = new URLSearchParams(search).get('healthDemo')
  if (fromUrl !== null) {
    const value = fromUrl.trim().toLowerCase()
    try {
      if (isScenario(value)) storage?.setItem(HEALTH_DEMO_STORAGE_KEY, value)
      else if (OFF_VALUES.has(value)) storage?.removeItem(HEALTH_DEMO_STORAGE_KEY)
    } catch { /* Speicher gesperrt (privates Fenster) — dann gilt nur die URL */ }
    if (isScenario(value)) return value
    if (OFF_VALUES.has(value)) return null
  }
  try {
    const stored = storage?.getItem(HEALTH_DEMO_STORAGE_KEY)
    return isScenario(stored) ? stored : null
  } catch {
    return null
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Deterministische Zahl in [0, 1) für Tag und Kanal. */
function noise(day: number, channel: number): number {
  const x = Math.sin((day + 1) * 12.9898 + channel * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Datum `daysAgo` Tage vor heute um hh:mm Ortszeit. */
function at(now: Date, daysAgo: number, hours: number, minutes = 0): Date {
  const day = startOfDay(now)
  day.setDate(day.getDate() - daysAgo)
  day.setHours(hours, minutes, 0, 0)
  return day
}

function inRange(date: Date, range: HealthDemoRange, now: Date): boolean {
  const t = date.getTime()
  return t >= range.startDate.getTime() && t <= Math.min(range.endDate.getTime(), now.getTime())
}

function daysBetween(range: HealthDemoRange, now: Date): number[] {
  const first = Math.floor((startOfDay(now).getTime() - startOfDay(range.startDate).getTime()) / DAY_MS)
  const last = Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(range.endDate).getTime()) / DAY_MS))
  const days: number[] = []
  for (let d = Math.min(first, 400); d >= last; d--) days.push(d)
  return days
}

/** Anteil eines Tagessaldos, der im Zeitraum liegt (gleichmäßig 7–22 Uhr verteilt). */
function sumSpread(range: HealthDemoRange, now: Date, perDay: (daysAgo: number) => number): number {
  const end = Math.min(range.endDate.getTime(), now.getTime())
  let total = 0
  for (const d of daysBetween(range, now)) {
    const wakeStart = at(now, d, WAKE_START_H).getTime()
    const wakeEnd = at(now, d, WAKE_END_H).getTime()
    const overlap = Math.min(end, wakeEnd) - Math.max(range.startDate.getTime(), wakeStart)
    if (overlap > 0) total += perDay(d) * (overlap / (wakeEnd - wakeStart))
  }
  return total
}

function newestFirst<T>(items: T[], date: (item: T) => Date, limit: number): T[] {
  const sorted = [...items].sort((a, b) => date(b).getTime() - date(a).getTime())
  return limit > 0 ? sorted.slice(0, limit) : sorted
}

interface WorkoutTemplate {
  activityType: string
  activityId?: number | null
  startH: number
  durationMin: number
  distanceM: number | null
  kcal: number | null
  avgHr: number | null
}

interface ScenarioData {
  platform: 'ios' | 'android'
  source: string
  weight: { kg: number; daysAgo: number } | null
  stepsPerDay: (d: number) => number
  /** Schlaf der Nacht, die am Morgen von Tag d endet (Stunden), null = keine Daten. */
  sleepHours: (d: number) => number | null
  /** Nur „InBed" ohne Schlafphasen (Handy statt Uhr). */
  sleepInBedOnly?: (d: number) => boolean
  heartRateWindow: { fromH: number; toH: number } | null
  heartRate: (i: number) => number
  restingHr: (d: number) => number | null
  workouts: (d: number) => WorkoutTemplate[]
  activeEnergyPerDay: ((d: number) => number) | null
}

const NORMAL_WEEK: Record<number, WorkoutTemplate> = {
  1: { activityType: 'Running', startH: 7, durationMin: 45, distanceM: 8200, kcal: 520, avgHr: 148 },
  3: { activityType: 'Traditional Strength Training', startH: 18, durationMin: 60, distanceM: null, kcal: 380, avgHr: 118 },
  5: { activityType: 'Cycling', startH: 10, durationMin: 90, distanceM: 32400, kcal: 780, avgHr: 135 },
  6: { activityType: 'Yoga', startH: 19, durationMin: 30, distanceM: null, kcal: 90, avgHr: 92 },
}

const NORMAL: ScenarioData = {
  platform: 'ios',
  source: 'Demo-Uhr',
  weight: { kg: 82.4, daysAgo: 1 },
  stepsPerDay: d => Math.round(6000 + 6000 * noise(d, 1)),
  sleepHours: d => Math.round((6.2 + 1.9 * noise(d, 2)) * 10) / 10,
  heartRateWindow: { fromH: -24, toH: 0 },
  heartRate: i => Math.round(62 + 22 * noise(i, 3)),
  restingHr: d => Math.round(52 + 6 * noise(d, 4)),
  workouts: d => (NORMAL_WEEK[d % 7] && d > 0 ? [NORMAL_WEEK[d % 7]] : []),
  activeEnergyPerDay: d => Math.round(350 + 300 * noise(d, 5)),
}

const SCENARIOS: Record<HealthDemoScenario, ScenarioData> = {
  normal: NORMAL,

  // Erlaubnis da, aber nichts aufgezeichnet (neues Handy, keine Uhr).
  leer: {
    platform: 'ios',
    source: 'Demo-Uhr',
    weight: null,
    stepsPerDay: () => 0,
    sleepHours: () => null,
    heartRateWindow: null,
    heartRate: () => 0,
    restingHr: () => null,
    workouts: () => [],
    activeEnergyPerDay: () => 0,
  },

  // Uhr nur manchmal getragen: Lücken, alte Werte, Workouts ohne Messwerte.
  luecken: {
    platform: 'ios',
    source: 'Demo-Uhr',
    weight: { kg: 79, daysAgo: 200 },
    stepsPerDay: d => (d % 2 === 0 ? 1234 : 0),
    sleepHours: d => (d % 3 === 0 ? null : 6.5),
    sleepInBedOnly: d => d % 3 === 1,
    heartRateWindow: { fromH: -20, toH: -14 },
    heartRate: i => Math.round(70 + 10 * noise(i, 3)),
    restingHr: d => (d % 4 === 0 ? 58 : null),
    workouts: d => {
      if (d === 2) return [{ activityType: 'Other', activityId: 79, startH: 17, durationMin: 50, distanceM: null, kcal: null, avgHr: null }]
      if (d === 9) return [{ activityType: 'Running', startH: 8, durationMin: 0, distanceM: -1, kcal: 0, avgHr: null }]
      return []
    },
    activeEnergyPerDay: null,
  },

  // Grenzwerte: sehr hohe/niedrige Zahlen, lange Namen, viele Einheiten an einem Tag.
  extrem: {
    platform: 'ios',
    source: 'Garmin Forerunner 965 Solar Edition mit sehr langem Gerätenamen',
    weight: { kg: 184.7, daysAgo: 0 },
    stepsPerDay: () => 48213,
    sleepHours: d => (d === 0 ? 3.1 : d % 2 === 0 ? 13.5 : 4),
    heartRateWindow: { fromH: -24, toH: 0 },
    heartRate: i => (i % 2 === 0 ? 38 : 201),
    restingHr: () => 38,
    workouts: d => {
      if (d === 1) {
        return [
          { activityType: 'Running', startH: 5, durationMin: 360, distanceM: 62400, kcal: 4870, avgHr: 171 },
          ...Array.from({ length: 11 }, (_, i) => ({
            activityType: i % 2 === 0 ? 'Traditional Strength Training' : 'Underwater Basket Weaving Championship Final Round',
            startH: 12 + i,
            durationMin: 40,
            distanceM: null,
            kcal: 300,
            avgHr: 120,
          })),
        ]
      }
      return d === 3 ? [{ activityType: 'Traditional Strength Training', startH: 9, durationMin: 180, distanceM: null, kcal: 1900, avgHr: 140 }] : []
    },
    activeEnergyPerDay: () => 3850,
  },

  // Wie Android heute mit capacitor-health-connect 0.7: kein Schlaf, keine Workouts, keine aktiven kcal.
  android: {
    ...NORMAL,
    platform: 'android',
    source: 'com.google.android.apps.fitness',
    sleepHours: () => null,
    workouts: () => [],
    activeEnergyPerDay: null,
  },
}

export function createHealthDemo(scenario: HealthDemoScenario, clock: () => Date = () => new Date()): HealthDemo {
  const data = SCENARIOS[scenario]

  return {
    scenario,
    platform: data.platform,

    requestPermissions: () => ({ platform: data.platform, available: true, granted: true }),

    weight(range) {
      if (!data.weight) return null
      const now = clock()
      const date = at(now, data.weight.daysAgo, 7, 30)
      if (date.getTime() > now.getTime() || !inRange(date, range, now)) return null
      return { valueKg: data.weight.kg, date, source: data.source }
    },

    steps(range) {
      const now = clock()
      return { count: Math.round(sumSpread(range, now, data.stepsPerDay)), startDate: range.startDate, endDate: range.endDate }
    },

    sleep(range) {
      const now = clock()
      const samples: HealthSleep[] = []
      for (const d of daysBetween(range, now)) {
        const hours = data.sleepHours(d)
        if (hours == null) continue
        const wake = at(now, d, 6, 45)
        if (wake.getTime() > now.getTime()) continue
        const bedStart = new Date(wake.getTime() - (hours + 0.4) * HOUR_MS)
        samples.push({ startDate: bedStart, endDate: wake, durationHours: hours + 0.4, state: 'InBed', source: data.source })
        if (data.sleepInBedOnly?.(d)) continue
        // Schlaf in drei Blöcken mit zwei kurzen Wachphasen — so liefert eine Uhr die Nacht.
        let cursor = bedStart.getTime() + 0.2 * HOUR_MS
        for (const share of [0.35, 0.4, 0.25]) {
          const end = cursor + share * hours * HOUR_MS
          samples.push({ startDate: new Date(cursor), endDate: new Date(end), durationHours: share * hours, state: 'Asleep', source: data.source })
          cursor = end + 0.1 * HOUR_MS
        }
      }
      return newestFirst(samples.filter(s => inRange(s.endDate, range, now)), s => s.endDate, range.limit)
    },

    heartRate(range) {
      const now = clock()
      const window = data.heartRateWindow
      if (!window) return []
      const samples: HealthHeartRate[] = []
      // Alle 10 Minuten ein Wert im Fenster relativ zu jetzt.
      for (let i = 0, t = now.getTime() + window.toH * HOUR_MS; t >= now.getTime() + window.fromH * HOUR_MS; i++, t -= 10 * 60 * 1000) {
        samples.push({ bpm: data.heartRate(i), date: new Date(t), source: data.source })
      }
      return newestFirst(samples.filter(s => inRange(s.date, range, now)), s => s.date, range.limit)
    },

    restingHeartRate(range) {
      const now = clock()
      const samples: HealthHeartRate[] = []
      for (const d of daysBetween(range, now)) {
        const bpm = data.restingHr(d)
        const date = at(now, d, 8)
        if (bpm != null && date.getTime() <= now.getTime()) samples.push({ bpm, date, source: data.source })
      }
      return newestFirst(samples.filter(s => inRange(s.date, range, now)), s => s.date, range.limit)
    },

    workouts(range) {
      const now = clock()
      const items: HealthWorkout[] = []
      for (const d of daysBetween(range, now)) {
        data.workouts(d).forEach((w, i) => {
          const startDate = at(now, d, w.startH)
          const endDate = new Date(startDate.getTime() + w.durationMin * 60 * 1000)
          if (endDate.getTime() > now.getTime()) return
          items.push({
            externalId: `demo-${scenario}-${d}-${i}`,
            activityType: w.activityType,
            activityId: w.activityId ?? null,
            startDate,
            endDate,
            durationS: w.durationMin * 60,
            distanceM: w.distanceM != null && w.distanceM > 0 ? w.distanceM : null,
            kcal: w.kcal != null && w.kcal > 0 ? w.kcal : null,
            avgHr: w.avgHr,
            source: data.source,
          })
        })
      }
      return newestFirst(items.filter(w => inRange(w.startDate, range, now)), w => w.startDate, range.limit)
    },

    activeEnergy(range) {
      if (!data.activeEnergyPerDay) return null
      return Math.round(sumSpread(range, clock(), data.activeEnergyPerDay))
    },
  }
}
