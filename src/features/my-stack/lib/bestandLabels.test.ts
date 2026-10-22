import { describe, expect, it } from 'vitest'
import type { StackItemInventory } from '../types'
import { neuAnbrechenLabel, vorratZeilen } from './bestandLabels'

// Schluessel mit Werten, damit die Tests sehen, welcher Text gewaehlt wurde.
const t = (key: string, options?: Record<string, unknown>) => {
  const werte = Object.entries(options ?? {}).map(([name, wert]) => `${name}=${String(wert)}`)
  return werte.length > 0 ? `${key}(${werte.join(',')})` : key
}

function inventory(changes: Partial<StackItemInventory> = {}): StackItemInventory {
  return {
    enabled: true,
    package_quantity: 100,
    package_unit: 'spray',
    remaining_quantity: 240,
    batch_number: null,
    expires_at: null,
    ...changes,
  }
}

describe('vorratZeilen', () => {
  it('Vial mit fertiger Loesung in ml: Menge vorn, dahinter die Vials', () => {
    const ml = { package_unit: 'ml', package_quantity: 10 }
    expect(vorratZeilen(t, inventory({ ...ml, remaining_quantity: 8 }), 'vial', 'de').klein)
      .toBe('my_stack_stock_solution_vial_size(amount=my_stack_stock_unit_ml_multiple(n=10))')
    expect(vorratZeilen(t, inventory({ ...ml, remaining_quantity: 18, opened_at: '2026-09-20' }), 'vial', 'de').klein)
      .toBe('my_stack_stock_solution_vial_extra(n=1,percent=80)')
    expect(vorratZeilen(t, inventory({ ...ml, remaining_quantity: 8, opened_at: '2026-09-20' }), 'vial', 'de').klein)
      .toBe('my_stack_stock_solution_vial_opened(n=0,percent=80)')
  })

  it('zeigt Sprays in Behaeltern, nicht in Spruehstoessen', () => {
    const zeilen = vorratZeilen(t, inventory({ opened_at: '2026-09-20' }), 'nasal_spray', 'de')
    expect(zeilen.gross).toBe('my_stack_stock_container_spray_multiple(n=2)')
    expect(zeilen.klein).toBe('my_stack_stock_bottle_extra(percent=40)')
  })

  it('ohne angebrochenen Behaelter: die Groesse eines Behaelters', () => {
    const zeilen = vorratZeilen(t, inventory({ remaining_quantity: 300 }), 'spray', 'de')
    expect(zeilen.gross).toBe('my_stack_stock_container_spray_multiple(n=3)')
    expect(zeilen.klein).toBe('my_stack_stock_container_size(amount=my_stack_stock_unit_spray_multiple(n=100))')
  })

  it('Pen und Tropfflasche mit eigenem Wort', () => {
    expect(vorratZeilen(t, inventory({ package_unit: 'dose', package_quantity: 4, remaining_quantity: 5, opened_at: '2026-09-20' }), 'pen', 'de'))
      .toMatchObject({ gross: 'my_stack_stock_container_pen_single(n=1)', klein: 'my_stack_stock_pen_extra(percent=25)' })
    expect(vorratZeilen(t, inventory({ package_unit: 'ml', package_quantity: 30, remaining_quantity: 60 }), 'drops', 'de').gross)
      .toBe('my_stack_stock_container_bottle_multiple(n=2)')
  })

  it('Tabletten bleiben Tabletten — eine Packung bricht man nicht an', () => {
    const zeilen = vorratZeilen(t, inventory({ package_unit: 'tablet', package_quantity: 60, remaining_quantity: 42 }), 'tablet', 'de')
    expect(zeilen.gross).toBe('my_stack_stock_unit_tablet_multiple(n=42)')
  })

  it('nie geoeffnet: kein „geöffnet", nur die Zahl der Behaelter', () => {
    const zeilen = vorratZeilen(t, inventory({ remaining_quantity: 250 }), 'nasal_spray', 'de')
    expect(zeilen.gross).toBe('my_stack_stock_container_spray_multiple(n=2,5)')
    expect(zeilen.klein).toBe('my_stack_stock_container_size(amount=my_stack_stock_unit_spray_multiple(n=100))')
  })

  it('ohne Behaeltergroesse bleibt es bei der Packungseinheit', () => {
    const zeilen = vorratZeilen(t, inventory({ package_quantity: null, remaining_quantity: 240 }), 'nasal_spray', 'de')
    expect(zeilen.gross).toBe('my_stack_stock_unit_spray_multiple(n=240)')
  })
})

describe('neuAnbrechenLabel bei fertiger Loesung', () => {
  it('bricht an statt zu rekonstituieren', () => {
    expect(neuAnbrechenLabel(t, 'vial', true)).toBe('my_stack_stock_open_new_vial')
    expect(neuAnbrechenLabel(t, 'vial')).toBe('my_stack_stock_mix_new')
  })
})

describe('neuAnbrechenLabel', () => {
  it('je Form ein eigenes Wort', () => {
    expect(neuAnbrechenLabel(t, 'vial')).toBe('my_stack_stock_mix_new')
    expect(neuAnbrechenLabel(t, 'pen')).toBe('my_stack_stock_open_new_pen')
    expect(neuAnbrechenLabel(t, 'nasal_spray')).toBe('my_stack_stock_open_new_spray')
    expect(neuAnbrechenLabel(t, 'spray')).toBe('my_stack_stock_open_new_spray')
    expect(neuAnbrechenLabel(t, 'drops')).toBe('my_stack_stock_open_new_bottle')
  })
})
