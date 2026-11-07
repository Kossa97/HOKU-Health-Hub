import { describe, expect, it } from 'vitest'
import type { BloodworkEntry } from '../../blutwerte/types'
import type { HealthDailyRow } from '../../wearables/lib/healthDaily'
import type { CustomExercise, TrainingRoutine, TrainingSession, TrainingSet } from '../../training/types'
import {
  buildProfileSnapshot, entryStreak, shiftDay, SNAPSHOT_KEYS_ARE_FIELDS, type ProfileSnapshotInput,
} from './profileSnapshot'
import { PROFILE_FIELDS } from './profileVisibility'

const NOW = new Date(2026, 9, 31, 12, 0, 0)
const TODAY = '2026-10-31'
const ago = (n: number) => shiftDay(TODAY, -n)
/** Ortszeit-Zeitstempel mittags, `n` Tage vor heute. */
const stamp = (n: number) => new Date(2026, 9, 31 - n, 12, 0, 0).toISOString()

const empty = (): ProfileSnapshotInput => ({
  lang: 'de',
  profile: { birthDate: null, heightCm: null, weightKg: null, favoriteExercise: null, routineId: null },
  bio: { birthDate: null, sex: null },
  weightLogs: [],
  dailyLogs: [],
  measurements: [],
  doseLogs: [],
  stackItemCount: 0,
  activeCycleCount: 0,
  bloodwork: [],
  healthDaily: [],
  sessions: [],
  routines: [],
  customExercises: [],
  reviewRatings: [],
})

const day = (log_date: string, extra: Partial<{ body_fat_pct: number | null; muscle_mass_kg: number | null }> = {}) => ({
  log_date, energie: null, schlaf: null, wohlbefinden: null, libido: null, body_fat_pct: null, ...extra,
})

const blood = (marker: string, value: number, unit: string, tested_at: string, ref?: [number, number]): BloodworkEntry => ({
  id: `${marker}-${tested_at}`, user_id: 'u', tested_at, marker, value, unit, notes: null, created_at: null,
  report_id: null, ref_min: ref?.[0] ?? null, ref_max: ref?.[1] ?? null,
})

const health = (d: string, values: Partial<HealthDailyRow>): HealthDailyRow => ({
  day: d, steps: null, resting_hr: null, sleep_min: null, active_kcal: null, spo2_pct: null, resp_rate: null,
  bp_sys: null, bp_dia: null, ...values,
})

const work = (weightKg: number, reps: number): TrainingSet => ({ type: 'normal', weightKg, reps, done: true })

function session(id: string, n: number, exercises: TrainingSession['exercises'] = []): TrainingSession {
  return {
    id, kind: 'strength', title: id, startedAt: stamp(n), endedAt: null, durationS: 3600, distanceM: null,
    kcal: null, avgHr: null, rpe: null, notes: null, routineId: null, exercises, source: 'manual', externalId: null,
  }
}

const custom: CustomExercise[] = [
  { id: 'c1', name: 'Eigene Presse', category: 'strength', equipment: 'machine', tracking: 'weight_reps', primary: ['chest'], secondary: [] },
]

describe('buildProfileSnapshot', () => {
  it('liefert ohne Daten ein leeres Objekt — fehlende Felder fehlen, kein null', () => {
    expect(buildProfileSnapshot(empty(), NOW)).toEqual({})
  })

  it('nutzt nur Schluessel aus der Feldliste und nie die, die der Server selbst liest', () => {
    expect(SNAPSHOT_KEYS_ARE_FIELDS).toBe(true)
    const snap = buildProfileSnapshot(full(), NOW)
    const keys = Object.keys(snap)
    for (const key of keys) expect(PROFILE_FIELDS as readonly string[]).toContain(key)
    for (const key of ['bio', 'goals', 'country', 'gender', 'member_since', 'cover', 'hrv', 'vo2max']) {
      expect(keys).not.toContain(key)
    }
    expect(JSON.stringify(snap)).not.toContain('null')
  })

  it('rechnet Alter, Groesse und Gewicht mit Aenderung seit Start', () => {
    const input = empty()
    input.profile = { ...input.profile, birthDate: '1990-11-01', heightCm: 182.4, weightKg: 90 }
    input.weightLogs = [
      { logged_at: `${ago(30)}T12:00:00`, weight_kg: 84.2 },
      { logged_at: `${ago(10)}T12:00:00`, weight_kg: 82 },
      { logged_at: `${ago(1)}T12:00:00`, weight_kg: 81 },
    ]
    const snap = buildProfileSnapshot(input, NOW)
    expect(snap.age).toEqual({ v: 35 })
    expect(snap.height).toEqual({ v: 182, unit: 'cm' })
    expect(snap.weight).toEqual({ v: 81, unit: 'kg', delta: -3.2 })
  })

  it('nimmt das Profilgewicht nur ohne Gewichtseintraege, ohne Aenderung', () => {
    const input = empty()
    input.profile = { ...input.profile, weightKg: 79.95 }
    expect(buildProfileSnapshot(input, NOW).weight).toEqual({ v: 80, unit: 'kg' })
  })

  it('zeigt KFA und Muskelmasse; Aenderung erst ab drei Punkten wie im Verlauf', () => {
    const input = empty()
    input.dailyLogs = [
      day(ago(20), { body_fat_pct: 18, muscle_mass_kg: 37 }),
      day(ago(10), { body_fat_pct: 17.2 }),
      day(ago(2), { body_fat_pct: 16.4, muscle_mass_kg: 37.9 }),
    ]
    const snap = buildProfileSnapshot(input, NOW)
    expect(snap.body_fat).toEqual({ v: 16.4, unit: '%', delta: -1.6 })
    expect(snap.muscle_mass).toEqual({ v: 37.9, unit: 'kg' })
  })

  it('listet Umfaenge je Stelle mit Wert und Aenderung seit der ersten Messung', () => {
    const input = empty()
    input.measurements = [
      { measured_on: ago(40), site: 'waist', value_cm: 90 },
      { measured_on: ago(20), site: 'waist', value_cm: 88 },
      { measured_on: ago(5), site: 'waist', value_cm: 86.5 },
      { measured_on: ago(5), site: 'upper_arm', value_cm: 38 },
    ]
    expect(buildProfileSnapshot(input, NOW).measurements).toEqual({
      unit: 'cm',
      sites: [{ site: 'waist', v: 86.5, delta: -3.5 }, { site: 'upper_arm', v: 38 }],
    })
  })

  it('rechnet die Einnahmetreue ueber 90 Tage mit der App-Logik, ohne Substanznamen', () => {
    const input = empty()
    input.doseLogs = [
      { stack_item_id: 'secret-a', logged_at: stamp(1), taken: true },
      { stack_item_id: 'secret-a', logged_at: stamp(2), taken: true },
      { stack_item_id: 'secret-b', logged_at: stamp(3), taken: false },
      { stack_item_id: 'secret-b', logged_at: stamp(4), taken: null },
      { stack_item_id: 'secret-a', logged_at: stamp(120), taken: false },
    ]
    input.stackItemCount = 2
    input.activeCycleCount = 1
    const snap = buildProfileSnapshot(input, NOW)
    expect(snap.adherence).toEqual({ pct: 67, confirmed: 2, missed: 1, days: 90 })
    expect(snap.substances).toEqual({ count: 2, activeCycles: 1 })
    expect(JSON.stringify(snap)).not.toContain('secret')
  })

  it('zaehlt Blutmarker und wie viele im Bereich liegen, wie die Marker-Ansicht', () => {
    const input = empty()
    input.bloodwork = [
      blood('Testosteron', 650, 'ng/dL', ago(30), [300, 900]),
      blood('Testosteron', 1100, 'ng/dL', ago(3), [300, 900]),
      blood('Hämatokrit', 45, '%', ago(3), [40, 50]),
      blood('Mein Spezialwert', 3, 'x', ago(3)),
    ]
    const snap = buildProfileSnapshot(input, NOW)
    expect(snap.markers).toEqual({ count: 3 })
    // Testosteron (letzter Wert) zu hoch, Haematokrit im Bereich, Spezialwert ohne Bereich
    expect(snap.in_range).toEqual({ inRange: 1, of: 2 })
  })

  it('mittelt Gesundheitswerte ueber 7 Tage und vergleicht mit den ersten 7 Tagen', () => {
    const input = empty()
    input.healthDaily = [
      ...[40, 39, 38].map(n => health(ago(n), { steps: 6000, resting_hr: 62, bp_sys: 130, bp_dia: 85 })),
      ...[6, 3, 0].map(n => health(ago(n), { steps: 9000, resting_hr: 58, sleep_min: 450, spo2_pct: 97.26, bp_sys: 122, bp_dia: 80 })),
      health(ago(9), { active_kcal: 700 }),
    ]
    const snap = buildProfileSnapshot(input, NOW)
    expect(snap.steps).toEqual({ v: 9000, unit: 'steps', delta: 3000 })
    expect(snap.resting_hr).toEqual({ v: 58, unit: 'bpm', delta: -4 })
    // Schlaf und SpO2 nur in den letzten 7 Tagen: kein Start zum Vergleichen
    expect(snap.sleep).toEqual({ v: 450, unit: 'min' })
    expect(snap.spo2).toEqual({ v: 97.3, unit: '%' })
    // aktive kcal nur vor 9 Tagen: kein Wert in den letzten 7 Tagen
    expect(snap.active_kcal).toBeUndefined()
    expect(snap.blood_pressure).toEqual({ sys: 122, dia: 80, unit: 'mmHg', deltaSys: -8, deltaDia: -5 })
    expect(snap).not.toHaveProperty('hrv')
    expect(snap).not.toHaveProperty('vo2max')
  })

  it('zaehlt Workouts, mittelt pro Woche und nimmt die Top-3-e1RM mit Uebungsnamen', () => {
    const input = empty()
    input.customExercises = custom
    input.sessions = [
      session('s1', 1, [
        { exerciseId: 'bench_press', sets: [work(100, 5)] },
        { exerciseId: 'custom:c1', sets: [work(120, 10)] },
      ]),
      session('s2', 8, [{ exerciseId: 'squat', sets: [work(140, 3)] }]),
      session('s3', 15, [{ exerciseId: 'deadlift', sets: [work(180, 1)] }, { exerciseId: 'plank', sets: [{ type: 'normal', durationS: 60, done: true }] }]),
      session('s4', 20, [{ exerciseId: 'overhead_press', sets: [work(50, 8)] }]),
    ]
    input.routines = [{ id: 'r1', name: ' Push/Pull ', kind: 'strength', exercises: [], weekdays: [], sortOrder: 0, folder: null }]
    input.profile = { ...input.profile, routineId: 'r1', favoriteExercise: 'custom:c1' }
    const snap = buildProfileSnapshot(input, NOW)
    expect(snap.workouts).toEqual({ total: 4, perWeek: 1 })
    expect(snap.routine).toEqual({ name: 'Push/Pull' })
    expect(snap.favorite_exercise).toEqual({ id: 'custom:c1', name: 'Eigene Presse' })
    expect(snap.e1rm?.unit).toBe('kg')
    expect(snap.e1rm?.top).toHaveLength(3)
    expect(snap.e1rm?.top[0]).toMatchObject({ id: 'deadlift', v: 180 })
    expect(snap.e1rm?.top.map(t => t.id)).toEqual(['deadlift', 'custom:c1', 'squat'])
    expect(snap.e1rm?.top.every(t => t.name.length > 0)).toBe(true)
  })

  it('laesst Routine weg, wenn die gewaehlte nicht mehr existiert', () => {
    const input = empty()
    input.profile = { ...input.profile, routineId: 'weg' }
    expect(buildProfileSnapshot(input, NOW).routine).toBeUndefined()
  })

  it('fasst oeffentliche Erfahrungsberichte als Zahl und Schnitt zusammen', () => {
    const input = empty()
    input.reviewRatings = [5, 4, 4]
    expect(buildProfileSnapshot(input, NOW).reviews).toEqual({ count: 3, avgRating: 4.3 })
  })

  it('bleibt auch mit viel Verlauf deutlich unter 16 KB', () => {
    const input = full()
    for (let n = 0; n < 900; n++) {
      input.weightLogs.push({ logged_at: `${ago(n)}T12:00:00`, weight_kg: 80 + (n % 7) / 10 })
      input.dailyLogs.push(day(ago(n), { body_fat_pct: 15 + (n % 5) / 10, muscle_mass_kg: 38 }))
      input.healthDaily.push(health(ago(n), { steps: 8000 + n, resting_hr: 60, sleep_min: 420, active_kcal: 500, spo2_pct: 97, bp_sys: 120, bp_dia: 80 }))
      input.doseLogs.push({ stack_item_id: 'x', logged_at: stamp(n), taken: n % 3 !== 0 })
    }
    const size = new TextEncoder().encode(JSON.stringify(buildProfileSnapshot(input, NOW))).length
    expect(size).toBeLessThan(4096)
  })
})

describe('entryStreak und Eintragstage', () => {
  it('zaehlt Tage in Folge bis heute; ohne Eintrag heute ab gestern', () => {
    expect(entryStreak(new Set([TODAY, ago(1), ago(2), ago(4)]), TODAY)).toBe(3)
    expect(entryStreak(new Set([ago(1), ago(2)]), TODAY)).toBe(2)
    expect(entryStreak(new Set([ago(2)]), TODAY)).toBe(0)
    expect(entryStreak(new Set(), TODAY)).toBe(0)
  })

  it('haelt bei der Obergrenze an', () => {
    const days = new Set(Array.from({ length: 30 }, (_, n) => ago(n)))
    expect(entryStreak(days, TODAY, 10)).toBe(10)
  })

  it('zaehlt eigene Eintraege aller Art, aber kein Auto-Tracking', () => {
    const input = empty()
    input.doseLogs = [
      { stack_item_id: 'a', logged_at: stamp(0), taken: true, auto_logged: true },
      { stack_item_id: 'a', logged_at: stamp(1), taken: false },
    ]
    input.dailyLogs = [day(ago(2))]
    input.weightLogs = [{ logged_at: `${ago(3)}T12:00:00`, weight_kg: 80 }]
    input.measurements = [{ measured_on: ago(4), site: 'waist', value_cm: 80 }]
    input.sessions = [session('s', 5)]
    // heute nur Auto-Tracking → Serie ab gestern: 1..5
    expect(buildProfileSnapshot(input, NOW).streak).toEqual({ days: 5 })
  })
})

function full(): ProfileSnapshotInput {
  const input = empty()
  input.profile = { birthDate: '1990-01-01', heightCm: 180, weightKg: 80, favoriteExercise: 'squat', routineId: 'r1' }
  input.weightLogs = [{ logged_at: `${ago(1)}T12:00:00`, weight_kg: 80 }]
  input.dailyLogs = [day(ago(1), { body_fat_pct: 15, muscle_mass_kg: 38 })]
  input.measurements = [{ measured_on: ago(1), site: 'waist', value_cm: 80 }]
  input.doseLogs = [{ stack_item_id: 'secret', logged_at: stamp(1), taken: true }]
  input.stackItemCount = 3
  input.activeCycleCount = 1
  input.bloodwork = [blood('Testosteron', 600, 'ng/dL', ago(3), [300, 900])]
  input.healthDaily = [health(ago(1), { steps: 8000, resting_hr: 60, sleep_min: 420, active_kcal: 500, spo2_pct: 97, bp_sys: 120, bp_dia: 80 })]
  input.sessions = [session('s1', 1, [{ exerciseId: 'squat', sets: [work(100, 5)] }])]
  input.routines = [{ id: 'r1', name: 'Plan', kind: 'strength', exercises: [], weekdays: [], sortOrder: 0, folder: null } satisfies TrainingRoutine]
  input.reviewRatings = [4]
  return input
}
