import { describe, expect, it } from 'vitest'
import { exerciseInfo } from './exerciseLookup'
import { entwurfZuWorkouts, liesPlaene, trainingKontext, unbekannteUebungen , liesGesichertenPlan } from './hokuPlan'

const vomServer = [{
  name: 'Ganzkörper', zeitplan: 'pro_woche', anzahl: 3,
  workouts: [
    { name: 'A', wochentage: ['Mo'], uebungen: [
      { id: 'bench_press_dumbbell', saetze: 3, wdhMin: 8, wdhMax: 12, sekunden: null, pauseS: 90 },
      { id: 'gibt_es_nicht', saetze: 2, wdhMin: 10, wdhMax: 10, sekunden: null, pauseS: null },
    ] },
    { name: '', wochentage: [], uebungen: [{ id: 'plank', saetze: 3, wdhMin: null, wdhMax: null, sekunden: 45, pauseS: null }] },
  ],
}]

describe('Hoku-Plan', () => {
  it('liest den Entwurf vom Server', () => {
    const [p] = liesPlaene(vomServer)
    expect(p.schedule).toEqual({ mode: 'per_week', perWeek: 3 })
    // Wochentage nur bei festen Wochentagen
    expect(p.workouts[0].weekdays).toEqual([])
    expect(p.workouts[1].exercises[0]).toEqual({ id: 'plank', sets: 3, repsMin: null, repsMax: null, durationS: 45, restS: null })
    expect(liesPlaene('x')).toEqual([])
    expect(liesPlaene([{ name: 'leer', zeitplan: 'pro_woche', anzahl: 3, workouts: [] }])).toEqual([])
  })

  it('findet Übungen, die es nicht gibt, und lässt sie beim Speichern weg', () => {
    const [p] = liesPlaene(vomServer)
    const info = (id: string) => exerciseInfo(id, 'de', [])
    expect(unbekannteUebungen(p, new Set(['bench_press_dumbbell', 'plank']))).toEqual(['0:1'])
    const workouts = entwurfZuWorkouts(p, 'Ganzkörper', 5, info, n => `Workout ${n}`)
    expect(workouts.map(w => [w.name, w.folder, w.sortOrder, w.exercises.length])).toEqual([['A', 'Ganzkörper', 5, 1], ['Workout 2', 'Ganzkörper', 6, 1]])
    // Leere Gewichte, Wdh.-Bereich bzw. Dauer, Pause
    expect(workouts[0].exercises[0]).toEqual({ exerciseId: 'bench_press_dumbbell', restS: 90, sets: Array(3).fill({ type: 'normal', repsMin: 8, repsMax: 12 }) })
    expect(workouts[1].exercises[0].sets[0]).toEqual({ type: 'normal', durationS: 45 })
  })

  it('schickt den Katalog kompakt mit, ohne Verlaufsdaten', () => {
    const k = trainingKontext('de', [], ['PPL'], 'kg')
    expect(k.katalog.find(z => z.startsWith('bench_press_dumbbell|'))).toMatch(/^bench_press_dumbbell\|Bankdrücken \(Kurzhantel\)\|dumbbell\|/)
    expect(Object.keys(k)).toEqual(['katalog', 'vorhandene_plaene', 'einheit'])
    // Passt in die Obergrenze des Servers (MAX_KONTEXT 24 000) mit Platz für die übrigen Daten
    expect(JSON.stringify(k).length).toBeLessThan(16_000)
  })
})

describe('liesGesichertenPlan', () => {
  const plan = { name: 'P', workouts: [{ name: 'A', weekdays: [], exercises: [{ id: 'squat_barbell', sets: 3 }] }] }
  it('nimmt einen gültigen Zeitplan', () => {
    expect(liesGesichertenPlan({ ...plan, schedule: { mode: 'per_week', perWeek: 3 } })).toBeDefined()
    expect(liesGesichertenPlan({ ...plan, schedule: { mode: 'weekdays' } })).toBeDefined()
  })
  it('verwirft einen Zeitplan ohne Zahl', () => {
    expect(liesGesichertenPlan({ ...plan, schedule: { mode: 'per_week' } })).toBeUndefined()
    expect(liesGesichertenPlan({ ...plan, schedule: { mode: 'interval', everyDays: 0 } })).toBeUndefined()
  })
})
