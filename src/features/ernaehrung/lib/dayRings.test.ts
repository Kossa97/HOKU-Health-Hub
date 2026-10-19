import { describe, expect, it } from 'vitest'
import { DEFAULT_GOALS } from './nutrition'
import { addTotals, dayRings, monthGrid, monthRange, weekDays, weekRange } from './dayRings'

describe('dayRings', () => {
  it('außen Kalorien, dann Eiweiß, Kohlenhydrate, Fett — Anteil am Ziel, höchstens voll', () => {
    const rings = dayRings({ kcal: 1000, protein: 220, carbs: 0, fat: 32.5 }, DEFAULT_GOALS)
    expect(rings).toEqual([
      { key: 'kcal', fraction: 0.5 },
      { key: 'protein', fraction: 1 },
      { key: 'carbs', fraction: 0 },
      { key: 'fat', fraction: 0.5 },
    ])
  })

  it('Kalorien ausgeblendet: kein Kalorienring', () => {
    const rings = dayRings({ kcal: 1000, protein: 55, carbs: 0, fat: 0 }, { ...DEFAULT_GOALS, hideKcal: true })
    expect(rings.map(r => r.key)).toEqual(['protein', 'carbs', 'fat'])
  })

  it('Ziel 0 oder negative Summe (nach Löschen gerundet) ergibt einen leeren Ring', () => {
    const rings = dayRings({ kcal: -0.1, protein: 10, carbs: 0, fat: 0 }, { ...DEFAULT_GOALS, proteinG: 0 })
    expect(rings.slice(0, 2).map(r => r.fraction)).toEqual([0, 0])
  })
})

describe('addTotals', () => {
  it('addiert und zieht ab, nur die vier Summen', () => {
    const a = { kcal: 100, protein: 10, carbs: 5, fat: 2 }
    expect(addTotals(a, { kcal: 50, protein: 5, carbs: 1, fat: 1, fiber: 3 } as never)).toEqual({ kcal: 150, protein: 15, carbs: 6, fat: 3 })
    expect(addTotals(a, a, -1)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })
})

describe('Wochen und Monate', () => {
  it('Woche Mo–So, auch über den Monatswechsel', () => {
    expect(weekDays('2026-10-01')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(weekDays('2026-10-18')[0]).toBe('2026-10-12') // Sonntag gehört zur Woche davor
    expect(weekRange('2026-10-19')).toEqual({ from: '2026-10-19', to: '2026-10-25' })
  })

  it('Monatsraster: Lücken bis zum Wochentag des 1., dann alle Tage', () => {
    const grid = monthGrid('2026-10-19') // 1.10.2026 ist ein Donnerstag
    expect(grid.slice(0, 4)).toEqual([null, null, null, '2026-10-01'])
    expect(grid.filter(Boolean)).toHaveLength(31)
    expect(monthGrid('2026-06-01')[0]).toBe('2026-06-01') // 1.6.2026 ist ein Montag
    expect(monthRange('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
})
