import { describe, expect, it } from 'vitest'
import { releaseVelocity } from './gesture'

describe('releaseVelocity', () => {
  it('Tempo aus den letzten 100 ms', () => {
    expect(releaseVelocity([{ x: 0, t: 0 }, { x: 100, t: 200 }, { x: 150, t: 250 }], 260)).toBe(1000)
  })

  it('Pause vor dem Loslassen: kein Schwung', () => {
    expect(releaseVelocity([{ x: 0, t: 0 }, { x: 80, t: 40 }], 1040)).toBe(0)
  })

  it('ein Punkt oder keiner: 0', () => {
    expect(releaseVelocity([{ x: 5, t: 10 }], 20)).toBe(0)
    expect(releaseVelocity([], 20)).toBe(0)
  })
})
