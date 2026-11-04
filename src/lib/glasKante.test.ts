import { describe, expect, it } from 'vitest'
import { kantenFeld, kantenPixel } from './glasKante'

describe('kantenFeld', () => {
  it('misst den Abstand zum Rand: innen negativ, auf dem Rand 0', () => {
    expect(kantenFeld(50, 20, 100, 40, 10).d).toBeCloseTo(-20)
    expect(kantenFeld(50, 0, 100, 40, 10).d).toBeCloseTo(0)
  })

  it('zeigt an den Seiten gerade nach außen, in der Ecke schräg', () => {
    expect(kantenFeld(50, 1, 100, 40, 10)).toMatchObject({ nx: 0, ny: -1 })
    expect(kantenFeld(99, 20, 100, 40, 10)).toMatchObject({ nx: 1, ny: 0 })
    const ecke = kantenFeld(2, 2, 100, 40, 10)
    expect(ecke.nx).toBeLessThan(0)
    expect(ecke.ny).toBeLessThan(0)
    expect(Math.hypot(ecke.nx, ecke.ny)).toBeCloseTo(1)
  })
})

describe('kantenPixel', () => {
  const deckkraft = (p: ReturnType<typeof kantenPixel>, x: number, y: number) => p.daten[(y * p.breite + x) * 4 + 3]

  it('glänzt oben links hell, unten rechts schwächer, innen gar nicht', () => {
    const p = kantenPixel(100, 40, 20, { dpr: 1, fase: 3 })
    const obenLinks = deckkraft(p, 25, 1)
    const untenRechts = deckkraft(p, 75, 38)
    const mitte = deckkraft(p, 50, 20)
    expect(obenLinks).toBeGreaterThan(untenRechts)
    expect(untenRechts).toBeGreaterThan(0)
    expect(mitte).toBe(0)
  })

  it('rechnet in Gerätepixeln', () => {
    const p = kantenPixel(100, 40, 20, { dpr: 2 })
    expect(p.breite).toBe(200)
    expect(p.hoehe).toBe(80)
    expect(p.daten.length).toBe(200 * 80 * 4)
  })
})
