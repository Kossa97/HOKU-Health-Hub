import { describe, expect, it } from 'vitest'
import {
  amountValid, bmr, goalBand, groupByMeal, kcalFromMacros, macroMismatch, mealForHour, nutrientsFor,
  parseAmount, per100FromEntry, proteinReferenceKg, scaleNutrients, suggestGoals, sumNutrients, type LogEntry, type Per100,
} from './nutrition'

const oats: Per100 = { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7, fiber: 10, sugar: 1.2, salt: 0.02 }

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  id: '1', date: '2026-10-18', meal: 'breakfast', itemId: null, source: 'custom', sourceRef: null,
  name: 'Haferflocken', brand: null, unit: 'g', amount: 50, nutrients: nutrientsFor(oats, 50), createdAt: '', ...over,
})

describe('Eingabe', () => {
  it('Komma, Punkt, Leerzeichen', () => {
    expect(parseAmount('62,5')).toBe(62.5)
    expect(parseAmount(' 1 000 ')).toBe(1000)
    expect(parseAmount('300')).toBe(300)
  })
  it('Unsinn ergibt NaN', () => {
    for (const s of ['', 'abc', '-5', '1e3', '1,2,3', '2,']) expect(parseAmount(s)).toBeNaN()
  })
  it('Mengengrenzen', () => {
    expect(amountValid(0)).toBe(false)
    expect(amountValid(NaN)).toBe(false)
    expect(amountValid(5001)).toBe(false)
    expect(amountValid(0.5)).toBe(true)
  })
})

describe('Rechnen', () => {
  it('skaliert je 100 g auf die Menge', () => {
    expect(nutrientsFor(oats, 50)).toEqual({ kcal: 186, protein: 6.8, carbs: 29.4, fat: 3.5, fiber: 5, sugar: 0.6, salt: 0.01 })
  })
  it('unbekannt bleibt unbekannt (null statt 0)', () => {
    expect(nutrientsFor({ ...oats, fiber: null }, 50).fiber).toBeNull()
  })
  it('rechnet einen Eintrag auf 100 g zurück — auch ohne Rundungsdrift bei kleinen Mengen', () => {
    expect(per100FromEntry(entry())!.kcal).toBe(372)
    expect(per100FromEntry(entry({ amount: null }))).toBeNull()
  })
  it('Menge ändern skaliert den Schnappschuss mit einer Rundung (kein Umweg über gerundete 100-g-Werte)', () => {
    const n = { kcal: 1234.5, protein: 10, carbs: 0, fat: 3.3, fiber: 0.07, sugar: null, salt: 0.03 }
    expect(scaleNutrients(n, 1)).toMatchObject({ kcal: 1234.5, fat: 3.3 })
    expect(scaleNutrients(n, 40).fiber).toBe(2.8)
    expect(scaleNutrients(n, 2).sugar).toBeNull()
  })
  it('summiert; null nur, wenn kein Eintrag einen Wert kennt', () => {
    const a = nutrientsFor({ ...oats, fiber: null }, 100)
    expect(sumNutrients([a, a]).kcal).toBe(744)
    expect(sumNutrients([a, a]).fiber).toBeNull()
    expect(sumNutrients([a, nutrientsFor(oats, 100)]).fiber).toBe(10)
    expect(sumNutrients([])).toMatchObject({ kcal: 0, protein: 0 })
  })
  it('gruppiert nach Mahlzeit', () => {
    const g = groupByMeal([entry({ meal: 'lunch' }), entry({ meal: 'snack' }), entry({ meal: 'lunch' })])
    expect(g.lunch).toHaveLength(2)
    expect(g.breakfast).toHaveLength(0)
  })
  it('Mahlzeit nach Uhrzeit', () => {
    expect(mealForHour(7)).toBe('breakfast')
    expect(mealForHour(12)).toBe('lunch')
    expect(mealForHour(16)).toBe('snack')
    expect(mealForHour(19)).toBe('dinner')
    expect(mealForHour(2)).toBe('snack')
  })
})

describe('Datenqualität', () => {
  it('Atwater', () => {
    expect(kcalFromMacros({ protein: 10, carbs: 10, fat: 10 })).toBe(170)
  })
  it('erkennt Werte, die nicht zusammenpassen (z. B. kJ als kcal eingetragen)', () => {
    expect(macroMismatch({ kcal: 1556, protein: 13.5, carbs: 58.7, fat: 7 })).toBe(true)
    expect(macroMismatch({ kcal: 50, protein: 20, carbs: 40, fat: 30 })).toBe(true)
  })
  it('lässt normale und kalorienfreie Lebensmittel durch', () => {
    expect(macroMismatch(oats)).toBe(false)
    expect(macroMismatch({ kcal: 0, protein: 0, carbs: 0, fat: 0 })).toBe(false)
    // Cola light: 0,3 kcal ohne Makros
    expect(macroMismatch({ kcal: 0.3, protein: 0, carbs: 0, fat: 0 })).toBe(false)
  })
})

describe('Ziele', () => {
  it('Mifflin-St Jeor', () => {
    expect(bmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780)
    expect(bmr({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 })).toBe(1320)
  })
  it('Abnehmen: nie unter die Untergrenze', () => {
    expect(suggestGoals({ sex: 'female', weightKg: 45, heightCm: 150, age: 60, activity: 'sedentary', goal: 'lose' }).kcal).toBe(1200)
    expect(suggestGoals({ sex: 'male', weightKg: 55, heightCm: 160, age: 70, activity: 'sedentary', goal: 'lose' }).kcal).toBe(1500)
  })
  it('Makros ergeben ungefähr die Kalorien', () => {
    const g = suggestGoals({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activity: 'moderate', goal: 'maintain' })
    expect(Math.abs(g.proteinG * 4 + g.carbsG * 4 + g.fatG * 9 - g.kcal)).toBeLessThan(15)
  })
  it('Eiweiß auf Bezugsgewicht (höchstens BMI 27)', () => {
    expect(proteinReferenceKg(70, 180)).toBe(70)
    expect(proteinReferenceKg(130, 170)).toBeCloseTo(78.03, 1)
    expect(suggestGoals({ sex: 'female', weightKg: 130, heightCm: 170, age: 45, activity: 'light', goal: 'lose' }).proteinG).toBe(125)
  })
  it('Wasser in 250-ml-Schritten', () => {
    expect(suggestGoals({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activity: 'light', goal: 'maintain' }).waterMl).toBe(2750)
  })
  it('Zielbereich ±10 %', () => {
    expect(goalBand(1700, 2000)).toBe('under')
    expect(goalBand(1850, 2000)).toBe('within')
    expect(goalBand(2200, 2000)).toBe('within')
    expect(goalBand(2300, 2000)).toBe('over')
    expect(goalBand(100, 0)).toBe('under')
  })
})
