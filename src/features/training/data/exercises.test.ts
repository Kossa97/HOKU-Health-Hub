import { describe, expect, it } from 'vitest'
import type { Equipment, ExerciseCategory, MuscleGroup, TrackingMode } from '../types'
import { SESSION_KINDS } from '../types'
import { EXERCISE_CATALOG } from './exercises'
import { HYROX_DIVISIONS, HYROX_RUN_ID, HYROX_STATION_ORDER, hyroxRoutine } from './hyrox'
import type { HyroxDivisionId } from './hyrox'
import { MET_BY_KIND, metForIntensity } from './met'

// Die Union-Typen existieren nur zur Compile-Zeit; die Listen hier muessen sie
// vollstaendig abbilden (`satisfies` meldet Tippfehler, der Typtest unten Luecken).
const CATEGORIES = ['strength', 'cardio', 'hyrox', 'mobility', 'plyometric'] as const satisfies readonly ExerciseCategory[]
const EQUIPMENT = [
  'barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'band', 'smith', 'ez_bar',
  'trap_bar', 'cardio_machine', 'sled', 'medicine_ball', 'other',
] as const satisfies readonly Equipment[]
const TRACKING = [
  'weight_reps', 'bodyweight_reps', 'assisted_reps', 'reps', 'duration', 'weight_duration',
  'distance_duration', 'weight_distance',
] as const satisfies readonly TrackingMode[]
const MUSCLES = [
  'chest', 'upper_back', 'lats', 'lower_back', 'traps', 'front_delts', 'side_delts', 'rear_delts',
  'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'glutes', 'quads', 'hamstrings', 'adductors',
  'abductors', 'calves', 'cardio', 'full_body',
] as const satisfies readonly MuscleGroup[]

// Compile-Zeit-Pruefung: jede Union-Variante steht in der Liste.
type Missing<U, L extends readonly unknown[]> = Exclude<U, L[number]>
const allListed: [
  Missing<ExerciseCategory, typeof CATEGORIES>,
  Missing<Equipment, typeof EQUIPMENT>,
  Missing<TrackingMode, typeof TRACKING>,
  Missing<MuscleGroup, typeof MUSCLES>,
] extends [never, never, never, never] ? true : false = true

const norm = (s: string) => s.trim().toLowerCase()

describe('EXERCISE_CATALOG', () => {
  it('lists every union member in the test enums', () => {
    expect(allListed).toBe(true)
  })

  it('has a catalog size in the planned range', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(200)
    expect(EXERCISE_CATALOG.length).toBeLessThanOrEqual(240)
  })

  it('uses unique snake_case ids', () => {
    const ids = EXERCISE_CATALOG.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id, id).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/)
  })

  it('has valid enum fields and muscle lists', () => {
    for (const e of EXERCISE_CATALOG) {
      expect(CATEGORIES, e.id).toContain(e.category)
      expect(EQUIPMENT, e.id).toContain(e.equipment)
      expect(TRACKING, e.id).toContain(e.tracking)
      expect(e.primary.length, `${e.id} primary`).toBeGreaterThan(0)
      for (const m of [...e.primary, ...e.secondary]) expect(MUSCLES, e.id).toContain(m)
      const all = [...e.primary, ...e.secondary]
      expect(new Set(all).size, `${e.id}: muscle listed twice or in primary and secondary`).toBe(all.length)
    }
  })

  it('has non-empty, trimmed de and en names', () => {
    for (const e of EXERCISE_CATALOG) {
      for (const name of [e.name.de, e.name.en]) {
        expect(name.trim().length, e.id).toBeGreaterThan(0)
        expect(name, e.id).toBe(name.trim())
      }
    }
  })

  it('has non-empty aliases when present', () => {
    for (const e of EXERCISE_CATALOG) {
      if (e.aliases === undefined) continue
      expect(e.aliases.length, e.id).toBeGreaterThan(0)
      for (const a of e.aliases) {
        expect(a.trim().length, e.id).toBeGreaterThan(0)
        expect(a, e.id).toBe(a.trim())
      }
    }
  })

  it('never maps a name or alias to two different exercises (case-insensitive)', () => {
    const owner = new Map<string, string>()
    const clashes: string[] = []
    for (const e of EXERCISE_CATALOG) {
      for (const key of new Set([e.name.de, e.name.en, ...(e.aliases ?? [])].map(norm))) {
        const prev = owner.get(key)
        if (prev && prev !== e.id) clashes.push(`"${key}": ${prev} / ${e.id}`)
        else owner.set(key, e.id)
      }
    }
    expect(clashes).toEqual([])
  })

  it('finds common Hevy and Strong export names', () => {
    const lookup = new Map<string, string>()
    for (const e of EXERCISE_CATALOG) {
      for (const key of [e.name.de, e.name.en, ...(e.aliases ?? [])]) lookup.set(norm(key), e.id)
    }
    const expected: Record<string, string> = {
      'Bench Press (Barbell)': 'bench_press_barbell',
      'Squat (Barbell)': 'squat_barbell',
      'Deadlift (Barbell)': 'deadlift_barbell',
      'Pull Up': 'pull_up',
      'Lat Pulldown (Cable)': 'lat_pulldown_cable',
      'Running': 'running',
      'Rowing (Machine)': 'rowing_machine',
      'Rowing Machine': 'rowing_machine',
      'Seated Row (Cable)': 'seated_cable_row',
      'Cycling (Indoor)': 'stationary_bike',
      'Triceps Pushdown (Cable - Straight Bar)': 'triceps_pushdown',
      'Romanian Deadlift (Barbell)': 'romanian_deadlift_barbell',
      'Overhead Press (Barbell)': 'overhead_press_barbell',
      'Hip Thrust (Barbell)': 'hip_thrust_barbell',
    }
    for (const [name, id] of Object.entries(expected)) expect(lookup.get(norm(name)), name).toBe(id)
  })

  it('gives every Hyrox station a fitting tracking mode', () => {
    const byId = new Map(EXERCISE_CATALOG.map((e) => [e.id, e]))
    const expected: Record<string, TrackingMode> = {
      hyrox_run_1km: 'distance_duration',
      hyrox_skierg: 'distance_duration',
      hyrox_sled_push: 'weight_distance',
      hyrox_sled_pull: 'weight_distance',
      hyrox_burpee_broad_jumps: 'distance_duration',
      hyrox_rowing: 'distance_duration',
      hyrox_farmers_carry: 'weight_distance',
      hyrox_sandbag_lunges: 'weight_distance',
      hyrox_wall_balls: 'weight_reps',
    }
    for (const [id, tracking] of Object.entries(expected)) {
      expect(byId.get(id)?.tracking, id).toBe(tracking)
      expect(byId.get(id)?.category, id).toBe('hyrox')
    }
  })
})

describe('hyroxRoutine', () => {
  const divisions = Object.keys(HYROX_DIVISIONS) as HyroxDivisionId[]

  it('alternates 8 runs with the 8 stations in official order', () => {
    const routine = hyroxRoutine('men_open')
    expect(routine).toHaveLength(16)
    expect(routine.map((r) => r.exerciseId)).toEqual([
      'hyrox_run_1km', 'hyrox_skierg',
      'hyrox_run_1km', 'hyrox_sled_push',
      'hyrox_run_1km', 'hyrox_sled_pull',
      'hyrox_run_1km', 'hyrox_burpee_broad_jumps',
      'hyrox_run_1km', 'hyrox_rowing',
      'hyrox_run_1km', 'hyrox_farmers_carry',
      'hyrox_run_1km', 'hyrox_sandbag_lunges',
      'hyrox_run_1km', 'hyrox_wall_balls',
    ])
  })

  it('only references catalog exercises', () => {
    const ids = new Set(EXERCISE_CATALOG.map((e) => e.id))
    expect(ids.has(HYROX_RUN_ID)).toBe(true)
    for (const s of HYROX_STATION_ORDER) expect(ids.has(s), s).toBe(true)
  })

  it('prefills distances, reps and division weights', () => {
    for (const id of divisions) {
      const d = HYROX_DIVISIONS[id]
      const set = (exerciseId: string) => hyroxRoutine(id).find((r) => r.exerciseId === exerciseId)!.sets[0]
      expect(hyroxRoutine(id).filter((r) => r.exerciseId === HYROX_RUN_ID).every((r) => r.sets[0].distanceM === 1000)).toBe(true)
      expect(set('hyrox_skierg')).toMatchObject({ distanceM: 1000 })
      expect(set('hyrox_sled_push')).toMatchObject({ distanceM: 50, weightKg: d.sledPushKg })
      expect(set('hyrox_sled_pull')).toMatchObject({ distanceM: 50, weightKg: d.sledPullKg })
      expect(set('hyrox_burpee_broad_jumps')).toMatchObject({ distanceM: 80 })
      expect(set('hyrox_rowing')).toMatchObject({ distanceM: 1000 })
      expect(set('hyrox_farmers_carry')).toMatchObject({ distanceM: 200, weightKg: d.farmersCarryKg })
      expect(set('hyrox_sandbag_lunges')).toMatchObject({ distanceM: 100, weightKg: d.sandbagKg })
      expect(set('hyrox_wall_balls')).toMatchObject({ reps: 100, weightKg: d.wallBallKg })
    }
  })

  it('uses the official weights', () => {
    expect(HYROX_DIVISIONS.women_open).toMatchObject({ sledPushKg: 102, sledPullKg: 78, farmersCarryKg: 16, sandbagKg: 10, wallBallKg: 4, wallBallTargetM: 2.7 })
    expect(HYROX_DIVISIONS.men_open).toMatchObject({ sledPushKg: 152, sledPullKg: 103, farmersCarryKg: 24, sandbagKg: 20, wallBallKg: 6, wallBallTargetM: 3 })
    expect(HYROX_DIVISIONS.women_pro).toMatchObject({ sledPushKg: 152, sledPullKg: 103, farmersCarryKg: 24, sandbagKg: 20, wallBallKg: 6, wallBallTargetM: 2.7 })
    expect(HYROX_DIVISIONS.men_pro).toMatchObject({ sledPushKg: 202, sledPullKg: 153, farmersCarryKg: 32, sandbagKg: 30, wallBallKg: 9, wallBallTargetM: 3 })
    expect({ ...HYROX_DIVISIONS.women_doubles, id: 'x', name: null }).toEqual({ ...HYROX_DIVISIONS.women_open, id: 'x', name: null })
    expect({ ...HYROX_DIVISIONS.men_doubles, id: 'x', name: null }).toEqual({ ...HYROX_DIVISIONS.men_open, id: 'x', name: null })
  })
})

describe('MET', () => {
  it('has a positive moderate value for every session kind', () => {
    for (const kind of SESSION_KINDS) expect(MET_BY_KIND[kind], kind).toBeGreaterThan(0)
  })

  it('scales with RPE: light <= moderate <= hard, null = moderate', () => {
    for (const kind of SESSION_KINDS) {
      const light = metForIntensity(kind, 3)
      const moderate = metForIntensity(kind, 6)
      const hard = metForIntensity(kind, 9)
      expect(light, kind).toBeLessThan(moderate)
      expect(moderate, kind).toBeLessThan(hard)
      expect(metForIntensity(kind, null), kind).toBe(MET_BY_KIND[kind])
      expect(moderate, kind).toBe(MET_BY_KIND[kind])
    }
  })
})
