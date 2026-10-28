import { describe, expect, it } from 'vitest'
import type { TrainingRoutine, TrainingSession } from '../types'
import { countSets, finishWorkout, nextOpenSet, reduceWorkout, startWorkout, supersetPartnerIndex, workoutFromSession } from './activeWorkout'
import type { Suggestion } from './progression'

const history: TrainingSession[] = [{
  id: 'old', kind: 'strength', title: 'Push', startedAt: '2026-10-10T10:00:00Z', endedAt: '2026-10-10T11:00:00Z',
  durationS: 3600, distanceM: null, kcal: 400, avgHr: null, rpe: 7, notes: null, routineId: 'r1',
  exercises: [{ exerciseId: 'bench', sets: [
    { type: 'warmup', weightKg: 40, reps: 10, done: true },
    { type: 'normal', weightKg: 80, reps: 6, done: true },
  ] }],
  source: 'live', externalId: null,
}]

const routine: TrainingRoutine = {
  id: 'r1', name: 'Push', kind: 'strength', weekdays: [1], sortOrder: 0, folder: null,
  exercises: [
    { exerciseId: 'bench', restS: 120, sets: [{ type: 'warmup' }, { type: 'normal' }, { type: 'normal' }] },
    { exerciseId: 'fly', sets: [{ type: 'normal', weightKg: 12, reps: 12 }] },
  ],
}

const now = new Date('2026-10-18T10:00:00Z')

describe('startWorkout', () => {
  it('fuellt Saetze mit den Werten vom letzten Mal, sonst mit der Vorgabe der Routine', () => {
    const w = startWorkout({ routine, history, now })
    expect(w.title).toBe('Push')
    expect(w.exercises[0].sets.map(s => [s.type, s.weightKg, s.reps, s.done])).toEqual([
      ['warmup', 40, 10, false],
      ['normal', 80, 6, false],
      ['normal', 80, 6, false],
    ])
    expect(w.exercises[1].sets[0]).toMatchObject({ weightKg: 12, reps: 12, done: false })
  })
})

describe('reduceWorkout', () => {
  it('startet nach einem abgehakten Satz die Pause der Uebung', () => {
    let w = startWorkout({ routine, history, now })
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 1, defaultRestS: 90, now: 1000 })
    expect(w.exercises[0].sets[1].done).toBe(true)
    expect(w.restEndsAt).toBe(1000 + 120_000)
    w = reduceWorkout(w, { type: 'rest_adjust', deltaS: 15, now: 2000 })
    expect(w.restEndsAt).toBe(1000 + 135_000)
    w = reduceWorkout(w, { type: 'rest_skip' })
    expect(w.restEndsAt).toBeNull()
  })

  it('startet im Supersatz die Pause erst nach der letzten Uebung der Runde', () => {
    let w = startWorkout({ routine, history, now })
    w = reduceWorkout(w, { type: 'toggle_superset', index: 0 })
    expect(w.exercises.map(e => e.supersetGroup)).toEqual([1, 1])
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 1, defaultRestS: 90, now: 0 })
    expect(w.restEndsAt).toBeNull()
    w = reduceWorkout(w, { type: 'toggle_done', index: 1, setIndex: 0, defaultRestS: 90, now: 0 })
    expect(w.restEndsAt).toBe(90_000)
    // Aufloesen und Entfernen lassen keinen Supersatz mit nur einer Uebung zurueck
    w = reduceWorkout(w, { type: 'remove_exercise', index: 1 })
    expect(w.exercises[0].supersetGroup).toBeNull()
  })

  it('loest beim Verknuepfen zweier Supersaetze den zurueckgebliebenen Rest auf', () => {
    let w = startWorkout({ history, now })
    w = reduceWorkout(w, { type: 'add_exercises', exerciseIds: ['a', 'b', 'c', 'd'], history })
    w = reduceWorkout(w, { type: 'toggle_superset', index: 0 })
    w = reduceWorkout(w, { type: 'toggle_superset', index: 2 })
    expect(w.exercises.map(e => e.supersetGroup)).toEqual([1, 1, 2, 2])
    // b mit c verknuepfen: c wechselt zu Gruppe 1, d bliebe allein in Gruppe 2.
    w = reduceWorkout(w, { type: 'toggle_superset', index: 1 })
    expect(w.exercises.map(e => e.supersetGroup)).toEqual([1, 1, 1, null])
  })

  it('wechselt die Satzart reihum und uebernimmt Werte in neue Saetze', () => {
    let w = startWorkout({ routine, history, now })
    w = reduceWorkout(w, { type: 'cycle_set_type', index: 0, setIndex: 1 })
    expect(w.exercises[0].sets[1].type).toBe('warmup')
    w = reduceWorkout(w, { type: 'add_set', index: 0 })
    expect(w.exercises[0].sets).toHaveLength(4)
    expect(w.exercises[0].sets[3]).toMatchObject({ weightKg: 80, reps: 6, done: false, type: 'normal' })
  })

  it('startet keine neue Pause, wenn ein frueherer Satz nachtraeglich abgehakt wird', () => {
    let w = startWorkout({ routine, history, now })
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 1, defaultRestS: 90, now: 1000 })
    expect(w.restEndsAt).toBe(1000 + 120_000)
    w = reduceWorkout(w, { type: 'rest_skip' })
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 0, defaultRestS: 90, now: 5000 })
    expect(w.exercises[0].sets[0].done).toBe(true)
    expect(w.restEndsAt).toBeNull()
    // Abhaken rueckgaengig laesst eine laufende Pause in Ruhe
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 2, defaultRestS: 90, now: 9000 })
    expect(w.restEndsAt).toBe(9000 + 120_000)
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 1, defaultRestS: 90, now: 9500 })
    expect(w.restEndsAt).toBe(9000 + 120_000)
  })

  it('macht das Entfernen von Satz und Uebung rueckgaengig', () => {
    let w = startWorkout({ routine, history, now })
    expect(w.undo).toBeNull()
    w = reduceWorkout(w, { type: 'remove_set', index: 0, setIndex: 2 })
    expect(w.exercises[0].sets).toHaveLength(2)
    expect(w.undo?.label).toBe('set')
    w = reduceWorkout(w, { type: 'title', title: 'x' })
    expect(w.undo?.label).toBe('set')
    w = reduceWorkout(w, { type: 'undo' })
    expect(w.exercises[0].sets).toHaveLength(3)
    expect(w.undo).toBeNull()
    expect(reduceWorkout(w, { type: 'undo' })).toBe(w)
    w = reduceWorkout(w, { type: 'remove_exercise', index: 1 })
    expect(w.exercises).toHaveLength(1)
    expect(w.undo?.label).toBe('exercise')
    w = reduceWorkout(w, { type: 'undo' })
    expect(w.exercises.map(e => e.exerciseId)).toEqual(['bench', 'fly'])
    expect(reduceWorkout(w, { type: 'remove_set', index: 5, setIndex: 0 })).toBe(w)
  })

  it('tauscht eine Uebung und behaelt Satzzahl, Satzarten, Pause und Supersatz', () => {
    let w = startWorkout({ routine, history, now })
    w = reduceWorkout(w, { type: 'toggle_superset', index: 0 })
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 1, defaultRestS: 90, now: 0 })
    w = reduceWorkout(w, { type: 'replace_exercise', index: 0, exerciseId: 'incline', history })
    expect(w.exercises[0]).toMatchObject({ exerciseId: 'incline', restS: 120, supersetGroup: 1 })
    expect(w.exercises[0].sets.map(s => [s.type, s.weightKg, s.done])).toEqual([
      ['warmup', null, false], ['normal', null, false], ['normal', null, false],
    ])
  })

  it('schreibt einen Vorschlag nur in offene, nicht getippte Saetze', () => {
    let w = startWorkout({ routine, history, now })
    w = reduceWorkout(w, { type: 'update_set', index: 0, setIndex: 1, patch: { weightKg: 85 } })
    w = reduceWorkout(w, { type: 'update_set', index: 0, setIndex: 2, patch: { rpe: 8 } })
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 0, defaultRestS: 90, now: 0 })
    expect(w.exercises[0].sets[1].touched).toBe(true)
    expect(w.exercises[0].sets[2].touched).toBeUndefined()
    w = reduceWorkout(w, {
      type: 'apply_suggestion', index: 0,
      sets: [{ type: 'warmup', weightKg: 50, reps: 10 }, { type: 'normal', weightKg: 82.5, reps: 6 }, { type: 'normal', weightKg: 82.5, reps: 6 }],
    })
    expect(w.exercises[0].sets.map(s => s.weightKg)).toEqual([40, 85, 82.5])
    expect(w.exercises[0].sets[2].rpe).toBe(8)
    // `touched` wird nicht gespeichert
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 1, defaultRestS: 90, now: 0 })
    const saved = finishWorkout(w, { now, rpe: null })
    expect(saved.exercises[0].sets.every(s => !('touched' in s))).toBe(true)
  })

  it('belegt Saetze mit dem Vorschlag vor, wenn es einen gibt', () => {
    const suggest = (id: string): Suggestion | null => id === 'bench'
      ? { sets: [{ type: 'warmup', weightKg: 40, reps: 10 }, { type: 'normal', weightKg: 82.5, reps: 6 }, { type: 'normal', weightKg: 82.5, reps: 6 }], reasonKey: 'progress_up', reasonVars: {}, change: 'weight_up' }
      : null
    let w = startWorkout({ routine, history, suggest, now })
    expect(w.exercises[0].sets.map(s => [s.weightKg, s.reps, s.done])).toEqual([[40, 10, false], [82.5, 6, false], [82.5, 6, false]])
    expect(w.exercises[0].sets.every(s => !s.touched)).toBe(true)
    // ohne Vorschlag: wie bisher aus der Routine
    expect(w.exercises[1].sets[0]).toMatchObject({ weightKg: 12, reps: 12 })
    w = reduceWorkout(w, { type: 'add_exercises', exerciseIds: ['bench'], history, suggest })
    expect(w.exercises[2].sets).toHaveLength(3)
    expect(w.exercises[2].sets[1].weightKg).toBe(82.5)
  })

  it('findet den naechsten offenen Satz und den Partner im Supersatz', () => {
    let w = startWorkout({ routine, history, now })
    expect(nextOpenSet(w)).toEqual({ index: 0, setIndex: 0 })
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 0, defaultRestS: 0, now: 0 })
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 1, defaultRestS: 0, now: 0 })
    expect(nextOpenSet(w)).toEqual({ index: 0, setIndex: 2 })
    expect(supersetPartnerIndex(w, 0)).toBeNull()
    w = reduceWorkout(w, { type: 'add_exercises', exerciseIds: ['c'], history })
    w = reduceWorkout(w, { type: 'toggle_superset', index: 0 })
    w = reduceWorkout(w, { type: 'toggle_superset', index: 1 })
    expect(w.exercises.map(e => e.supersetGroup)).toEqual([1, 1, 1])
    expect(supersetPartnerIndex(w, 0)).toBe(1)
    expect(supersetPartnerIndex(w, 2)).toBe(0)
    for (const [i, k] of [[0, 2], [1, 0], [2, 0]]) w = reduceWorkout(w, { type: 'toggle_done', index: i, setIndex: k, defaultRestS: 0, now: 0 })
    expect(nextOpenSet(w)).toBeNull()
  })

  it('verschiebt Uebungen nur innerhalb der Liste', () => {
    const w = startWorkout({ routine, history, now })
    expect(reduceWorkout(w, { type: 'move_exercise', index: 0, delta: -1 })).toBe(w)
    expect(reduceWorkout(w, { type: 'move_exercise', index: 0, delta: 1 }).exercises[0].exerciseId).toBe('fly')
  })
})

describe('finishWorkout', () => {
  it('speichert nur abgehakte Saetze und laesst leere Uebungen weg', () => {
    let w = startWorkout({ routine, history, now })
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 1, defaultRestS: 90, now: 0 })
    expect(countSets(w)).toEqual({ done: 1, open: 3 })
    const s = finishWorkout(w, { now: new Date('2026-10-18T11:05:00Z'), rpe: 8 })
    expect(s.exercises).toHaveLength(1)
    expect(s.exercises[0].sets).toHaveLength(1)
    expect(s.durationS).toBe(3900)
    expect(s.source).toBe('live')
    expect(s.id).toBeUndefined()
  })

  it('behaelt beim Bearbeiten Dauer, Quelle und kcal der gespeicherten Einheit', () => {
    const w = workoutFromSession(history[0])
    const s = finishWorkout(w, { now, rpe: 6, previous: history[0] })
    expect(s.id).toBe('old')
    expect(s.durationS).toBe(3600)
    expect(s.kcal).toBe(400)
    expect(s.exercises[0].sets).toHaveLength(2)
  })
})
