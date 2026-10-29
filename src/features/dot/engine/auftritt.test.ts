import { describe, expect, it } from 'vitest'
import { AUFTRITT, flugPunkt, flugWerte, stoss } from './auftritt'

const knopf = { left: 30, top: 548, width: 330, height: 48 }

describe('Auftritt: Flug um den Knopf', () => {
  it('flugPunkt ist stetig: in 1/240 s kaum Weg, nie ein Sprung', () => {
    const F = flugWerte(0.4)
    let a = flugPunkt(knopf, F, 0)
    for (let t = 1 / 240; t < 4; t += 1 / 240) {
      const b = flugPunkt(knopf, F, t)
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(8)
      a = b
    }
  })

  it('bleibt in einem Band um den Knopf, z zwischen −1 und 1', () => {
    const F = flugWerte(2.1)
    for (let t = 0; t < 4; t += 0.01) {
      const p = flugPunkt(knopf, F, t)
      expect(p.x).toBeGreaterThan(knopf.left - 25)
      expect(p.x).toBeLessThan(knopf.left + knopf.width + 25)
      expect(Math.abs(p.y - (knopf.top + knopf.height / 2))).toBeLessThan(knopf.height / 2 + 40)
      expect(Math.abs(p.z)).toBeLessThanOrEqual(1)
    }
  })

  it('zwei Saaten fliegen verschieden', () => {
    const a = flugPunkt(knopf, flugWerte(0.4), 1.3), b = flugPunkt(knopf, flugWerte(2.1), 1.3)
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1)
  })
})

describe('Auftritt: Klopfen an die Scheibe', () => {
  it('drei Stöße bis zur Nähe NAH, dazwischen und am Ende zurück', () => {
    expect(stoss(0).skala).toBeCloseTo(1, 2)
    const spitzen = AUFTRITT.stoesse.map(s => stoss(s + AUFTRITT.stossHin * 0.999).skala)
    for (const sp of spitzen) expect(sp).toBeGreaterThan(AUFTRITT.nah * 0.95)
    expect(stoss(AUFTRITT.klopfen).skala).toBeCloseTo(1, 1)
  })

  it('beim Aufprall gestaucht, sonst rund', () => {
    const s0 = AUFTRITT.stoesse[0] + AUFTRITT.stossHin
    expect(stoss(s0 + 0.005).quetsch).toBeGreaterThan(0.8)
    expect(stoss(0.1).quetsch).toBe(0)
  })
})
