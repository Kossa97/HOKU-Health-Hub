import { describe, expect, it } from 'vitest'
import type { Food } from './nutrition'
import { candidatesFrom, chooseFood, chosenRows, groupCandidates, rowsFromSelection } from './photoRows'

const food = (name: string): Food => ({
  itemId: name, source: 'custom', sourceRef: null, barcode: null, name, brand: null, unit: 'g',
  per100: { kcal: 100, protein: 1, carbs: 1, fat: 1, fiber: null, sugar: null, satFat: null, salt: null }, serving: null, favorite: false,
})

const soup = candidatesFrom([
  { name: 'Kürbis', kind: 'visible' },
  { name: 'Zwiebel', kind: 'usual' },
  { name: 'Sahne', kind: 'alternative', group: 'Für die Cremigkeit' },
  { name: 'Kokosmilch', search: 'Kokosmilch', kind: 'alternative', group: 'Für die Cremigkeit' },
  { name: 'Ingwer', kind: 'optional' },
])

describe('Auswahl', () => {
  it('wählt Sicheres und Übliches vor, Alternativen und Optionales nicht', () => {
    expect(soup.map(c => [c.name, c.selected])).toEqual([['Kürbis', true], ['Zwiebel', true], ['Sahne', false], ['Kokosmilch', false], ['Ingwer', false]])
    expect(soup[0].search).toBe('Kürbis')
  })

  it('gruppiert Alternativen nach ihrer Rolle', () => {
    const g = groupCandidates(soup)
    expect(g.core.map(c => c.name)).toEqual(['Kürbis', 'Zwiebel'])
    expect(g.groups).toEqual([{ label: 'Für die Cremigkeit', items: [soup[2], soup[3]] }])
    expect(g.optional.map(c => c.name)).toEqual(['Ingwer'])
  })
})

describe('Zuordnung', () => {
  it('macht aus der Auswahl Zeilen und behält Zugeordnetes und Ergänztes beim Zurückgehen', () => {
    const picked = soup.map(c => (c.name === 'Kokosmilch' ? { ...c, selected: true } : c))
    let rows = rowsFromSelection(picked, null)
    expect(rows.map(r => r.name)).toEqual(['Kürbis', 'Zwiebel', 'Kokosmilch'])
    rows = chooseFood(rows, 0, food('Hokkaido'), 400)
    rows = chooseFood(rows, null, food('Salz'), 2)
    // zurück zur Auswahl, Zwiebel abwählen, wieder vor
    const again = rowsFromSelection(picked.map(c => (c.name === 'Zwiebel' ? { ...c, selected: false } : c)), rows)
    expect(again.map(r => [r.name, r.amount])).toEqual([['Kürbis', 400], ['Kokosmilch', null], ['Salz', 2]])
  })

  it('trägt nur zugeordnete Zeilen ein', () => {
    const rows = chooseFood(rowsFromSelection(soup, null), 0, food('Hokkaido'), 400)
    expect(chosenRows(rows)).toEqual([{ food: food('Hokkaido'), amount: 400 }])
  })
})
