import { describe, expect, it } from 'vitest'
import { dayNutrients, formatAmount, gapsOf, nutrientStatus, parseOwnGoals, referenceValue, targetFor } from './nutrientTargets'

const man = { sex: 'male' as const, age: 34, kcal: 2000 }
const woman = { sex: 'female' as const, age: 34, kcal: 2000 }

describe('referenceValue', () => {
  it('nach Geschlecht und Alter (DGE)', () => {
    expect(referenceValue('fe', man)).toBe(11)
    expect(referenceValue('fe', woman)).toBe(16)
    expect(referenceValue('fe', { ...woman, age: 55 })).toBe(14)
    expect(referenceValue('i', { ...man, age: 60 })).toBe(180)
    expect(referenceValue('vitD', woman)).toBe(20)
  })
  it('ohne Geschlecht der höhere Wert', () => expect(referenceValue('fe', { sex: null, age: null, kcal: 2000 })).toBe(16))
  it('Grenzen aus dem Kalorienziel', () => {
    expect(referenceValue('sugar', man)).toBe(50)
    expect(referenceValue('satFat', man)).toBe(22)
    expect(referenceValue('trans', man)).toBe(2.2)
    expect(referenceValue('omega3', { ...man, kcal: 2500 })).toBe(1.4)
  })
})

describe('eigene Ziele', () => {
  it('ersetzen den Richtwert', () => {
    expect(targetFor('vitD', man, { vitD: 50 })).toEqual({ value: 50, own: true })
    expect(targetFor('vitD', man, {})).toEqual({ value: 20, own: false })
  })
  it('Unbekanntes und Unsinn fallen weg', () => expect(parseOwnGoals({ vitD: 50, x: 1, fe: -2, zn: '9' })).toEqual({ vitD: 50 }))
})

describe('nutrientStatus', () => {
  const day = dayNutrients([
    { fiber: 10, sugar: 45, salt: 2, satFat: 5, micros: { vitD: 2, vitC: 120, i: 50 } },
    { fiber: 8, sugar: 0, salt: 1, satFat: 3, micros: { vitD: 1, vitC: 10 } },
  ])
  it('summiert und zählt bekannte Werte', () => {
    expect(day.total.fiber).toBe(18)
    expect(day.count.i).toBe(1)
    expect(day.entries).toBe(2)
  })
  it('Lücken erst, wenn der Tag weit genug ist; Grenzen sind nie Lücken', () => {
    const early = nutrientStatus(day, man, {}, false)
    expect(gapsOf(early)).toEqual([])
    const done = nutrientStatus(day, man, {}, true)
    const byId = Object.fromEntries(done.map(s => [s.def.id, s]))
    expect(byId.vitD.state).toBe('gap')
    // Ballaststoffe 18 von 30 g = 60 %: knapp, keine Lücke (Lücken erst unter der Hälfte).
    expect(byId.fiber.state).toBe('low')
    expect(byId.vitC.state).toBe('full')
    expect(byId.sugar.state).toBe('near')
    // Jod kennt nur einer von zwei Einträgen — reicht (≥ 50 %); Selen kennt keiner → wenig Daten, keine Lücke.
    expect(byId.i.lowData).toBe(false)
    expect(byId.se.lowData).toBe(true)
    expect(byId.se.state).toBe('low')
    expect(gapsOf(done).map(s => s.def.id).slice(0, 2)).toEqual(['vitD', 'i'])
  })
})

describe('formatAmount', () => {
  it('sinnvolle Stellen', () => {
    expect(formatAmount(0.428, 'de')).toBe('0,43')
    expect(formatAmount(7.62, 'de')).toBe('7,6')
    expect(formatAmount(95.4, 'de')).toBe('95')
    expect(formatAmount(3200, 'de')).toBe('3200')
  })
})
