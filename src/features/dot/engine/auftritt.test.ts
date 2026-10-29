import { describe, expect, it } from 'vitest'
import { AUFTRITT, randAbstand, ringPunkt, runde, stoss } from './auftritt'

const knopf = { left: 30, top: 436, width: 330, height: 48 }

describe('Auftritt: Runde um den Knopf (K4, wie an der Uhr)', () => {
  it('ringPunkt: flacher Ring um den Knopf, vorn unten, hinten oben', () => {
    const links = ringPunkt(knopf, 0), vorn = ringPunkt(knopf, 0.25), hinten = ringPunkt(knopf, 0.75)
    expect(links.x).toBeLessThan(knopf.left)
    expect(vorn.z).toBeCloseTo(1, 5)
    expect(vorn.y).toBeGreaterThan(knopf.top + knopf.height / 2)
    expect(hinten.z).toBeCloseTo(-1, 5)
    expect(hinten.y).toBeLessThan(knopf.top + knopf.height / 2)
  })

  it('runde: zwei Runden, weich am Anfang und Ende, am Ende wieder am Start', () => {
    expect(runde(0)).toBe(0)
    expect(runde(AUFTRITT.runde)).toBeCloseTo(AUFTRITT.runden, 5)
    // weich: in den ersten 5 % der Zeit weniger als 2 % des Wegs
    expect(runde(AUFTRITT.runde * 0.05)).toBeLessThan(AUFTRITT.runden * 0.02)
    const a = ringPunkt(knopf, runde(0)), b = ringPunkt(knopf, runde(AUFTRITT.runde))
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.5)
  })

  it('runde ist stetig: in 1/120 s nie ein Sprung', () => {
    let a = ringPunkt(knopf, runde(0))
    for (let t = 1 / 120; t <= AUFTRITT.runde; t += 1 / 120) {
      const b = ringPunkt(knopf, runde(t))
      // Mitte der Runde: rund 1,5 Runden/s auf einem 360 px breiten Ring (wie im Mockup K4)
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(20)
      a = b
    }
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

describe('Auftritt: Erfolg, Kreis bis an den Geräterand', () => {
  const W = 390, H = 844
  it('randAbstand: vom Punkt aus bis zum Rand des Displays (6 px innen)', () => {
    expect(randAbstand(195, 245, 0, W, H)).toBeCloseTo(195 - 6, 3)
    expect(randAbstand(195, 245, -Math.PI / 2, W, H)).toBeCloseTo(245 - 6, 3)
    expect(randAbstand(195, 245, Math.PI / 2, W, H)).toBeCloseTo(H - 6 - 245, 3)
  })
})
