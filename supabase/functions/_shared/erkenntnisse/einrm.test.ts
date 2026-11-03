import { describe, expect, it } from 'vitest'
import { einRM } from './detektoren.ts'
// Einzige Ausnahme von „nur relative Importe“: pinnt die Formel an die der App.
import { estimateOneRepMax } from '../../../../src/features/training/lib/stats'

describe('erkenntnisse: einRM stimmt mit der App überein', () => {
  const faelle: [number, number][] = [[100, 1], [100, 5], [80, 12], [80, 13], [0, 5], [62.5, 8], [100, 0]]
  for (const [w, r] of faelle) {
    it(`${w} kg x ${r}`, () => {
      expect(einRM(w, r)).toBe(estimateOneRepMax(w, r))
    })
  }
  it('fehlende Werte ergeben null', () => {
    expect(einRM(null, 5)).toBeNull()
    expect(einRM(100, undefined)).toBeNull()
  })
})
