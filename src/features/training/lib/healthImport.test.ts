import { describe, expect, it } from 'vitest'
import type { HealthWorkout } from '../../../lib/health'
import type { SessionKind, TrainingSession } from '../types'
import { dedupeAgainst, mapActivityType, mapHealthWorkout, overlapRatio } from './healthImport'

function workout(overrides: Partial<HealthWorkout> = {}): HealthWorkout {
  return {
    externalId: 'hk-1',
    activityType: 'Running',
    activityId: 37,
    startDate: new Date('2026-10-10T07:00:00Z'),
    endDate: new Date('2026-10-10T07:45:00Z'),
    durationS: 2700,
    distanceM: 8012.4,
    kcal: 512.6,
    avgHr: 151.4,
    source: 'Apple Watch',
    ...overrides,
  }
}

function session(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 's1',
    kind: 'strength',
    title: 'Push',
    startedAt: '2026-10-10T17:00:00.000Z',
    endedAt: '2026-10-10T18:00:00.000Z',
    durationS: 3600,
    distanceM: null,
    kcal: null,
    avgHr: null,
    rpe: 8,
    notes: null,
    routineId: null,
    exercises: [],
    source: 'live',
    externalId: null,
    ...overrides,
  }
}

const kindIOS = (activityType: string, activityId?: number) =>
  mapActivityType(workout({ activityType, activityId }), 'ios')
const kindAndroid = (activityType: string, activityId?: number) =>
  mapActivityType(workout({ activityType, activityId }), 'android')

describe('mapActivityType – HealthKit', () => {
  it.each<[string, SessionKind]>([
    ['Running', 'run'],
    ['Cycling', 'cycle'],
    ['Traditional Strength Training', 'strength'],
    ['Functional Strength Training', 'strength'],
    ['High Intensity Interval Training', 'hiit'],
    ['Yoga', 'yoga'],
    ['Swimming', 'swim'],
    ['Rowing', 'row'],
    ['Walking', 'walk'],
    ['Hiking', 'hike'],
    ['Soccer', 'sport'],
    ['Basketball', 'sport'],
    ['Tennis', 'sport'],
    ['Flexibility', 'mobility'],
    ['Elliptical', 'other'],
    ['Other', 'other'],
  ])('Plugin-Anzeigename %s → %s', (name, kind) => {
    expect(kindIOS(name)).toBe(kind)
  })

  it('versteht auch die HKWorkoutActivityType-Bezeichner in camelCase', () => {
    expect(kindIOS('traditionalStrengthTraining')).toBe('strength')
    expect(kindIOS('functionalStrengthTraining')).toBe('strength')
    expect(kindIOS('highIntensityIntervalTraining')).toBe('hiit')
    expect(kindIOS('americanFootball')).toBe('sport')
  })

  it('faellt bei "Other" auf die rawValue zurueck (Typen, die das Plugin nicht benennt)', () => {
    expect(kindIOS('Other', 79)).toBe('sport') // pickleball
    expect(kindIOS('Other', 80)).toBe('mobility') // cooldown
    expect(kindIOS('Other', 3000)).toBe('other')
  })
})

describe('mapActivityType – Health Connect', () => {
  it.each<[string, SessionKind]>([
    ['56', 'run'],
    ['57', 'run'],
    ['8', 'cycle'],
    ['70', 'strength'],
    ['81', 'strength'],
    ['36', 'hiit'],
    ['83', 'yoga'],
    ['74', 'swim'],
    ['54', 'row'],
    ['79', 'walk'],
    ['37', 'hike'],
    ['64', 'sport'],
    ['0', 'other'],
    ['9999', 'other'],
  ])('ExerciseType %s → %s', (type, kind) => {
    expect(kindAndroid(type)).toBe(kind)
  })

  it('versteht Namen und Konstanten', () => {
    expect(kindAndroid('strength_training')).toBe('strength')
    expect(kindAndroid('EXERCISE_TYPE_RUNNING')).toBe('run')
    expect(kindAndroid('swimming_open_water')).toBe('swim')
    expect(kindAndroid('', 64)).toBe('sport')
    expect(kindAndroid('surprise')).toBe('other')
  })
})

describe('mapHealthWorkout', () => {
  it('uebernimmt Zeiten und Messwerte, Titel bleibt leer', () => {
    expect(mapHealthWorkout(workout(), 'ios')).toEqual({
      kind: 'run',
      title: '',
      startedAt: '2026-10-10T07:00:00.000Z',
      endedAt: '2026-10-10T07:45:00.000Z',
      durationS: 2700,
      distanceM: 8012,
      kcal: 513,
      avgHr: 151,
      rpe: null,
      notes: null,
      routineId: null,
      exercises: [],
      source: 'healthkit',
      externalId: 'hk-1',
    })
  })

  it('setzt die Quelle je Plattform', () => {
    expect(mapHealthWorkout(workout({ activityType: '56' }), 'android')).toMatchObject({
      kind: 'run',
      source: 'health_connect',
    })
  })

  it('macht aus fehlenden oder unplausiblen Werten null und rechnet die Dauer aus den Zeiten', () => {
    const mapped = mapHealthWorkout(workout({ durationS: 0, distanceM: -1, kcal: 0, avgHr: null }), 'ios')
    expect(mapped.durationS).toBe(2700)
    expect(mapped.distanceM).toBeNull()
    expect(mapped.kcal).toBeNull()
    expect(mapped.avgHr).toBeNull()
  })
})

describe('overlapRatio', () => {
  it('bezieht sich auf die laengere Einheit', () => {
    const outer = { start: 0, end: 90 }
    const inner = { start: 10, end: 15 }
    expect(overlapRatio(outer, inner)).toBeCloseTo(5 / 90)
    expect(overlapRatio({ start: 0, end: 60 }, { start: 0, end: 70 })).toBeCloseTo(60 / 70)
    expect(overlapRatio({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(0)
  })
})

describe('dedupeAgainst', () => {
  const imported = (overrides: Partial<HealthWorkout> = {}, platform: 'ios' | 'android' = 'ios') =>
    mapHealthWorkout(workout(overrides), platform)

  const watchStrength = imported({
    externalId: 'hk-strength',
    activityType: 'Traditional Strength Training',
    startDate: new Date('2026-10-10T17:02:00Z'),
    endDate: new Date('2026-10-10T18:05:00Z'),
    durationS: 3780,
    kcal: 420,
    avgHr: 128,
  })

  it('legt neue Workouts an', () => {
    const result = dedupeAgainst([], [imported()])
    expect(result.create).toHaveLength(1)
    expect(result.enrich).toEqual([])
    expect(result.skipped).toBe(0)
  })

  it('verwirft bereits importierte (gleiche externalId) und Doppel im selben Stapel', () => {
    const existing = [session({ id: 'old', kind: 'run', source: 'healthkit', externalId: 'hk-1' })]
    const result = dedupeAgainst(existing, [imported(), imported({ externalId: 'hk-2' }), imported({ externalId: 'hk-2' })])
    expect(result.create.map(s => s.externalId)).toEqual(['hk-2'])
    expect(result.skipped).toBe(2)
  })

  it('ergaenzt eine live erfasste Einheit gleicher Art statt sie zu verdoppeln', () => {
    const result = dedupeAgainst([session()], [watchStrength])
    expect(result.create).toEqual([])
    expect(result.enrich).toEqual([{ id: 's1', kcal: 420, avgHr: 128 }])
    expect(result.skipped).toBe(1)
  })

  it('ueberschreibt keine Werte, die der Nutzer selbst eingetragen hat', () => {
    const result = dedupeAgainst([session({ source: 'manual', kcal: 300 })], [watchStrength])
    expect(result.enrich).toEqual([{ id: 's1', kcal: null, avgHr: 128 }])
  })

  it('meldet keine Anreicherung, wenn nichts fehlt', () => {
    const result = dedupeAgainst([session({ kcal: 300, avgHr: 120 })], [watchStrength])
    expect(result.create).toEqual([])
    expect(result.enrich).toEqual([])
  })

  it('legt an, wenn die Art abweicht', () => {
    const run = imported({ startDate: new Date('2026-10-10T17:00:00Z'), endDate: new Date('2026-10-10T18:00:00Z') })
    const result = dedupeAgainst([session()], [run])
    expect(result.create).toHaveLength(1)
    expect(result.enrich).toEqual([])
  })

  it('legt an bei hoechstens 50 % Ueberlappung', () => {
    const halfOverlap = imported({
      activityType: 'Traditional Strength Training',
      startDate: new Date('2026-10-10T17:30:00Z'),
      endDate: new Date('2026-10-10T18:30:00Z'),
    })
    expect(dedupeAgainst([session()], [halfOverlap]).create).toHaveLength(1)
  })

  it('beachtet nur manuell oder live erfasste Einheiten fuer die Ueberlappung', () => {
    const otherImport = session({ source: 'health_connect', externalId: 'hc-9' })
    expect(dedupeAgainst([otherImport], [watchStrength]).create).toHaveLength(1)
  })

  it('nimmt die Dauer, wenn endedAt fehlt', () => {
    const result = dedupeAgainst([session({ endedAt: null, durationS: 3600 })], [watchStrength])
    expect(result.enrich).toEqual([{ id: 's1', kcal: 420, avgHr: 128 }])
  })

  it('reichert jede Einheit nur einmal an, auch wenn die Uhr sie in zwei Teilen hat', () => {
    const second = { ...watchStrength, externalId: 'hk-strength-2', kcal: 999, avgHr: 99 }
    const result = dedupeAgainst([session()], [watchStrength, second])
    expect(result.enrich).toEqual([{ id: 's1', kcal: 420, avgHr: 128 }])
    expect(result.skipped).toBe(2)
  })
})
