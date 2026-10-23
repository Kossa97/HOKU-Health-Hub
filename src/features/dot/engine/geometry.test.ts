import { describe, expect, it } from 'vitest'
import { dauerText, eckenAbstand, FERN, kastenAbstand, leistenAbstand, rahmenAbstand, ueberlappt } from './geometry'

const rand = { l: 4, t: 4, r: 394, b: 838 }

describe('Dot: Geometrie', () => {
  it('Ecken: innen positiv, außerhalb des Bogens negativ, abseits der Ecken fern', () => {
    expect(eckenAbstand(200, 400, rand, 44, false)).toBe(FERN)
    expect(eckenAbstand(30, 30, rand, 44, false).d).toBeGreaterThan(0)
    expect(eckenAbstand(6, 6, rand, 44, false).d).toBeLessThan(0)
    // über der Tastatur ist die Kante unten gerade
    expect(eckenAbstand(6, 836, rand, 44, true)).toBe(FERN)
    expect(eckenAbstand(6, 6, rand, 0, false)).toBe(FERN)
  })

  it('Rahmen: Abstand zur nächsten Kante, Normale zeigt nach innen', () => {
    const links = rahmenAbstand(14, 400, rand, 44, false)
    expect(links.d).toBeCloseTo(10)
    expect(links.nx).toBe(1)
    const oben = rahmenAbstand(200, 10, rand, 44, false)
    expect(oben.d).toBeCloseTo(6)
    expect(oben.ny).toBe(1)
    // in der Ecke folgt er dem Bogen: auf der Diagonale gleich weit von beiden Seiten
    const ecke = rahmenAbstand(20, 20, rand, 44, false)
    expect(ecke.nx).toBeCloseTo(ecke.ny)
  })

  it('Mitte der Statusleiste: Kasten mit runden Ecken als Körper', () => {
    const insel = { l: 126, r: 264, t: -80, b: 59 }
    const unter = kastenAbstand(195, 80, insel, 18)
    expect(unter.d).toBeCloseTo(21)
    expect(unter.ny).toBe(1)
    expect(kastenAbstand(195, 30, insel, 18).d).toBeLessThan(0)
    // links daneben (Uhr) ist frei
    const links = kastenAbstand(100, 30, insel, 18)
    expect(links.d).toBeCloseTo(26)
    expect(links.nx).toBe(-1)
    // an der runden Ecke unten zeigt die Normale schräg nach außen
    const ecke = kastenAbstand(116, 69, insel, 18)
    expect(ecke.nx).toBeLessThan(0)
    expect(ecke.ny).toBeGreaterThan(0)
  })

  it('Leiste: Kapsel und Plus-Knopf als Körper', () => {
    const kapsel = { l: 16, r: 300, t: 760, b: 816 }
    expect(leistenAbstand(150, 700, kapsel, null).d).toBeCloseTo(60)
    expect(leistenAbstand(150, 788, kapsel, null).d).toBeLessThan(0)
    const plus = { x: 340, y: 788, rad: 28 }
    expect(leistenAbstand(340, 740, kapsel, plus).d).toBeCloseTo(20)
  })

  it('Überlappung und Dauer', () => {
    expect(ueberlappt({ l: 0, r: 10, t: 0, b: 10 }, [{ l: 5, r: 20, t: 5, b: 20 }])).toBe(true)
    expect(ueberlappt({ l: 0, r: 10, t: 0, b: 10 }, [{ l: 11, r: 20, t: 0, b: 10 }])).toBe(false)
    expect(dauerText(499, 'Std.', 'Min.')).toBe('8 Std. 19 Min.')
    expect(dauerText(60, 'Std.', 'Min.')).toBe('1 Std.')
    expect(dauerText(5, 'Std.', 'Min.')).toBe('5 Min.')
  })
})
