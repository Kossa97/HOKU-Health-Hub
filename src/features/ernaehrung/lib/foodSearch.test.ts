import { describe, expect, it } from 'vitest'
import { entryKey, frequentFoods, matchScore, mergeResults } from './foodSearch'
import { type Food, type LogEntry, nutrientsFor } from './nutrition'

const per100 = { kcal: 100, protein: 10, carbs: 10, fat: 2, fiber: null, sugar: null, satFat: null, salt: null }

const food = (name: string, over: Partial<Food> = {}): Food => ({
  itemId: null, source: 'off', sourceRef: null, barcode: null, name, brand: null, unit: 'g',
  per100, serving: null, favorite: false, ...over,
})

let n = 0
const entry = (name: string, over: Partial<LogEntry> = {}): LogEntry => ({
  id: String(++n), date: '2026-10-18', meal: 'breakfast', itemId: null, source: 'off', sourceRef: null,
  name, brand: null, unit: 'g', amount: 150, createdAt: '', sortKey: null, ...over,
  nutrients: nutrientsFor(per100, over.amount ?? 150),
})

describe('frequentFoods', () => {
  it('zählt Häufigkeit, merkt die zuletzt genutzte Menge', () => {
    const list = frequentFoods([
      entry('Skyr', { amount: 200 }), entry('Banane'), entry('Skyr', { amount: 150 }),
    ], null)
    expect(list.map(f => f.food.name)).toEqual(['Skyr', 'Banane'])
    expect(list[0]).toMatchObject({ count: 2, lastAmount: 200 })
    expect(list[0].food.per100.kcal).toBe(100)
  })
  it('bevorzugt die gerade gewählte Mahlzeit', () => {
    const list = frequentFoods([
      entry('Pasta', { meal: 'dinner' }), entry('Pasta', { meal: 'dinner' }), entry('Müsli', { meal: 'breakfast' }),
    ], 'breakfast')
    expect(list[0].food.name).toBe('Müsli')
  })
  it('lässt Schnelleinträge weg', () => {
    expect(frequentFoods([entry('Schnell', { source: 'quick', amount: null })], null)).toEqual([])
  })
  it('erkennt dasselbe Lebensmittel an Eintrag-ID, Quelle oder Name', () => {
    expect(entryKey({ itemId: 'a', source: 'custom', sourceRef: null, name: 'x', brand: null })).toBe('item:a')
    expect(entryKey({ itemId: null, source: 'off', sourceRef: '123', name: 'x', brand: null })).toBe('off:123')
    expect(entryKey({ itemId: null, source: 'custom', sourceRef: null, name: ' Skyr ', brand: 'Arla' })).toBe('name:skyr|arla')
  })
})

describe('matchScore', () => {
  it('Anfang > Wortanfang > enthalten; Umlaute und ß egal', () => {
    expect(matchScore('hafer', food('Haferflocken'))).toBe(3)
    expect(matchScore('flocken', food('Hafer Flocken zart'))).toBe(2)
    expect(matchScore('flock', food('Haferflocken'))).toBe(1)
    expect(matchScore('musli', food('Müsli'))).toBe(3)
    expect(matchScore('strasse', food('Straße'))).toBe(3)
  })
  it('alle Wörter müssen passen, Marke zählt mit', () => {
    expect(matchScore('skyr arla', food('Skyr natur', { brand: 'Arla' }))).toBeGreaterThan(0)
    expect(matchScore('skyr ehrmann', food('Skyr natur', { brand: 'Arla' }))).toBe(0)
    expect(matchScore('   ', food('X'))).toBe(0)
  })
})

describe('mergeResults', () => {
  it('eigene vor BLS vor Open Food Facts', () => {
    const out = mergeResults('apfel', {
      own: [food('Apfel (mein)', { source: 'custom', itemId: 'i1' })],
      bls: [food('Apfel, roh', { source: 'bls', sourceRef: 'F110000' })],
      off: [food('Apfelmus', { barcode: '4000000000001', sourceRef: '4000000000001' })],
    })
    expect(out.map(f => f.name)).toEqual(['Apfel (mein)', 'Apfel, roh', 'Apfelmus'])
  })
  it('eigene Korrektur verdrängt das Original mit gleichem Barcode', () => {
    const out = mergeResults('skyr', {
      own: [food('Skyr', { itemId: 'i1', barcode: '4000000000002', per100: { ...per100, kcal: 63 } })],
      bls: [],
      off: [food('Skyr', { barcode: '4000000000002', sourceRef: '4000000000002', per100: { ...per100, kcal: 630 } })],
    })
    expect(out).toHaveLength(1)
    expect(out[0].per100.kcal).toBe(63)
  })
  it('eigene und BLS werden gefiltert, OFF-Treffer bleiben (Server hat schon gefiltert)', () => {
    const out = mergeResults('quark', {
      own: [food('Brot', { source: 'custom' })],
      bls: [food('Speisequark, mager', { source: 'bls' })],
      off: [food('Skyr (Quark-Art)'), food('Protein Pudding')],
    })
    expect(out.map(f => f.name)).toEqual(['Speisequark, mager', 'Skyr (Quark-Art)', 'Protein Pudding'])
  })
})
