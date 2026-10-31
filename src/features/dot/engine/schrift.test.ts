import { describe, expect, it } from 'vitest'
import { BAHN_DAUER, SCHRIFT_ARTEN, bahn, naechsteSchrift, type BahnArt, type BahnLage, type BahnPunkt, type SchriftArt } from './schrift'

const LICHT = { licht: 0.5, funkeln: 0.15 }
const zufall = (s: number) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }

describe('Hokus Schrift', () => {
  it('Wechsel: jede Art kommt in sechs Sätzen genau einmal, nie zweimal dieselbe hintereinander', () => {
    const stapel: SchriftArt[] = [], z = zufall(5)
    let letzte: SchriftArt | null = null
    for (let runde = 0; runde < 50; runde++) {
      const gesehen = new Set<SchriftArt>()
      for (let i = 0; i < SCHRIFT_ARTEN.length; i++) {
        const a = naechsteSchrift(stapel, letzte, z)
        expect(a).not.toBe(letzte)
        gesehen.add(a); letzte = a
      }
      expect(gesehen.size).toBe(SCHRIFT_ARTEN.length)
    }
  })

  it('Wechsel: auch der erste Satz eines Besuchs ist nicht der letzte vom Besuch davor', () => {
    for (let s = 1; s < 200; s++) expect(naechsteSchrift([], 'pop', zufall(s))).not.toBe('pop')
  })

  const punkt = (o: Partial<BahnPunkt>): BahnPunkt => ({
    ax: 40, ay: -30, az: 0.7, bx: -90, by: 20, bz: 0.9, k: 0.6, s: 1.3, kind: false, lese: 0.4, bi: 3, mx: -85, my: 18, n: 12, ...o,
  })
  const arten = Object.keys(BAHN_DAUER) as BahnArt[]

  it('Bahnen beginnen dort, wo der Punkt steht, und enden an seinem Ziel, in beide Richtungen', () => {
    for (const art of arten) for (const ein of [true, false]) for (const k of [0, 0.5, 1]) for (const lese of [0, 0.5, 1]) {
      const p = punkt({ k, lese, bi: Math.round(lese * 11) }), out: BahnLage = [0, 0, 0, 0, 0]
      bahn(art, ein, 0, p, 0.8, 3, LICHT, out)
      expect(out[0], `${art} ${ein} Anfang x`).toBeCloseTo(p.ax, 0)
      expect(out[1], `${art} ${ein} Anfang y`).toBeCloseTo(p.ay, 0)
      expect(out[2], `${art} ${ein} Anfang z`).toBeCloseTo(p.az, 2)
      bahn(art, ein, BAHN_DAUER[art][ein ? 'ein' : 'aus'], p, 0.8, 3, LICHT, out)
      expect(out[0], `${art} ${ein} Ende x`).toBeCloseTo(p.bx, 0)
      expect(out[1], `${art} ${ein} Ende y`).toBeCloseTo(p.by, 0)
      expect(out[2], `${art} ${ein} Ende z`).toBeCloseTo(p.bz, 2)
      // die Größe endet bei der Schrift (0,8) bzw. in der Kugel (1), das Licht wie danach (ohne Blitz)
      expect(out[4], `${art} ${ein} Größe`).toBeCloseTo(ein ? 0.8 : 1, 2)
      const danach = ein ? 1 + 0.5 * Math.max(0, Math.sin(3 * 2.2 - p.bx * 0.028)) + 0.15 * Math.sin(3 * 3.1 + p.s * 4) : 1
      expect(out[3], `${art} ${ein} Licht`).toBeCloseTo(danach, 2)
    }
  })

  it('Kinder treten unsichtbar aus Hoku heraus und verschwinden beim Zurückkehren', () => {
    for (const art of arten) {
      const out: BahnLage = [0, 0, 0, 0, 0]
      bahn(art, true, 0, punkt({ kind: true, az: 0 }), 0.8, 0, LICHT, out)
      expect(out[2], art).toBeCloseTo(0, 3)
      bahn(art, false, BAHN_DAUER[art].aus, punkt({ kind: true, bz: 0 }), 0.8, 0, LICHT, out)
      expect(out[2], art).toBeCloseTo(0, 3)
    }
  })

  it('Bahnen bleiben endlich und im Rahmen', () => {
    const out: BahnLage = [0, 0, 0, 0, 0]
    for (const art of arten) for (const ein of [true, false]) for (let pt = 0; pt <= 1.7; pt += 0.05) {
      bahn(art, ein, pt, punkt({}), 0.8, pt, LICHT, out)
      expect(out.every(Number.isFinite), `${art} ${ein} ${pt}`).toBe(true)
      expect(out[2]).toBeGreaterThanOrEqual(0)
      expect(out[2]).toBeLessThanOrEqual(1)
      expect(Math.hypot(out[0], out[1])).toBeLessThan(250)
    }
  })
})
