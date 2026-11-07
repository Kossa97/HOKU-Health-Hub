import { describe, expect, it } from 'vitest'
import { microKeyFor, stackMicros, toAppUnit } from './stackMicros'

describe('microKeyFor', () => {
  it('erkennt Wirkstoffe auf Deutsch und Englisch', () => {
    expect(microKeyFor('Vitamin D3')).toBe('vitD')
    expect(microKeyFor('Magnesiumcitrat')).toBe('mg')
    expect(microKeyFor('Zinc picolinate')).toBe('zn')
    expect(microKeyFor('Methylcobalamin')).toBe('b12')
    expect(microKeyFor('Omega-3 Fischöl')).toBe('omega3')
    expect(microKeyFor('Vitamin B12')).toBe('b12')
    expect(microKeyFor('Vitamin B1')).toBe('b1')
  })
  it('rät nicht bei Kombinationen oder Unbekanntem', () => {
    expect(microKeyFor('Vitamin D3 + K2')).toBeNull()
    expect(microKeyFor('Creatin')).toBeNull()
    // Fischöl ist die Ölmenge, nicht Omega-3
    expect(microKeyFor('Fischöl')).toBeNull()
    expect(microKeyFor(null)).toBeNull()
  })
})

describe('toAppUnit', () => {
  it('rechnet Massen und IE um', () => {
    expect(toAppUnit(25, 'mcg', 'vitD')).toBeCloseTo(25)
    expect(toAppUnit(1000, 'IU', 'vitD')).toBe(25)
    expect(toAppUnit(0.3, 'g', 'mg')).toBeCloseTo(300)
    expect(toAppUnit(2, 'g', 'omega3')).toBe(2)
    expect(toAppUnit(100, 'IU', 'vitE')).toBeNull()
    expect(toAppUnit(5, 'Kapsel', 'vitD')).toBeNull()
  })
})

describe('stackMicros', () => {
  const items: Record<string, { name: string | null; amount: number | null; unit: string | null; basisValue: number | null; basisUnit: string | null }[]> = {
    d3: [{ name: 'Vitamin D3', amount: 1000, unit: 'IU', basisValue: 1, basisUnit: 'capsule' }],
    mag: [{ name: 'Magnesium', amount: 150, unit: 'mg', basisValue: 1, basisUnit: 'capsule' }],
    combo: [
      { name: 'Vitamin D3', amount: 25, unit: 'mcg', basisValue: 1, basisUnit: 'tablet' },
      { name: 'Vitamin K2 (MK-7)', amount: 100, unit: 'mcg', basisValue: 1, basisUnit: 'tablet' },
    ],
  }
  it('rechnet jede genommene Einnahme mit der Stärke je Produkteinheit', () => {
    const r = stackMicros([
      { itemId: 'd3', itemName: 'Vitamin D3 1000', dose: 1, unit: 'capsule' },
      { itemId: 'mag', itemName: 'Magnesium', dose: 2, unit: 'capsule' },
      { itemId: 'combo', itemName: 'D3K2', dose: null, unit: null },
    ], id => items[id] ?? [])
    expect(r.total.vitD).toBe(50)
    expect(r.total.mg).toBe(300)
    expect(r.total.vitK).toBe(100)
    expect(r.parts).toContainEqual({ key: 'mg', item: 'Magnesium', amount: 300 })
  })
  it('als Masse eingetragen zählt bei einem Inhaltsstoff die Masse; fremde Einheit wird ausgelassen', () => {
    expect(stackMicros([{ itemId: 'mag', itemName: 'Mg', dose: 400, unit: 'mg' }], id => items[id] ?? []).total.mg).toBe(400)
    expect(stackMicros([{ itemId: 'combo', itemName: 'D3K2', dose: 2, unit: 'ml' }], id => items[id] ?? []).total).toEqual({})
  })
})
