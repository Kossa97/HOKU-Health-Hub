import { describe, expect, it } from 'vitest'
import type { RoutineExercise } from '../types'
import { cloneExercise, duplicateSelected, isRoutineExercise, pickSelected, withoutSelected } from './exerciseSelection'

const ex = (id: string, extra: Partial<RoutineExercise> = {}): RoutineExercise => ({
  exerciseId: id, restS: 90, sets: [{ type: 'normal', weightKg: 80, repsMin: 8, repsMax: 10 }], ...extra,
})

describe('Mehrfachauswahl', () => {
  const list = [ex('a', { supersetGroup: 1 }), ex('b', { supersetGroup: 1 }), ex('c', { notes: 'eng greifen' })]

  it('Kopien behalten alle Werte, aber keine Supersatz-Gruppe', () => {
    const copy = cloneExercise(list[0])
    expect(copy).toEqual({ exerciseId: 'a', restS: 90, sets: [{ type: 'normal', weightKg: 80, repsMin: 8, repsMax: 10 }] })
    copy.sets[0].weightKg = 100
    expect(list[0].sets[0].weightKg).toBe(80)
  })

  it('nimmt die markierten in Listenreihenfolge', () => {
    expect(pickSelected(list, [2, 0]).map(e => e.exerciseId)).toEqual(['a', 'c'])
    expect(pickSelected(list, [2])[0].notes).toBe('eng greifen')
    expect(withoutSelected(list, [0, 2]).map(e => e.exerciseId)).toEqual(['b'])
  })

  it('dupliziert dahinter, bei Supersaetzen hinter dem ganzen Supersatz', () => {
    const next = duplicateSelected(list, [0, 2])
    expect(next.map(e => e.exerciseId)).toEqual(['a', 'b', 'a', 'c', 'c'])
    expect(next.map(e => e.supersetGroup)).toEqual([1, 1, undefined, undefined, undefined])
    expect(duplicateSelected([ex('x'), ex('y')], [0]).map(e => e.exerciseId)).toEqual(['x', 'x', 'y'])
  })

  it('prueft Ablage-Eintraege', () => {
    expect(isRoutineExercise(list[0])).toBe(true)
    expect(isRoutineExercise({ exerciseId: 'x' })).toBe(false)
    expect(isRoutineExercise({ exerciseId: 'x', sets: [{}] })).toBe(false)
    expect(isRoutineExercise(null)).toBe(false)
  })
})
