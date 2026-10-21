import { describe, expect, it } from 'vitest'
import type { Per100 } from './nutrition'
import { nutritionScore, scoreLevel, scoreParts, scoreTone } from './rating'

const per = (p: Partial<Per100>): Per100 =>
  ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: null, sugar: null, satFat: null, salt: null, ...p })

describe('nutritionScore', () => {
  it('Skyr: kaum Minuspunkte, viel Eiweiß → 9,7', () => {
    expect(nutritionScore(per({ kcal: 63, protein: 11, carbs: 4, fat: 0.2, sugar: 4, satFat: 0.1, salt: 0.1 }))).toBe(9.7)
  })

  it('Pizza: ab 11 Minuspunkten zählt Eiweiß nicht mehr → 4,7', () => {
    // 1046 kJ → 3, ges. Fett 4,5 → 4, Salz 1,3 g = 520 mg Natrium → 5; Ballaststoffe 2 → 2.
    expect(nutritionScore(per({ kcal: 250, protein: 11, carbs: 30, fat: 9, sugar: 3.5, satFat: 4.5, salt: 1.3, fiber: 2 }))).toBe(4.7)
  })

  it('Schokolade landet knapp über 0', () => {
    expect(nutritionScore(per({ kcal: 550, protein: 7, carbs: 55, fat: 32, sugar: 50, satFat: 20, salt: 0.2, fiber: 3 }))).toBe(0.3)
  })

  it('bleibt zwischen 0 und 10', () => {
    expect(nutritionScore(per({ kcal: 20, protein: 20, fiber: 10, sugar: 0, satFat: 0, salt: 0 }))).toBe(10)
    expect(nutritionScore(per({ kcal: 900, sugar: 100, satFat: 60, salt: 20 }))).toBe(0)
  })

  it('Schwellen gelten ab „größer als“: genau 4,5 g Zucker gibt noch keinen Punkt', () => {
    const base = { kcal: 50, protein: 0, satFat: 0, salt: 0 }
    expect(nutritionScore(per({ ...base, sugar: 4.5 }))).toBe(nutritionScore(per({ ...base, sugar: 0 })))
    expect(nutritionScore(per({ ...base, sugar: 4.6 }))!).toBeLessThan(nutritionScore(per({ ...base, sugar: 0 }))!)
  })

  it('ohne Zucker, gesättigte Fette und Salz gibt es keine Punkte', () => {
    expect(nutritionScore(per({ kcal: 100, protein: 5, fiber: 3 }))).toBeNull()
  })

  it('fehlende gesättigte Fette zählen nur als 0, wenn das Fett insgesamt keinen Punkt brächte', () => {
    expect(nutritionScore(per({ kcal: 63, protein: 11, carbs: 4, fat: 0.2, sugar: 4, salt: 0.1 }))).toBe(9.7)
    // Butter aus der Zeit vor den gesättigten Fettsäuren: lieber keine Punkte als ein geschöntes Ergebnis.
    expect(nutritionScore(per({ kcal: 740, fat: 81, carbs: 0.6, sugar: 0.6, salt: 0.02 }))).toBeNull()
  })

  it('fehlender Zucker ebenso: bei wenig Kohlenhydraten 0, sonst keine Punkte', () => {
    expect(nutritionScore(per({ kcal: 110, protein: 23, carbs: 0, fat: 1.5, satFat: 0.4, salt: 0.15 }))).not.toBeNull()
    expect(nutritionScore(per({ kcal: 400, carbs: 70, fat: 5, satFat: 1, salt: 0.5 }))).toBeNull()
  })

  it('Getränke (ml) haben strengere Schwellen: Cola landet unten, Wasser oben', () => {
    const cola = per({ kcal: 42, carbs: 10.6, sugar: 10.6, salt: 0 })
    // 176 kJ → 6, 10,6 g Zucker → 8 (über 10,5): 14 Minuspunkte
    expect(nutritionScore(cola, 'ml')).toBe(3.3)
    expect(nutritionScore(cola, 'g')!).toBeGreaterThan(7)
    expect(nutritionScore(per({ sugar: 0, salt: 0 }), 'ml')).toBe(8)
  })
})

describe('scoreLevel / scoreTone', () => {
  it('fünf Stufen aus 0–10', () => {
    expect([9.7, 8, 7.9, 6, 5.9, 4, 3.9, 2, 1.9, 0].map(scoreLevel)).toEqual([5, 5, 4, 4, 3, 3, 2, 2, 1, 1])
  })

  it('Farbe je Stufe, ohne Rot', () => {
    expect(scoreTone(5)).toBe('good')
    expect(scoreTone(4)).toBe('good')
    expect(scoreTone(3)).toBe('mid')
    expect(scoreTone(2)).toBe('low')
    expect(scoreTone(1)).toBe('low')
  })
})

describe('scoreParts', () => {
  it('nennt die Teile der Rechnung — Pizza: Eiweiß zählt ab 11 Minuspunkten nicht', () => {
    expect(scoreParts(per({ kcal: 250, protein: 11, carbs: 30, fat: 9, sugar: 3.5, satFat: 4.5, salt: 1.3, fiber: 2 }))).toEqual({
      energy: 3, sugar: 0, satFat: 4, salt: 5, fiber: 2, protein: 5, proteinCounts: false,
    })
  })

  it('ohne genug Angaben: null (wie nutritionScore)', () => {
    expect(scoreParts(per({ kcal: 100, protein: 5, fiber: 3 }))).toBeNull()
  })
})
