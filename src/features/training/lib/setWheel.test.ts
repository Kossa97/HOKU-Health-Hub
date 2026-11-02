import { describe, expect, it } from 'vitest'
import { draftPatch, toDraft } from './setWheel'

const open = { type: 'normal', done: false } as const

describe('toDraft', () => {
  it('zerlegt kg in ganze Zahl und Viertel', () => {
    expect(toDraft(82.5, 5, 'kg', 20)).toEqual({ reps: 5, whole: 82, frac: 2 })
  })
  it('rundet ein Nachkomma nahe 1 in die ganze Zahl', () => {
    expect(toDraft(82.9, 5, 'kg', 20)).toEqual({ reps: 5, whole: 83, frac: 0 })
  })
  it('nimmt ohne Werte die Leerstange und 10 Wdh.', () => {
    expect(toDraft(null, null, 'kg', 20)).toEqual({ reps: 10, whole: 20, frac: 0 })
  })
  it('lb in halben Schritten', () => {
    // 82,5 kg = 181,9 lb → 182,0
    expect(toDraft(82.5, 5, 'lb', 20)).toEqual({ reps: 5, whole: 182, frac: 0 })
  })
})

describe('draftPatch', () => {
  const draft = { reps: 6, whole: 85, frac: 0 }

  it('schreibt nur das gedrehte Feld', () => {
    expect(draftPatch(draft, new Set(['weight']), open, false, 'weight_reps', 'kg')).toEqual({ weightKg: 85 })
  })
  it('ohne Drehen und ohne Haken: nichts', () => {
    expect(draftPatch(draft, new Set(), open, false, 'weight_reps', 'kg')).toBeNull()
  })
  it('Haken fuellt leere Felder, laesst vorhandene Werte unangetastet', () => {
    const set = { ...open, weightKg: 82.4, reps: null }
    expect(draftPatch(draft, new Set(), set, true, 'weight_reps', 'kg')).toEqual({ reps: 6 })
  })
  it('kein Gewicht bei reinen Wdh.', () => {
    expect(draftPatch(draft, new Set(['weight', 'reps']), open, true, 'reps', 'kg')).toEqual({ reps: 6 })
  })
})
