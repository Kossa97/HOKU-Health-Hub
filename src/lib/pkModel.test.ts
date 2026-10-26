import { describe, expect, it } from 'vitest'
import {
  absorptionRateForTmax,
  fractionEliminatedPerHour,
  pkRates,
  singleDoseLevel,
  tmaxForRates,
} from './pkModel'

function numericPeakHour(halfLife: number, tmax: number): number {
  const rates = pkRates(halfLife, tmax)!
  let best = 0
  let bestT = 0
  for (let t = 0.001; t < halfLife * 10 + tmax * 5; t += 0.001 * Math.max(1, tmax)) {
    const level = singleDoseLevel(1, 1, t, rates)
    if (level > best) { best = level; bestT = t }
  }
  return bestT
}

describe('pkModel', () => {
  it.each([
    // [t½, tmax] — schnelle Resorption, Flip-Flop, Grenzfall ka = ke
    [2, 0.5],
    [24, 2],
    [165, 56],    // Semaglutid-artig
    [4, 12],      // tmax laenger als 1/ke → ka < ke
    [Math.LN2 * 10, 10], // tmax = 1/ke exakt
  ])('legt den Peak bei t½=%s h auf tmax=%s h', (halfLife, tmax) => {
    const rates = pkRates(halfLife, tmax)!
    expect(tmaxForRates(rates)).toBeCloseTo(tmax, 6)
    expect(numericPeakHour(halfLife, tmax)).toBeCloseTo(tmax, 1)
  })

  it.each([[165, 56], [2, 0.5]])('korrigiert den zu spaeten Peak von ka = ln2/tmax (t½=%s h, tmax=%s h)', (halfLife, tmax) => {
    const ke = Math.LN2 / halfLife
    // Der alte Ansatz legte den Peak mehr als doppelt so spaet wie angegeben.
    expect(tmaxForRates({ ke, ka: Math.LN2 / tmax })).toBeGreaterThan(tmax * 2)
    expect(tmaxForRates({ ke, ka: absorptionRateForTmax(tmax, ke) })).toBeCloseTo(tmax, 6)
  })

  it('lehnt unbrauchbare Profile ab', () => {
    expect(pkRates(0, 2)).toBeNull()
    expect(pkRates(2, 0)).toBeNull()
    expect(pkRates(Number.NaN, 2)).toBeNull()
    expect(pkRates(2, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('liefert vor der Gabe nichts und skaliert mit Menge und F', () => {
    const rates = pkRates(8, 1)!
    expect(singleDoseLevel(10, 1, 0, rates)).toBe(0)
    expect(singleDoseLevel(10, 1, -1, rates)).toBe(0)
    expect(singleDoseLevel(10, 0.5, 3, rates)).toBeCloseTo(singleDoseLevel(5, 1, 3, rates), 12)
  })

  it('rechnet den Abbau pro Stunde als 1 − e^(−ke)', () => {
    expect(fractionEliminatedPerHour(1)).toBeCloseTo(0.5, 12)
    expect(fractionEliminatedPerHour(6.93)).toBeCloseTo(1 - Math.exp(-Math.LN2 / 6.93), 12)
  })
})
