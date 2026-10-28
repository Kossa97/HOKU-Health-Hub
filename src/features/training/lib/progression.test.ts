import { describe, expect, it } from 'vitest'
import type { RoutineSet, TrainingSet } from '../types'
import { roundWeightKg, suggestNextSets, weightIncrementKg, type SuggestionInput } from './progression'

const set = (weightKg: number | null, reps: number, rpe: number | null = null, type: TrainingSet['type'] = 'normal'): TrainingSet =>
  ({ type, weightKg, reps, rpe, done: true })

const base = (previous: TrainingSet[], extra: Partial<SuggestionInput> = {}): SuggestionInput => ({
  exerciseId: 'bench_press_barbell', equipment: 'barbell', tracking: 'weight_reps', previous, unit: 'kg', ...extra,
})

const range = (repsMin: number, repsMax: number, count = 3): RoutineSet[] =>
  Array.from({ length: count }, () => ({ type: 'normal', repsMin, repsMax }))

describe('suggestNextSets', () => {
  it('gibt bei Zeit oder Strecke keinen Vorschlag', () => {
    expect(suggestNextSets(base([set(null, 10)], { tracking: 'duration' }))).toBeNull()
    expect(suggestNextSets(base([set(null, 10)], { tracking: 'distance_duration' }))).toBeNull()
  })

  it('erhoeht das Gewicht, wenn alle Saetze das Maximum geschafft haben und die RPE passt', () => {
    const s = suggestNextSets(base([set(80, 12, 8), set(80, 12, 8.5), set(80, 12)], { template: range(8, 12) }))
    expect(s).toMatchObject({ change: 'weight_up', reasonKey: 'progress_up' })
    expect(s?.sets.map(x => [x.weightKg, x.reps])).toEqual([[82.5, 8], [82.5, 8], [82.5, 8]])
    expect(s?.reasonVars).toEqual({ sets: 3, reps: 12, weight: 80, next: 82.5 })
  })

  it('haelt ohne Wdh.-Bereich erst die Wdh. und steigert dann das Gewicht', () => {
    // Ziel = Wdh. des ersten Arbeitssatzes vom letzten Mal
    const s = suggestNextSets(base([set(80, 6), set(80, 6), set(80, 6)]))
    expect(s).toMatchObject({ change: 'weight_up' })
    expect(s?.sets.map(x => [x.weightKg, x.reps])).toEqual([[82.5, 6], [82.5, 6], [82.5, 6]])
  })

  it('haelt bei hoher RPE das Gewicht, auch wenn alle Wdh. geschafft sind', () => {
    const s = suggestNextSets(base([set(80, 10, 9), set(80, 10, 9.5)]))
    expect(s).toMatchObject({ change: 'hold', reasonKey: 'progress_hold', reasonVars: { sets: 2, reps: 10, weight: 80 } })
    expect(s?.sets.map(x => [x.weightKg, x.reps])).toEqual([[80, 10], [80, 10]])
  })

  it('steigert die Wdh. der Saetze unter dem Ziel, wenn nicht alle am Ziel sind', () => {
    const s = suggestNextSets(base([set(80, 12), set(80, 10), set(80, 9)], { template: range(8, 12) }))
    expect(s).toMatchObject({ change: 'reps_up', reasonKey: 'progress_reps_up', reasonVars: { reps: 12 } })
    expect(s?.sets.map(x => [x.weightKg, x.reps])).toEqual([[80, 12], [80, 11], [80, 10]])
  })

  it('geht nach verfehlten Saetzen etwas runter — mindestens einen Schritt', () => {
    // 5 % von 80 = 76, auf 2,5 gerundet 75 → 75
    const s = suggestNextSets(base([set(80, 6), set(80, 5), set(80, 5)], { template: range(8, 10) }))
    expect(s).toMatchObject({ change: 'weight_down', reasonKey: 'progress_back_off', reasonVars: { weight: 75 } })
    expect(s?.sets.map(x => [x.weightKg, x.reps])).toEqual([[75, 8], [75, 8], [75, 8]])
    // 5 % von 20 kg Kurzhantel = 19 → auf 2 kg gerundet 20 → mindestens ein Schritt: 18
    const d = suggestNextSets(base([set(20, 8, 10), set(20, 7)], { equipment: 'dumbbell', template: range(10, 12) }))
    expect(d?.sets[0].weightKg).toBe(18)
  })

  it('macht bei zu grossem Sprung erst eine Wdh. mehr — und springt nach zwei Extra-Wdh. doch', () => {
    const s = suggestNextSets(base([set(5, 15), set(5, 15)], { equipment: 'dumbbell', template: range(12, 15, 2) }))
    expect(s).toMatchObject({ change: 'reps_up', reasonKey: 'progress_jump_too_big', reasonVars: { inc: 2, reps: 16, weight: 5 } })
    expect(s?.sets.map(x => [x.weightKg, x.reps])).toEqual([[5, 16], [5, 16]])
    const later = suggestNextSets(base([set(5, 17), set(5, 17)], { equipment: 'dumbbell', template: range(12, 15, 2) }))
    expect(later).toMatchObject({ change: 'weight_up' })
    expect(later?.sets[0]).toMatchObject({ weightKg: 7, reps: 12 })
  })

  it('steigert bei Geraeten ohne Gewichtsschritt nur die Wdh.', () => {
    const s = suggestNextSets(base([set(null, 10), set(null, 10)], { equipment: 'bodyweight', tracking: 'bodyweight_reps' }))
    expect(s).toMatchObject({ change: 'reps_up', reasonKey: 'progress_reps_only', reasonVars: { sets: 2, reps: 11 } })
    expect(s?.sets.map(x => [x.weightKg, x.reps])).toEqual([[null, 11], [null, 11]])
    const hold = suggestNextSets(base([set(null, 10, 9)], { equipment: 'bodyweight', tracking: 'bodyweight_reps' }))
    expect(hold).toMatchObject({ change: 'hold', reasonKey: 'progress_hold_reps' })
  })

  it('zaehlt bei Unterstuetzung weniger Hilfe als Fortschritt', () => {
    const s = suggestNextSets(base([set(30, 10), set(30, 10)], { equipment: 'machine', tracking: 'assisted_reps' }))
    expect(s).toMatchObject({ change: 'weight_up' })
    expect(s?.sets[0].weightKg).toBe(27.5)
    const down = suggestNextSets(base([set(30, 5, 10), set(30, 5)], { equipment: 'machine', tracking: 'assisted_reps', template: range(8, 10) }))
    expect(down?.sets[0].weightKg).toBe(32.5)
  })

  it('nimmt ab 50 kg an der Maschine 5-kg-Schritte und rundet in lb auf Viertel-Pfund', () => {
    expect(weightIncrementKg('machine', 'kg', 40)).toBe(2.5)
    expect(weightIncrementKg('machine', 'kg', 50)).toBe(5)
    expect(weightIncrementKg('band', 'kg', 20)).toBeNull()
    expect(roundWeightKg(82.3, 'kg')).toBe(82.25)
    // 180 lb + 5 lb = 185 lb, als kg gespeichert
    const prev = 180 * 0.45359237
    const s = suggestNextSets(base([set(prev, 5), set(prev, 5)], { unit: 'lb' }))
    expect(s?.sets[0].weightKg).toBeCloseTo(185 * 0.45359237, 2)
  })

  it('traegt Aufwaermsaetze unveraendert mit und haelt die Satzzahl der Vorlage', () => {
    const template: RoutineSet[] = [{ type: 'warmup', weightKg: 40, reps: 10 }, ...range(8, 12, 3)]
    const previous = [set(45, 10, null, 'warmup'), set(80, 12), set(80, 12)]
    const s = suggestNextSets(base(previous, { template }))
    expect(s?.sets).toHaveLength(4)
    expect(s?.sets[0]).toMatchObject({ type: 'warmup', weightKg: 45, reps: 10 })
    expect(s?.sets.slice(1).map(x => [x.weightKg, x.reps])).toEqual([[82.5, 8], [82.5, 8], [82.5, 8]])
    // ohne Vorlage: Satzzahl wie letztes Mal
    expect(suggestNextSets(base(previous))?.sets).toHaveLength(3)
  })

  it('nimmt ohne letztes Mal die Startwerte der Routine, sonst nichts', () => {
    const s = suggestNextSets(base([], { template: [{ type: 'normal', weightKg: 60, repsMin: 8, repsMax: 12 }] }))
    expect(s).toMatchObject({ change: 'none', reasonKey: 'progress_from_template' })
    expect(s?.sets[0]).toMatchObject({ weightKg: 60, reps: 8 })
    expect(suggestNextSets(base([], { template: range(8, 12) }))).toMatchObject({ change: 'none' })
    expect(suggestNextSets(base([], { template: [{ type: 'normal' }] }))).toBeNull()
    expect(suggestNextSets(base([]))).toBeNull()
  })

  it('liefert nie negative Werte', () => {
    const s = suggestNextSets(base([set(2, 4, 10), set(2, 3)], { equipment: 'barbell', template: range(8, 10) }))
    expect(s?.sets.every(x => (x.weightKg ?? 0) >= 0 && (x.reps ?? 1) >= 1)).toBe(true)
  })
})
