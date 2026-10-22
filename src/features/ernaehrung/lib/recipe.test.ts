import { describe, expect, it } from 'vitest'
import { nutrientsFor, type LogEntry, type Per100 } from './nutrition'
import { type Ingredient, ingredientFromEntry, parseIngredients, recipeFood, recipeTotals } from './recipe'

const per = (kcal: number, protein: number, carbs: number, fat: number, extra: Partial<Per100> = {}): Per100 =>
  ({ kcal, protein, carbs, fat, fiber: null, sugar: null, satFat: null, salt: null, ...extra })

const oats: Ingredient = { name: 'Haferflocken', brand: null, source: 'custom', sourceRef: null, unit: 'g', amount: 60, per100: per(372, 13.5, 58.7, 7, { fiber: 10 }) }
const skyr: Ingredient = { name: 'Skyr', brand: 'Ehrmann', source: 'off', sourceRef: '4002671157751', unit: 'g', amount: 150, per100: per(63, 11, 4, 0.2) }
const milk: Ingredient = { name: 'Milch', brand: null, source: 'custom', sourceRef: null, unit: 'ml', amount: 140, per100: per(64, 3.4, 4.8, 3.5) }

describe('recipeTotals', () => {
  it('summiert Gewicht (ml wie g) und Nährwerte der Zutaten', () => {
    const { weight, nutrients } = recipeTotals([oats, skyr, milk])
    expect(weight).toBe(350)
    // 60 g Hafer 223,2 + 150 g Skyr 94,5 + 140 ml Milch 89,6
    expect(nutrients.kcal).toBe(407.3)
    expect(nutrients.protein).toBe(29.4)
    expect(nutrients.fiber).toBe(6) // nur Hafer kennt Ballaststoffe
  })
})

describe('recipeFood', () => {
  it('rechnet Werte je 100 g und eine Portion aus — eine Portion hat die Werte der halben Summe', () => {
    const food = recipeFood({ itemId: null, name: ' Overnight Oats ', portions: 2, ingredients: [oats, skyr, milk], favorite: false })!
    expect(food.name).toBe('Overnight Oats')
    expect(food.unit).toBe('g')
    expect(food.serving).toEqual({ amount: 175, label: null })
    expect(food.recipe?.portions).toBe(2)
    const portion = nutrientsFor(food.per100, food.serving!.amount)
    expect(portion.kcal).toBeCloseTo(407.3 / 2, 0)
    expect(portion.protein).toBeCloseTo(29.4 / 2, 0)
  })

  it('lehnt Gerichte ohne Gewicht, mit ungültigen Portionen oder zu schwerer Portion ab', () => {
    expect(recipeFood({ itemId: null, name: 'x', portions: 1, ingredients: [], favorite: false })).toBeNull()
    expect(recipeFood({ itemId: null, name: 'x', portions: 0, ingredients: [oats], favorite: false })).toBeNull()
    expect(recipeFood({ itemId: null, name: 'x', portions: 51, ingredients: [oats], favorite: false })).toBeNull()
    expect(recipeFood({ itemId: null, name: 'x', portions: 0.04, ingredients: [oats], favorite: false })).toBeNull()
    // Gespeichert wird auf zwei Stellen — die Portion passt dazu
    expect(recipeFood({ itemId: null, name: 'x', portions: 1.256, ingredients: [oats], favorite: false })?.recipe?.portions).toBe(1.26)
    const big = { ...oats, amount: 3000 }
    expect(recipeFood({ itemId: null, name: 'x', portions: 1, ingredients: [big, big], favorite: false })).toBeNull()
    expect(recipeFood({ itemId: null, name: 'x', portions: 2, ingredients: [big, big], favorite: false })?.serving?.amount).toBe(3000)
  })
})

describe('ingredientFromEntry', () => {
  const entry = (fields: Partial<LogEntry>): LogEntry => ({
    id: '1', date: '2026-10-18', meal: 'breakfast', itemId: null, source: 'off', sourceRef: '4002671157751',
    name: 'Skyr', brand: 'Ehrmann', unit: 'g', amount: 200,
    nutrients: { kcal: 126, protein: 22, carbs: 8, fat: 0.4, fiber: null, sugar: 8, satFat: null, salt: 0.2 }, createdAt: '', ...fields,
  })

  it('macht aus einem Eintrag eine Zutat mit Werten je 100 g', () => {
    expect(ingredientFromEntry(entry({}))).toMatchObject({ name: 'Skyr', amount: 200, per100: { kcal: 63, protein: 11, salt: 0.1 } })
  })

  it('übergeht Schnelleinträge', () => {
    expect(ingredientFromEntry(entry({ source: 'quick', amount: null }))).toBeNull()
  })
})

describe('parseIngredients', () => {
  it('liest gespeicherte Zutaten und lässt Kaputtes weg', () => {
    expect(parseIngredients(null)).toBeNull()
    expect(parseIngredients('x')).toBeNull()
    const list = parseIngredients([oats, { name: 'ohne Menge', per100: { kcal: 1 } }, 'Unsinn', { ...skyr, source: 'fremd', unit: 'kg' }])!
    expect(list.map(i => i.name)).toEqual(['Haferflocken', 'Skyr'])
    expect(list[1]).toMatchObject({ source: 'custom', unit: 'g', per100: { kcal: 63, fiber: null } })
  })
})
