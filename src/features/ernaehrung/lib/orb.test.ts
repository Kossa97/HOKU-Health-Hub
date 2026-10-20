import { describe, expect, it } from 'vitest'
import { DEFAULT_GOALS } from './nutrition'
import { dotScale, fill, fillChange, gramText, orbLayout, spherePoints } from './orb'

describe('spherePoints', () => {
  it('liegen auf der Einheitskugel, oben beginnend, und werden zwischengespeichert', () => {
    const p = spherePoints(500)
    expect(p).toHaveLength(2000)
    for (let i = 0; i < 500; i += 37) expect(Math.hypot(p[i * 4], p[i * 4 + 1], p[i * 4 + 2])).toBeCloseTo(1, 5)
    expect(p[1]).toBeGreaterThan(0.99)
    expect(p[499 * 4 + 1]).toBeLessThan(-0.99)
    expect(spherePoints(500)).toBe(p)
  })
})

describe('fill', () => {
  it('füllt nach Anteil, darüber Hülle bis zum doppelten Ziel', () => {
    expect(fill(3000, 0)).toEqual({ filled: 0, extra: 0 })
    expect(fill(3000, 0.5)).toEqual({ filled: 1500, extra: 0 })
    expect(fill(3000, 1.25)).toEqual({ filled: 3000, extra: 750 })
    expect(fill(3000, 5)).toEqual({ filled: 3000, extra: 3000 })
  })

  it('negative, unendliche oder fehlende Werte ergeben eine leere Kugel', () => {
    expect(fill(100, -0.2)).toEqual({ filled: 0, extra: 0 })
    expect(fill(100, Number.NaN)).toEqual({ filled: 0, extra: 0 })
    expect(fill(100, Number.POSITIVE_INFINITY)).toEqual({ filled: 0, extra: 0 })
  })
})

describe('orbLayout', () => {
  const day = { kcal: 1000, protein: 55, carbs: 230, fat: 97.5 }

  it('1 Punkt = 1 kcal bis 4000, darüber mehrere; Monde 1 Punkt = 1 g', () => {
    const l = orbLayout(day, DEFAULT_GOALS)
    expect(l.main).toMatchObject({ key: 'kcal', n: 2000, unit: 1, fill: { filled: 1000, extra: 0 } })
    expect(l.moons.map(m => [m.key, m.n, m.fill.filled, m.fill.extra])).toEqual([
      ['protein', 110, 55, 0], ['carbs', 230, 230, 0], ['fat', 65, 65, 33],
    ])
    const big = orbLayout(day, { ...DEFAULT_GOALS, kcal: 6000 })
    expect(big.main).toMatchObject({ n: 4000, unit: 1.5 })
  })

  it('Monde gleich dicht wie die große Kugel: Radius = √(Punkte / Kugelpunkte), begrenzt', () => {
    const l = orbLayout(day, DEFAULT_GOALS)
    expect(l.moons[1].r).toBeCloseTo(Math.sqrt(230 / 2000), 5)
    expect(l.moons[0].r).toBeCloseTo(Math.sqrt(110 / 2000), 5)
    expect(orbLayout(day, { ...DEFAULT_GOALS, fatG: 1 }).moons[2]).toMatchObject({ n: 1, unit: 1, r: 0.12 })
  })

  it('Kalorien ausgeblendet: Eiweiß ist die große Kugel, Monde nur Kohlenhydrate und Fett', () => {
    const l = orbLayout(day, { ...DEFAULT_GOALS, hideKcal: true })
    expect(l.main).toMatchObject({ key: 'protein', n: 1500, fill: { filled: 750, extra: 0 } })
    expect(l.moons.map(m => m.key)).toEqual(['carbs', 'fat'])
  })

  it('ein Makro ohne Ziel hat keinen Mond', () => {
    expect(orbLayout(day, { ...DEFAULT_GOALS, carbsG: 0 }).moons.map(m => m.key)).toEqual(['protein', 'fat'])
  })
})

describe('dotScale', () => {
  it('kleiner bei vielen Punkten, begrenzt', () => {
    expect(dotScale(3000)).toBe(1)
    expect(dotScale(4000)).toBeCloseTo(0.866, 3)
    expect(dotScale(100)).toBe(1.15)
    expect(dotScale(100000)).toBe(0.8)
  })
})

describe('fillChange', () => {
  it('Plätze und Hülle zwischen zwei Ständen, mit Richtung', () => {
    expect(fillChange({ filled: 100, extra: 0 }, { filled: 100, extra: 0 })).toBeNull()
    expect(fillChange({ filled: 100, extra: 0 }, { filled: 160, extra: 0 })).toEqual({ from: 100, to: 160, extra: 0, grew: true })
    expect(fillChange({ filled: 180, extra: 0 }, { filled: 200, extra: 30 })).toEqual({ from: 180, to: 200, extra: 30, grew: true })
    expect(fillChange({ filled: 200, extra: 30 }, { filled: 150, extra: 0 })).toEqual({ from: 150, to: 200, extra: 30, grew: false })
  })
})

describe('gramText', () => {
  it('Überschuss als Zahl', () => {
    expect(gramText(64.4, 150)).toBe('64 / 150 g')
    expect(gramText(180, 150)).toBe('180 / 150 g · +30')
  })
})
