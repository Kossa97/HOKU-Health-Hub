import { describe, expect, it } from 'vitest'
import type { ActiveWorkout } from '../../lib/activeWorkout'
import { reduceWorkout } from '../../lib/activeWorkout'
import { findExercise, runVoiceCommand, type VoiceContext } from './voiceRun'

const workout = (): ActiveWorkout => ({
  sessionId: null, kind: 'strength', title: 'Push', startedAt: '2026-11-04T10:00:00Z', routineId: null,
  restEndsAt: null, restTotalS: null, notes: null, undo: null,
  exercises: [
    { exerciseId: 'bench_press_barbell', restS: 120, sets: [
      { type: 'normal', weightKg: 80, reps: 8, done: false },
      { type: 'normal', weightKg: 80, reps: 8, done: false },
    ] },
    { exerciseId: 'plank', sets: [{ type: 'normal', durationS: 30, done: false }] },
  ],
})

const ctx = (w: ActiveWorkout, extra: Partial<VoiceContext> = {}): VoiceContext => ({
  workout: w, focus: 0, lang: 'de', locale: 'de-DE', unit: 'kg', customExercises: [], defaultRestS: 90,
  now: 1_000_000, history: [], suggest: () => null, ...extra,
})

/** Befehl ausführen wie der Logger: Ergebnis + neuer Stand. */
function run(w: ActiveWorkout, text: string, extra?: Partial<VoiceContext>) {
  const r = runVoiceCommand(text, ctx(w, extra))
  const next = r.type === 'actions' ? reduceWorkout(w, { type: 'batch', actions: r.actions })
    : r.type === 'undo' ? reduceWorkout(w, { type: 'undo', id: r.id }) : w
  return { r, next }
}

describe('runVoiceCommand', () => {
  it('„82,5 mal 6" trägt in den nächsten offenen Satz ein, hakt ab, startet die Pause', () => {
    const { r, next } = run(workout(), '82,5 mal 6')
    expect(r.type === 'actions' && r.message).toEqual({ key: 'voice_set_done', vars: { exercise: 'Bankdrücken (Langhantel)', n: 1, value: '82,5 kg × 6' } })
    expect(next.exercises[0].sets[0]).toMatchObject({ weightKg: 82.5, reps: 6, done: true })
    expect(next.restEndsAt).toBe(1_000_000 + 120_000)
  })

  it('„gleich wie eben" wiederholt den letzten Satz; „Rückgängig" nimmt ihn zurück', () => {
    const a = run(workout(), '85 kg 5').next
    const b = run(a, 'gleich wie eben').next
    expect(b.exercises[0].sets[1]).toMatchObject({ weightKg: 85, reps: 5, done: true })
    const c = run(b, 'rückgängig')
    expect(c.r.type).toBe('undo')
    expect(c.next.exercises[0].sets[1]).toMatchObject({ weightKg: 80, reps: 8, done: false })
    expect(run(workout(), 'gleich wie eben').r).toEqual({ type: 'none', message: { key: 'voice_nothing_to_repeat', vars: undefined } })
  })

  it('Zeitübung: „45 Sekunden" nach „nächste Übung"', () => {
    const focus = run(workout(), 'nächste Übung').r
    expect(focus).toMatchObject({ type: 'focus', focusId: 'plank', scrollTo: 1 })
    const { next } = run(workout(), '45 Sekunden', { focus: 1 })
    expect(next.exercises[1].sets[0]).toMatchObject({ durationS: 45, done: true })
    expect(next.exercises[0].sets[0].done).toBe(false)
  })

  it('Pause, Pause überspringen, Satz dazu, Übung dazu', () => {
    const rest = run(workout(), 'Pause 2 Minuten')
    expect(rest.next.restTotalS).toBe(120)
    expect(rest.r.type === 'actions' && rest.r.message.vars).toEqual({ time: '2:00' })
    expect(run(rest.next, 'Pause überspringen').next.restEndsAt).toBeNull()
    expect(run(workout(), 'Pause überspringen').r.message.key).toBe('voice_no_rest')
    expect(run(workout(), 'noch ein Satz').next.exercises[0].sets).toHaveLength(3)
    const added = run(workout(), 'Kniebeuge hinzufügen')
    expect(added.next.exercises).toHaveLength(3)
    expect(added.r.type === 'actions' && added.r.scrollTo).toBe(2)
  })

  it('nichts eintragen, wenn es nicht passt', () => {
    expect(run(workout(), 'Kaffee bitte').r.message.key).toBe('voice_not_understood')
    expect(run(workout(), '45 Sekunden').r.message.key).toBe('voice_missing')
    expect(run(workout(), '900 kg 8').r.message.key).toBe('voice_implausible')
    expect(run(workout(), 'Rückgängig').r.message.key).toBe('voice_nothing_to_undo')
    expect(run(workout(), 'Fantasieübung hinzufügen').r).toEqual({ type: 'none', message: { key: 'voice_no_exercise', vars: { name: 'fantasieübung' } } })
  })
})

describe('findExercise', () => {
  it('Mehrzahl und Teilnamen; bevorzugt schon Trainiertes', () => {
    expect(findExercise('Klimmzüge', 'de', [], [])).toBe('pull_up')
    expect(findExercise('bench press', 'en', [], [])).not.toBeNull()
    const history = [{ exercises: [{ exerciseId: 'bench_press_dumbbell', sets: [] }] }] as never
    expect(findExercise('Bankdrücken', 'de', [], history)).toBe('bench_press_dumbbell')
  })
})
