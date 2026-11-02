import { describe, expect, it } from 'vitest'
import { HOER_RING, PUPILLE, augePunkt, augeSchritt, blickZu, blinzle, lidStand, neuesAuge, type AugenEingabe } from './auge'

const ein = (x: Partial<AugenEingabe> = {}): AugenEingabe => ({ ziel: null, gross: false, sichtbar: true, hoert: false, stimme: 0, weniger: false, zufall: () => 0.5, ...x })
const laufe = (a = neuesAuge(), e = ein(), sek = 2) => { for (let t = 0; t < sek; t += 1 / 60) augeSchritt(a, 1 / 60, e); return a }

describe('Hokus Auge: Lid', () => {
  it('schließt schnell, bleibt kurz zu und öffnet langsamer', () => {
    expect(lidStand(0)).toBe(0)
    expect(lidStand(0.045)).toBeCloseTo(0.25)
    expect(lidStand(0.1)).toBe(1)
    expect(lidStand(0.2)).toBeGreaterThan(0)
    expect(lidStand(0.2)).toBeLessThan(1)
    expect(lidStand(0.4)).toBe(0)
  })
  it('blinzelt von selbst und ist danach wieder offen', () => {
    const a = laufe(neuesAuge(), ein(), 2.8)
    expect(a.blinzelAb).toBeGreaterThanOrEqual(0)
    laufe(a, ein(), 0.5)
    expect(a.lidP).toBe(0)
  })
  it('bei weniger Bewegung bleibt das Lid offen', () => {
    const a = neuesAuge(); a.offen = 1
    blinzle(a)
    laufe(a, ein({ weniger: true }), 0.1)
    expect(a.lidP).toBe(0)
  })
})

describe('Hokus Auge: Blick', () => {
  it('dreht den Körper ruhig zum Ziel, ohne über das Ziel hinaus zu schwingen (D10)', () => {
    const a = neuesAuge(), ziel = Math.asin(0.4)
    let max = 0
    for (let t = 0; t < 1.5; t += 1 / 60) { augeSchritt(a, 1 / 60, ein({ ziel: { gx: 0.4, gy: 0 } })); max = Math.max(max, a.yaw) }
    expect(a.yaw).toBeCloseTo(ziel, 2)
    expect(max).toBeLessThanOrEqual(ziel + 1e-3)
  })
  it('bei großen Bewegungen mit Masse: schwingt etwas nach (D11)', () => {
    const a = neuesAuge(), ziel = Math.asin(0.5)
    let max = 0
    for (let t = 0; t < 1.5; t += 1 / 60) { augeSchritt(a, 1 / 60, ein({ ziel: { gx: 0.5, gy: 0 }, gross: true })); max = Math.max(max, a.yaw) }
    expect(max).toBeGreaterThan(ziel)
  })
  it('schaut nach unten, wenn das Ziel unten liegt (y nach unten)', () => {
    const a = laufe(neuesAuge(), ein({ ziel: { gx: 0, gy: 0.4 } }))
    expect(a.G[1]).toBeGreaterThan(0.3)
  })
  it('Blickziel zu einem Punkt: auf ihm schaut er dich an, weit weg höchstens 0,62', () => {
    expect(blickZu(100, 100, 30, 110, 105)).toEqual({ gx: 0, gy: 0 })
    const b = blickZu(100, 100, 30, 1000, 100)
    expect(b.gx).toBeCloseTo(0.62)
    expect(b.gy).toBe(0)
  })
})

describe('Hokus Auge: Pupille', () => {
  const offenesAuge = () => laufe(neuesAuge(), ein({ ziel: { gx: 0, gy: 0 } }), 1)
  it('Punkte vor der Pupille weichen an ihren Rand (Irisblende)', () => {
    const a = offenesAuge(), aus = [0, 0, 0, 0, 0]
    a.lidP = 0; a.blinzelAb = -1; augeSchritt(a, 0, ein({ ziel: { gx: 0, gy: 0 } }))
    augePunkt(a, 0.05, 0.02, Math.sqrt(1 - 0.05 * 0.05 - 0.02 * 0.02), false, 0, aus)
    expect(Math.hypot(aus[0], aus[1])).toBeGreaterThanOrEqual(a.rp * 0.99)
    expect(aus[3]).toBeGreaterThan(1)
  })
  it('Punkte hinter der Pupille verschwinden', () => {
    const a = offenesAuge(), aus = [0, 0, 0, 0, 0]
    augePunkt(a, 0.05, 0, -Math.sqrt(1 - 0.0025), false, 0, aus)
    expect(aus[2]).toBeLessThan(0.1)
  })
  it('geschlossenes Lid: nichts wird verschoben', () => {
    const a = offenesAuge(), aus = [0, 0, 0, 0, 0]
    a.lidKante = a.rp * 1.08
    augePunkt(a, 0.05, 0.02, Math.sqrt(1 - 0.0029), false, 0, aus)
    expect(aus[0]).toBe(0.05)
    expect(aus[1]).toBe(0.02)
  })
  it('nicht zu sehen (andere Form): das Auge schließt sich und lässt die Punkte in Ruhe', () => {
    const a = laufe(offenesAuge(), ein({ sichtbar: false }), 0.5), aus = [0, 0, 0, 0, 0]
    expect(a.offen).toBeLessThan(0.01)
    augePunkt(a, 0.05, 0.02, Math.sqrt(1 - 0.0029), false, 0, aus)
    expect(aus.slice(0, 3)).toEqual([0.05, 0.02, 1])
  })
  it('Zuhören: die Pupille wird etwas größer, Irispunkte bilden einen Ring um sie', () => {
    const a = laufe(neuesAuge(), ein({ ziel: { gx: 0, gy: 0 }, hoert: true, stimme: 0.5 }), 2), aus = [0, 0, 0, 0, 0]
    a.lidP = 0; a.blinzelAb = -1; augeSchritt(a, 0, ein({ ziel: { gx: 0, gy: 0 }, hoert: true, stimme: 0.5 }))
    expect(a.rp).toBeGreaterThan(PUPILLE * 1.1)
    augePunkt(a, 0.6, -0.5, Math.sqrt(1 - 0.61), true, 7, aus)
    expect(Math.hypot(aus[0], aus[1]) / HOER_RING.heb).toBeCloseTo(a.rp * HOER_RING.abstand * (1 + HOER_RING.puls * a.stimme), 1)
    expect(aus[3]).toBeGreaterThan(1.3)
  })
})
