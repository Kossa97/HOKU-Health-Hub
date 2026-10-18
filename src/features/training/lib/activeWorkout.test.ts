import { describe, expect, it } from 'vitest'
import type { TrainingRoutine, TrainingSession } from '../types'
import { countSets, finishWorkout, reduceWorkout, startWorkout, workoutFromSession } from './activeWorkout'

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
  id: 'r1', name: 'Push', kind: 'strength', weekdays: [1], sortOrder: 0,
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

  it('wechselt die Satzart reihum und uebernimmt Werte in neue Saetze', () => {
    let w = startWorkout({ routine, history, now })
    w = reduceWorkout(w, { type: 'cycle_set_type', index: 0, setIndex: 1 })
    expect(w.exercises[0].sets[1].type).toBe('warmup')
    w = reduceWorkout(w, { type: 'add_set', index: 0 })
    expect(w.exercises[0].sets).toHaveLength(4)
    expect(w.exercises[0].sets[3]).toMatchObject({ weightKg: 80, reps: 6, done: false, type: 'normal' })
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
