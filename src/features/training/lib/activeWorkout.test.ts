import { describe, expect, it } from 'vitest'
import type { TrainingRoutine, TrainingSession } from '../types'
import { afterToggleDone, countSets, finishWorkout, nextOpenSet, reduceWorkout, startWorkout, supersetPartnerIndex, workoutFromSession } from './activeWorkout'
import type { WorkoutAction } from './activeWorkout'
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

  it('macht das Entfernen von Satz und Uebung rueckgaengig — nur mit passender Kennung', () => {
    let w = startWorkout({ routine, history, now })
    expect(w.undo).toBeNull()
    w = reduceWorkout(w, { type: 'remove_set', index: 0, setIndex: 2 })
    expect(w.exercises[0].sets).toHaveLength(2)
    expect(w.undo?.label).toBe('set')
    const first = w.undo!.id
    // falsche Kennung (liegengebliebener Toast): nichts passiert
    expect(reduceWorkout(w, { type: 'undo', id: first + 1 })).toBe(w)
    w = reduceWorkout(w, { type: 'undo', id: first })
    expect(w.exercises[0].sets).toHaveLength(3)
    expect(w.undo).toBeNull()
    expect(reduceWorkout(w, { type: 'undo', id: first })).toBe(w)
    w = reduceWorkout(w, { type: 'remove_exercise', index: 1 })
    expect(w.exercises).toHaveLength(1)
    expect(w.undo?.label).toBe('exercise')
    expect(w.undo!.id).toBeGreaterThan(first)
    w = reduceWorkout(w, { type: 'undo', id: w.undo!.id })
    expect(w.exercises.map(e => e.exerciseId)).toEqual(['bench', 'fly'])
    expect(reduceWorkout(w, { type: 'remove_set', index: 5, setIndex: 0 })).toBe(w)
  })

  it('vergibt je Schnappschuss eine neue Kennung, auch direkt nacheinander', () => {
    let w = startWorkout({ routine, history, now })
    w = reduceWorkout(w, { type: 'remove_set', index: 0, setIndex: 2 })
    const a = w.undo!.id
    w = reduceWorkout(w, { type: 'remove_set', index: 0, setIndex: 1 })
    expect(w.undo!.id).toBeGreaterThan(a)
    // der zweite Schnappschuss ersetzt den ersten: Rueckgaengig bringt nur einen Satz zurueck
    w = reduceWorkout(w, { type: 'undo', id: w.undo!.id })
    expect(w.exercises[0].sets).toHaveLength(2)
  })

  it('verwirft den Schnappschuss bei jeder anderen Bedienung', () => {
    const base = reduceWorkout(startWorkout({ routine, history, now }), { type: 'remove_set', index: 0, setIndex: 2 })
    expect(base.undo).not.toBeNull()
    const others: WorkoutAction[] = [
      { type: 'title', title: 'x' },
      { type: 'add_exercises', exerciseIds: ['c'], history },
      { type: 'apply_suggestion', index: 0, sets: [{ type: 'normal', weightKg: 1, reps: 1 }] },
      { type: 'move_exercise', index: 0, delta: 1 },
      { type: 'toggle_superset', index: 0 },
      { type: 'exercise_rest', index: 0, restS: 60 },
      { type: 'exercise_notes', index: 0, notes: 'n' },
      { type: 'add_set', index: 0 },
      { type: 'update_set', index: 0, setIndex: 0, patch: { weightKg: 1 } },
      { type: 'cycle_set_type', index: 0, setIndex: 0 },
      { type: 'toggle_done', index: 0, setIndex: 0, defaultRestS: 90, now: 0 },
      { type: 'rest_adjust', deltaS: 15, now: 0 },
      { type: 'rest_skip' },
    ]
    for (const action of others) expect(reduceWorkout(base, action).undo, action.type).toBeNull()
    // die Entfern-Bedienungen behalten (ersetzen) ihn
    expect(reduceWorkout(base, { type: 'remove_exercise', index: 1 }).undo?.label).toBe('exercise')
    expect(reduceWorkout(base, { type: 'replace_exercise', index: 0, exerciseId: 'x', history }).undo?.label).toBe('exercise')
  })

  it('tauscht eine Uebung: offene Saetze neu, abgehakte bleiben, Rueckgaengig moeglich', () => {
    let w = startWorkout({ routine, history, now })
    w = reduceWorkout(w, { type: 'toggle_superset', index: 0 })
    w = reduceWorkout(w, { type: 'update_set', index: 0, setIndex: 1, patch: { weightKg: 85, reps: 5 } })
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 1, defaultRestS: 90, now: 0 })
    const suggest = (id: string): Suggestion | null => id === 'incline'
      ? { sets: [{ type: 'warmup', weightKg: 30, reps: 12 }, { type: 'normal', weightKg: 60, reps: 8 }], reasonKey: 'progress_hold', reasonVars: {}, change: 'hold' }
      : null
    const before = w.exercises
    w = reduceWorkout(w, { type: 'replace_exercise', index: 0, exerciseId: 'incline', history, suggest })
    expect(w.exercises[0]).toMatchObject({ exerciseId: 'incline', restS: 120, supersetGroup: 1 })
    expect(w.exercises[0].sets.map(s => [s.type, s.weightKg, s.reps, s.done])).toEqual([
      ['warmup', 30, 12, false],
      ['normal', 85, 5, true],
      ['normal', 60, 8, false],
    ])
    expect(w.undo).toMatchObject({ label: 'exercise', exercises: before })
    w = reduceWorkout(w, { type: 'undo', id: w.undo!.id })
    expect(w.exercises[0].exerciseId).toBe('bench')
    expect(reduceWorkout(w, { type: 'replace_exercise', index: 9, exerciseId: 'x', history })).toBe(w)
  })

  it('entscheidet mit einer Regel, ob nach dem Haken Pause, Partneruebung oder nichts folgt', () => {
    let w = startWorkout({ routine, history, now })
    w = reduceWorkout(w, { type: 'add_exercises', exerciseIds: ['c'], history })
    w = reduceWorkout(w, { type: 'toggle_superset', index: 0 })
    expect(afterToggleDone(w, 0, 0)).toBe('partner')
    expect(afterToggleDone(w, 1, 0)).toBe('rest')
    expect(afterToggleDone(w, 2, 0)).toBe('rest')
    expect(afterToggleDone(w, 7, 0)).toBe('none')
    w = reduceWorkout(w, { type: 'toggle_done', index: 0, setIndex: 1, defaultRestS: 90, now: 0 })
    // frueherer Satz nachtraeglich: nichts; Haken wieder weg: nichts
    expect(afterToggleDone(w, 0, 0)).toBe('none')
    expect(afterToggleDone(w, 0, 1)).toBe('none')
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
    expect(supersetPartnerIndex(w, 1)).toBe(2)
    // am Rundenende kein Sprung zurueck an den Anfang
    expect(supersetPartnerIndex(w, 2)).toBeNull()
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
