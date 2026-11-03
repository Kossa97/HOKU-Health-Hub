import { describe, expect, it } from 'vitest'
import { FEDER_GLEITEN, FEDER_LINSE, federSchritt } from './linsenFeder'

const lauf = (start: number, ziel: number, f = FEDER_GLEITEN, sek = 1.5) => {
  let x = start, v = 0, max = start
  for (let t = 0; t < sek; t += 1 / 60) { [x, v] = federSchritt(x, v, ziel, f, 1 / 60); max = Math.max(max, x) }
  return { x, v, max }
}

describe('federSchritt', () => {
  it('kommt am Ziel an und steht dort still', () => {
    const { x, v } = lauf(0, 100)
    expect(x).toBeCloseTo(100, 1)
    expect(Math.abs(v)).toBeLessThan(1)
  })

  it('schwingt beim Gleiten leicht über das Ziel hinaus', () => {
    const { max } = lauf(0, 100)
    expect(max).toBeGreaterThan(100)
    expect(max).toBeLessThan(115)
  })

  it('die Linse springt lebendig auf und beruhigt sich', () => {
    const { x, max } = lauf(0, 1, FEDER_LINSE)
    expect(max).toBeGreaterThan(1.02)
    expect(x).toBeCloseTo(1, 2)
  })
})
