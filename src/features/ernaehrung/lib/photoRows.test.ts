import { describe, expect, it } from 'vitest'
import type { Food } from './nutrition'
import { chooseFood, chosenRows, rowsFromItems } from './photoRows'

const quark: Food = {
  itemId: 'q1', source: 'custom', sourceRef: null, barcode: null, name: 'Magerquark', brand: null, unit: 'g',
  per100: { kcal: 68, protein: 12, carbs: 4, fat: 0.3, fiber: null, sugar: null, salt: null }, serving: null, favorite: false,
}

describe('photoRows', () => {
  it('macht aus erkannten Namen offene Zeilen; „low" heißt unsicher', () => {
    const rows = rowsFromItems([{ name: 'Magerquark, natur', search: 'Magerquark', confidence: 'high' }, { name: 'Beeren', confidence: 'low' }])
    expect(rows).toMatchObject([
      { name: 'Magerquark, natur', search: 'Magerquark', unsure: false, food: null, amount: null },
      { name: 'Beeren', search: 'Beeren', unsure: true, food: null, amount: null },
    ])
    expect(rows[0].id).not.toBe(rows[1].id)
  })

  it('setzt Lebensmittel und Menge in die gewählte Zeile oder hängt eine neue an', () => {
    const rows = rowsFromItems([{ name: 'Quark', confidence: 'high' }, { name: 'Beeren', confidence: 'low' }])
    const one = chooseFood(rows, 0, quark, 250)
    expect(one[0]).toMatchObject({ name: 'Quark', food: quark, amount: 250 })
    expect(one[1].food).toBeNull()
    expect(chooseFood(one, null, quark, 50)).toHaveLength(3)
  })

  it('trägt nur zugeordnete Zeilen ein', () => {
    const rows = chooseFood(rowsFromItems([{ name: 'Quark', confidence: 'high' }, { name: 'Beeren', confidence: 'low' }]), 0, quark, 250)
    expect(chosenRows(rows)).toEqual([{ food: quark, amount: 250 }])
  })
})
