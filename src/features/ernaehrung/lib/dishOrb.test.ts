import { describe, expect, it } from 'vitest'
import type { Per100 } from './nutrition'
import type { Ingredient } from './recipe'
import { type DishDraft, draftFromIngredients } from './dishDraft'
import { dishDots, dishOrbModel } from './dishOrb'

const per = (kcal: number, protein: number, carbs: number, fat: number): Per100 =>
  ({ kcal, protein, carbs, fat, fiber: null, sugar: null, satFat: null, salt: null })
const ing = (name: string, amount: number, p: Per100): Ingredient => ({ name, brand: null, source: 'custom', sourceRef: null, unit: 'g', amount, per100: p })

const oats = ing('Haferflocken', 80, per(372, 13.5, 58.7, 7)) // 297,6 kcal
const quark = ing('Magerquark', 200, per(67, 12, 4, 0.2)) // 134 kcal

describe('dishOrbModel', () => {
  it('rechnet je Portion und vergibt die Plätze von unten nach Zutaten', () => {
    const m = dishOrbModel(draftFromIngredients([oats, quark], 'de', undefined, null))
    expect(m.portions).toBe(1)
    expect(m.portion.kcal).toBeCloseTo(431.6, 1)
    expect(m.parts).toEqual([{ from: 0, to: 298 }, { from: 298, to: 432 }])
  })

  it('teilt durch die Portionen; ungültige Portionen zählen als 1, solange getippt wird', () => {
    const d = draftFromIngredients([oats, quark], 'de')
    expect(dishOrbModel({ ...d, portions: '2' }).portion.kcal).toBeCloseTo(215.8, 1)
    expect(dishOrbModel({ ...d, portions: '2' }).parts[1]).toEqual({ from: 149, to: 216 })
    expect(dishOrbModel({ ...d, portions: '' }).portions).toBe(1)
    expect(dishOrbModel({ ...d, portions: '' }, 4).portions).toBe(4) // zuletzt gültige Zahl
  })

  it('Punkte-Grundlage: ganzes Gericht je 100 g aus den Zutaten mit gültiger Menge', () => {
    const d = draftFromIngredients([oats, quark], 'de')
    expect(dishOrbModel(d).per100?.kcal).toBeCloseTo(431.6 / 2.8, 1)
    expect(dishOrbModel({ ...d, items: [] }).per100).toBeNull()
  })

  it('Zutaten ohne gültige Menge zählen nicht, behalten aber ihren (leeren) Platz', () => {
    const d: DishDraft = draftFromIngredients([oats, quark], 'de')
    const m = dishOrbModel({ ...d, items: [{ ...d.items[0], text: 'abc' }, d.items[1]] })
    expect(m.portion.kcal).toBe(134)
    expect(m.parts).toEqual([{ from: 0, to: 0 }, { from: 0, to: 134 }])
  })

  it('ohne Zutaten: leer', () => {
    const m = dishOrbModel(draftFromIngredients([], 'de'))
    expect(m.portion.kcal).toBe(0)
    expect(m.parts).toEqual([])
  })
})

describe('dishDots', () => {
  it('1 Punkt je kcal, höchstens 4000', () => {
    expect(dishDots(431.6)).toBe(432)
    expect(dishDots(-3)).toBe(0)
    expect(dishDots(9000)).toBe(4000)
  })
})
