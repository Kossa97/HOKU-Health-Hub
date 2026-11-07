import { describe, expect, it } from 'vitest'
import { parseMicros, scaleMicros, sumMicros } from './micros'

describe('parseMicros', () => {
  it('nur bekannte, gültige Werte; leer → null', () => {
    expect(parseMicros({ vitD: 3.8, x: 1, fe: -1, ca: '44', mg: 'abc' })).toEqual({ vitD: 3.8, ca: 44 })
    expect(parseMicros({})).toBeNull()
    expect(parseMicros(null)).toBeNull()
    expect(parseMicros([1, 2])).toBeNull()
  })
})

describe('scaleMicros', () => {
  it('skaliert und rundet auf 4 Stellen; 0 bleibt 0', () => {
    expect(scaleMicros({ vitD: 3.8, b6: 0.55, chol: 0 }, 1.5)).toEqual({ vitD: 5.7, b6: 0.825, chol: 0 })
    expect(scaleMicros({ k: 381.927 }, 0.4)).toEqual({ k: 152.8 })
    expect(scaleMicros(null, 2)).toBeNull()
  })
})

describe('sumMicros', () => {
  it('summiert und zählt, wie viele Einträge einen Wert hatten', () => {
    const r = sumMicros([{ vitD: 1, i: 5 }, null, { vitD: 2.5 }])
    expect(r.total).toEqual({ vitD: 3.5, i: 5 })
    expect(r.count).toEqual({ vitD: 2, i: 1 })
  })
})
