import { describe, expect, it } from 'vitest'
import type { MuscleInfo } from './stats'
import { routineSetsPerMuscle, sortedMuscles, weeklySetsPerMuscle } from './muscleVolume'

const MUSCLES: Record<string, MuscleInfo> = {
  bench: { primary: ['chest'], secondary: ['triceps', 'front_delts'] },
  curl: { primary: ['biceps'], secondary: [] },
}
const muscleOf = (id: string) => MUSCLES[id] ?? null

const sets = (count: number) => Array.from({ length: count }, () => ({ type: 'normal' as const }))

describe('routineSetsPerMuscle', () => {
  it('zaehlt Hauptmuskel voll, Hilfsmuskel halb und laesst Aufwaermsaetze weg', () => {
    const result = routineSetsPerMuscle([
      { exerciseId: 'bench', sets: [{ type: 'warmup' }, ...sets(3)] },
      { exerciseId: 'curl', sets: sets(2) },
      { exerciseId: 'unknown', sets: sets(5) },
    ], muscleOf)
    expect(result.get('chest')).toBe(3)
    expect(result.get('triceps')).toBe(1.5)
    expect(result.get('front_delts')).toBe(1.5)
    expect(result.get('biceps')).toBe(2)
    expect(result.size).toBe(4)
  })
})

describe('weeklySetsPerMuscle', () => {
  it('multipliziert mit den Wochentagen; ohne Wochentage zaehlt die Routine einmal', () => {
    const result = weeklySetsPerMuscle([
      { exercises: [{ exerciseId: 'bench', sets: sets(3) }], weekdays: [1, 4] },
      { exercises: [{ exerciseId: 'bench', sets: sets(2) }, { exerciseId: 'curl', sets: sets(3) }], weekdays: [] },
    ], muscleOf)
    expect(result.get('chest')).toBe(8)
    expect(result.get('triceps')).toBe(4)
    expect(result.get('biceps')).toBe(3)
  })
})

describe('sortedMuscles', () => {
  it('sortiert absteigend, kuerzt und laesst Nullen weg', () => {
    const rows = sortedMuscles(new Map([['chest', 3], ['biceps', 5], ['abs', 0], ['quads', 5]]), 2)
    expect(rows).toEqual([{ muscle: 'biceps', sets: 5 }, { muscle: 'quads', sets: 5 }])
  })
})
