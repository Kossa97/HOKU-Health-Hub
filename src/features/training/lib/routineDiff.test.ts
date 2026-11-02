import { describe, expect, it } from 'vitest'
import type { TrainingRoutine } from '../types'
import { reduceWorkout, startWorkout } from './activeWorkout'
import { applyRoutineDiff, routineDiff } from './routineDiff'

const routine: TrainingRoutine = {
  id: 'r1', name: 'Push', kind: 'strength', weekdays: [1], sortOrder: 0, folder: 'PPL',
  exercises: [
    { exerciseId: 'bench', restS: 120, sets: [{ type: 'warmup', weightKg: 40, reps: 10 }, { type: 'normal', repsMin: 6, repsMax: 10 }, { type: 'normal', repsMin: 6, repsMax: 10 }] },
    { exerciseId: 'fly', sets: [{ type: 'normal', weightKg: 12, reps: 12 }] },
  ],
}

const now = new Date('2026-10-28T10:00:00Z')
const done = (w: ReturnType<typeof startWorkout>, index: number, setIndex: number) =>
  reduceWorkout(w, { type: 'toggle_done', index, setIndex, defaultRestS: 0, now: 0 })

function trainedAsPlanned() {
  let w = startWorkout({ routine, history: [], now })
  w = reduceWorkout(w, { type: 'update_set', index: 0, setIndex: 1, patch: { weightKg: 80, reps: 8 } })
  w = reduceWorkout(w, { type: 'update_set', index: 0, setIndex: 2, patch: { weightKg: 82.5, reps: 6 } })
  for (const [i, s] of [[0, 0], [0, 1], [0, 2], [1, 0]] as const) w = done(w, i, s)
  return w
}

describe('routineDiff', () => {
  it('meldet nichts, wenn Uebungen, Reihenfolge und Satzzahl stimmen', () => {
    expect(routineDiff(trainedAsPlanned(), routine)).toBeNull()
  })

  it('ignoriert ausgelassene Uebungen und nicht abgehakte Saetze von Neuzugaengen', () => {
    let w = startWorkout({ routine, history: [], now })
    w = done(w, 0, 1)
    w = done(w, 0, 2)
    w = done(w, 0, 0)
    // fly bleibt offen, eine neue Uebung ohne Haken zaehlt nicht
    w = reduceWorkout(w, { type: 'add_exercises', exerciseIds: ['curl'], history: [] })
    expect(routineDiff(w, routine)).toBeNull()
  })

  it('erkennt hinzugefuegte, entfernte und umsortierte Uebungen sowie geaenderte Satzzahlen', () => {
    let w = trainedAsPlanned()
    w = reduceWorkout(w, { type: 'add_exercises', exerciseIds: ['curl'], history: [] })
    w = reduceWorkout(w, { type: 'update_set', index: 2, setIndex: 0, patch: { weightKg: 14, reps: 12 } })
    w = done(w, 2, 0)
    w = reduceWorkout(w, { type: 'add_set', index: 2 })
    w = reduceWorkout(w, { type: 'update_set', index: 2, setIndex: 1, patch: { weightKg: 12, reps: 14 } })
    w = done(w, 2, 1)
    w = reduceWorkout(w, { type: 'move_exercise', index: 2, delta: -1 })
    w = reduceWorkout(w, { type: 'add_set', index: 0 })
    w = done(w, 0, 3)
    const diff = routineDiff(w, routine)
    expect(diff).not.toBeNull()
    expect(diff?.added).toEqual(['curl'])
    expect(diff?.removed).toEqual([])
    expect(diff?.reordered).toBe(false)
    expect(diff?.setChanges).toEqual([{ exerciseId: 'bench', from: 3, to: 4 }])
    expect(diff?.proposed.map(e => e.exerciseId)).toEqual(['bench', 'curl', 'fly'])
    // Neue Uebung: Wdh.-Bereich = Wdh. des ersten Arbeitssatzes, Gewicht = schwerster Satz
    expect(diff?.proposed[1].sets).toEqual([
      { type: 'normal', weightKg: 14, reps: 12, repsMin: 12, repsMax: 12, durationS: null, distanceM: null },
      { type: 'normal', weightKg: 14, reps: 12, repsMin: 12, repsMax: 12, durationS: null, distanceM: null },
    ])
    // Bestehende Uebung: Bereich bleibt, Startgewicht = schwerster Arbeitssatz, Aufwaermsatz aus der Vorlage
    expect(diff?.proposed[0].sets[0]).toEqual({ type: 'warmup', weightKg: 40, reps: 10 })
    expect(diff?.proposed[0].sets[1]).toEqual({ type: 'normal', repsMin: 6, repsMax: 10, weightKg: 82.5 })
    expect(diff?.proposed[0].sets[3]).toEqual({ type: 'normal', repsMin: 6, repsMax: 10, weightKg: 82.5 })
    expect(diff?.proposed[0].restS).toBe(120)

    const updated = applyRoutineDiff(routine, diff!)
    expect(updated).toMatchObject({ id: 'r1', name: 'Push', folder: 'PPL', weekdays: [1], sortOrder: 0 })
    expect(updated.exercises).toHaveLength(3)
  })

  it('laesst eine ausgelassene Dublette die spaetere nicht verschieben', () => {
    const squats: TrainingRoutine = { ...routine, exercises: [{ exerciseId: 'squat', sets: [{ type: 'normal', repsMin: 5, repsMax: 5 }] }] }
    let w = startWorkout({ routine: squats, history: [], now })
    // zweimal Kniebeuge im Training, nur die zweite abgehakt
    w = reduceWorkout(w, { type: 'add_exercises', exerciseIds: ['squat'], history: [] })
    w = reduceWorkout(w, { type: 'update_set', index: 1, setIndex: 0, patch: { weightKg: 100, reps: 5 } })
    w = done(w, 1, 0)
    expect(routineDiff(w, squats)).toBeNull()
    // beide abgehakt: die zweite ist tatsaechlich neu
    w = done(w, 0, 0)
    expect(routineDiff(w, squats)).toMatchObject({ added: ['squat'], removed: [], reordered: false })
    // Routine mit der Uebung zweimal, nur eine trainiert: die andere gilt als ausgelassen, nicht entfernt
    const twice: TrainingRoutine = { ...squats, exercises: [squats.exercises[0], { exerciseId: 'squat', sets: [{ type: 'normal', repsMin: 8, repsMax: 8 }] }] }
    let v = startWorkout({ routine: twice, history: [], now })
    v = reduceWorkout(v, { type: 'update_set', index: 1, setIndex: 0, patch: { weightKg: 100, reps: 5 } })
    v = done(v, 1, 0)
    expect(routineDiff(v, twice)).toMatchObject({ added: [], removed: [] })
  })

  it('meldet Entfernen und neue Reihenfolge', () => {
    let w = trainedAsPlanned()
    w = reduceWorkout(w, { type: 'move_exercise', index: 0, delta: 1 })
    expect(routineDiff(w, routine)).toMatchObject({ reordered: true, added: [], removed: [] })
    w = reduceWorkout(w, { type: 'remove_exercise', index: 0 })
    const diff = routineDiff(w, routine)
    expect(diff).toMatchObject({ removed: ['fly'], reordered: false })
    expect(diff?.proposed.map(e => e.exerciseId)).toEqual(['bench'])
  })
})
