import { describe, expect, test } from 'vitest'
import { blaseZu } from './liquidBubbles'

describe('Bläschen der Zeichenfläche (wie tyd-liquid-bubble)', () => {
  const b = { dur: 5, phase: 0 }
  test('steigt von 192 nach 30 über die Dauer', () => {
    expect(blaseZu(b, 0).y).toBeCloseTo(192)
    expect(blaseZu(b, 2.5).y).toBeCloseTo(111)
    expect(blaseZu(b, 4.999).y).toBeCloseTo(30, 0)
  })
  test('blendet bis 18 % ein, bleibt halb sichtbar, blendet ab 72 % aus', () => {
    expect(blaseZu(b, 0).deckkraft).toBe(0)
    expect(blaseZu(b, 0.45).deckkraft).toBeCloseTo(0.25)
    expect(blaseZu(b, 2.5).deckkraft).toBe(0.5)
    expect(blaseZu(b, 4.3).deckkraft).toBeCloseTo(0.25)
  })
  test('die Phase verschiebt den Start wie die negative Verzögerung im CSS', () => {
    expect(blaseZu({ dur: 5, phase: 0.5 }, 0).y).toBeCloseTo(blaseZu(b, 2.5).y)
  })
})
