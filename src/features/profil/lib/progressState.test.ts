import { describe, expect, it } from 'vitest'
import type { BloodworkEntry } from '../../blutwerte/types'
import type { HealthDailyRow } from '../../wearables/lib/healthDaily'
import type { TrainingSession, TrainingSet } from '../../training/types'
import type { ProfileSnapshotInput } from './profileSnapshot'
import { badgeFacts, type BadgeExtras } from './badgeFacts'
import { bloodReports, implicitStart, progressSeries, progressSetup } from './progressInput'
import { computeProgressState, mergedHistory, type ProgressData } from './progressState'
import { EMPTY_PROGRESS_SETTINGS } from './progressSettings'
import { addDays } from './progressScore'

const TODAY = '2026-11-02'

const empty = (): ProfileSnapshotInput => ({
  lang: 'de',
  profile: { birthDate: null, heightCm: null, weightKg: null, favoriteExercise: null, routineId: null },
  bio: { birthDate: null, sex: null },
  weightLogs: [], dailyLogs: [], measurements: [], doseLogs: [], stackItemCount: 0, activeCycleCount: 0,
  bloodwork: [], healthDaily: [], sessions: [], routines: [], customExercises: [], reviewRatings: [],
})

const extras = (x: Partial<BadgeExtras> = {}): BadgeExtras => ({
  cycleEndDays: [], photoDays: [], reviewDays: [], healthConsentAt: null, profileChecks: [true, false], ...x,
})

const health = (day: string, v: Partial<HealthDailyRow>): HealthDailyRow => ({
  day, steps: null, resting_hr: null, sleep_min: null, active_kcal: null, spo2_pct: null, resp_rate: null, bp_sys: null, bp_dia: null, ...v,
})

const blood = (marker: string, value: number, tested_at: string, ref: [number, number]): BloodworkEntry => ({
  id: `${marker}-${tested_at}`, user_id: 'u', tested_at, marker, value, unit: 'mg/dl', notes: null, created_at: null,
  report_id: null, ref_min: ref[0], ref_max: ref[1],
})

const work = (weightKg: number, reps: number): TrainingSet => ({ type: 'normal', weightKg, reps, done: true })
const session = (id: string, day: string, kg: number): TrainingSession => ({
  id, kind: 'strength', title: id, startedAt: `${day}T10:00:00`, endedAt: null, durationS: 3600, distanceM: null,
  kcal: null, avgHr: null, rpe: null, notes: null, routineId: null, source: 'manual', externalId: null,
  exercises: [{ exerciseId: 'deadlift', sets: [work(kg, 1)] }],
})

const data = (input: ProfileSnapshotInput, x: Partial<ProgressData> = {}): ProgressData =>
  ({ input, extras: extras(), settings: { ...EMPTY_PROGRESS_SETTINGS }, goals: ['fettabbau'], ...x })

describe('Eingabe aus den eigenen Daten', () => {
  it('Blutbefund = Werte eines Tages; Anteil der beurteilbaren Marker im Bereich', () => {
    const input = { ...empty(), bloodwork: [
      blood('Testosteron', 500, '2026-03-01', [300, 900]), blood('Glukose', 130, '2026-03-01', [70, 99]),
      blood('Glukose', 90, '2026-06-20', [70, 99]),
    ] }
    expect(bloodReports(input)).toEqual([{ day: '2026-03-01', inRange: 1, of: 2 }, { day: '2026-06-20', inRange: 1, of: 1 }])
  })

  it('Einnahmen und Gewicht nach lokalem Kalendertag (wie Einnahmetreue und Serie), nicht nach UTC', () => {
    // 23:30 Uhr UTC am 14.03. ist in Berlin (TZ der Tests) schon der 15.03.
    const dose = (logged_at: string, taken: boolean) => ({ id: logged_at, stack_item_id: 's1', logged_at, taken, auto_logged: false })
    const input = {
      ...empty(),
      doseLogs: [dose('2026-03-14T23:30:00Z', true), dose('2026-03-15T08:00:00Z', false)],
      weightLogs: [{ id: '1', logged_at: '2026-03-14T23:30:00Z', weight_kg: 80 }],
    }
    expect(progressSeries(input).doseDays).toEqual([{ day: '2026-03-15', taken: 1, due: 2 }])
    expect(progressSeries(input).weight).toEqual([{ day: '2026-03-15', value: 80 }])
    const facts = badgeFacts(input, extras(), null, null, [], TODAY)
    expect(facts.intakeDays).toEqual([{ day: '2026-03-15', all: false }])
    expect(facts.weightDays).toEqual(['2026-03-15'])
  })

  it('ohne gesetzten Start: erste Messung; Wearables beginnen bei ihrem eigenen ersten Tag', () => {
    const input = {
      ...empty(),
      weightLogs: [{ id: '1', logged_at: '2026-03-14T08:00:00Z', weight_kg: 120 }, { id: '2', logged_at: '2026-10-20T08:00:00Z', weight_kg: 100 }],
      // Schritte erst ab Mai: das Fenster der ersten 28 Tage beginnt dort, nicht am 14.03.
      healthDaily: Array.from({ length: 120 }, (_, i) => health(addDays('2026-05-01', i), { steps: i < 28 ? 5000 : 7500 })),
    }
    expect(implicitStart(progressSeries(input), input, TODAY)).toBe('2026-03-14')
    const state = computeProgressState(data(input), TODAY)
    expect(state.setup).toMatchObject({ startOn: '2026-03-14', implicit: true })
    const weight = state.result!.values.find(v => v.id === 'weight')!
    expect(weight.change).toBeCloseTo(16.667, 2)
    const steps = state.result!.values.find(v => v.id === 'steps')!
    expect(steps).toMatchObject({ start: 5000, baseline: { status: 'counts' } })
    expect(state.snapshot).toMatchObject({ since: '2026-03-14', areas: { koerper: 16.7 } })
  })

  it('ohne Daten keine Rechnung, aber Abzeichen-Stand', () => {
    const state = computeProgressState(data(empty()), TODAY)
    expect(state.setup).toBeNull()
    expect(state.snapshot).toBeUndefined()
    expect(state.badges.states).toHaveLength(81)
  })

  it('gesetzter Start und Richtung des Nutzers rechnen; Bestleistung und Workouts werden Abzeichen', () => {
    const sessions = [session('a', '2026-09-01', 120), session('b', '2026-09-15', 130), session('c', '2026-10-20', 142)]
    const input = { ...empty(), sessions }
    const setup = progressSetup(input, { ...EMPTY_PROGRESS_SETTINGS, startOn: '2026-08-01' }, [], TODAY)!
    expect(setup.input.e1rm).toEqual([{ exerciseId: 'deadlift', points: [
      { day: '2026-09-01', value: 120 }, { day: '2026-09-15', value: 130 }, { day: '2026-10-20', value: 142 },
    ] }])
    const state = computeProgressState(data(input, { settings: { ...EMPTY_PROGRESS_SETTINGS, startOn: '2026-08-01', directions: { 'e1rm:deadlift': 'down' } } }), TODAY)
    expect(state.result!.values.find(v => v.id === 'e1rm:deadlift')!.change).toBeCloseTo(-18.333, 2)
    expect(state.badges.earned.first_pr).toBe('2026-09-15')
    expect(state.badgeIds[0]).toBe('first_pr')
  })

  it('Wochenreihe: fruehere Starts bleiben stehen, ab dem Start wird ersetzt', () => {
    const input = { ...empty(), weightLogs: [{ id: '1', logged_at: '2026-10-01T08:00:00Z', weight_kg: 100 }] }
    const state = computeProgressState(data(input), TODAY)
    const merged = mergedHistory([{ week: '2026-01-05', total: 3, areas: {} }, { week: '2026-10-05', total: 99, areas: {} }], state)
    expect(merged[0]).toEqual({ week: '2026-01-05', total: 3, areas: {} })
    expect(merged.find(e => e.week === '2026-10-05')?.total).toBeNull()
  })
})

describe('Titel-Fakten aus den eigenen Daten', () => {
  const ein = (id: string, day: string, kind: TrainingSession['kind'], source: TrainingSession['source'], externalId: string | null = null) =>
    ({ ...session(id, day, 100), kind, source, externalId })

  it('Rang zählt nur eigene Einträge; eingeführte Einheiten zählen für Sportarten, doppelte einmal', () => {
    const input = {
      ...empty(),
      sessions: [
        ein('a', '2026-10-01', 'run', 'manual'),
        ein('b', '2026-10-02', 'run', 'healthkit', 'hk-1'),
        ein('c', '2026-10-02', 'run', 'healthkit', 'hk-1'), // zweimal eingeführt
        ein('d', '2026-10-03', 'cycle', 'health_connect', 'hc-1'),
        ein('e', '2026-10-04', 'strength', 'import_hevy', 'hevy-1'),
      ],
      dailyLogs: [{ log_date: '2026-10-05' } as never],
    }
    const f = badgeFacts(input, extras(), null, null, [], TODAY)
    expect(f.ownEntryDays).toEqual(['2026-10-01', '2026-10-04', '2026-10-05'])
    expect(f.entryStamps).toEqual(['2026-10-01', '2026-10-04', '2026-10-05'])
    expect(f.sessionsByKind).toEqual({ run: ['2026-10-01', '2026-10-02'], cycle: ['2026-10-03'], strength: ['2026-10-04'] })
    // die Serie aus 2b bleibt, wie sie war (zählt alle Einheiten)
    expect(f.entryDays).toContain('2026-10-02')
  })

  it('Tage mit Eintrag nie unter der Schwelle des schon verdienten Rangs (Einnahmen nur 366 Tage geladen)', () => {
    const state = computeProgressState(data(empty(), { settings: { ...EMPTY_PROGRESS_SETTINGS, earnedBadges: { rank_4: '2026-01-01' } } }), TODAY)
    expect(state.entryDays).toBe(100)
    expect(computeProgressState(data(empty()), TODAY).entryDays).toBe(0)
  })

  it('Schlafnächte aus healthDaily, nur mit Minuten > 0, bis heute', () => {
    const input = { ...empty(), healthDaily: [
      health('2026-10-01', { sleep_min: 450 }), health('2026-10-02', { sleep_min: 0 }),
      health('2026-10-03', { sleep_min: null }), health(addDays(TODAY, 1), { sleep_min: 400 }),
    ] }
    expect(badgeFacts(input, extras(), null, null, [], TODAY).sleepNights).toEqual([{ day: '2026-10-01', min: 450 }])
  })
})

