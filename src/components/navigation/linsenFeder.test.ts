import { describe, expect, it } from 'vitest'
import { FEDER_GLEITEN, FEDER_LINSE, federFuerWeg, federSchritt, linsenBild, planeWeg } from './linsenFeder'

const lauf = (start: number, ziel: number, f = FEDER_GLEITEN, sek = 1.5) => {
  let x = start, v = 0, max = start
  for (let t = 0; t < sek; t += 1 / 60) { [x, v] = federSchritt(x, v, ziel, f, 1 / 60); max = Math.max(max, x) }
  return { x, v, max }
}

describe('federSchritt', () => {
  it('kommt am Ziel an und steht dort still', () => {
    const { x, v } = lauf(0, 100)
    expect(x).toBeCloseTo(100, 1)
    expect(Math.abs(v)).toBeLessThan(1)
  })

  it('schwingt beim Gleiten leicht über das Ziel hinaus', () => {
    const { max } = lauf(0, 100)
    expect(max).toBeGreaterThan(100)
    expect(max).toBeLessThan(115)
  })

  it('die Linse springt lebendig auf und beruhigt sich', () => {
    const { x, max } = lauf(0, 1, FEDER_LINSE)
    expect(max).toBeGreaterThan(1.02)
    expect(x).toBeCloseTo(1, 2)
  })
})

describe('planeWeg und linsenBild', () => {
  const m = { w0: 60, h0: 48, einzug: 7, wachsen: 30, hoehe: 12, heben: 0, zoom: 1.3 }
  const start = { x: 280, w: 60, t: 0, vx: 0, vw: 0, vt: 0 }
  const ziel = { x: 10, w: 60, gehalten: false }

  it('gleitet bis zum Ziel, groß unterwegs, klein am Ende', () => {
    const weg = planeWeg(start, ziel, FEDER_GLEITEN)
    expect(weg.length).toBeGreaterThan(20)
    expect(Math.max(...weg.map(s => s.t))).toBeGreaterThan(0.8)
    expect(weg[weg.length - 1]).toEqual({ x: 10, w: 60, t: 0, vx: 0, vw: 0, vt: 0 })
  })

  it('in Ruhe nur verschoben, die Kopie läuft genau entgegen', () => {
    const b = linsenBild({ ...start }, m)
    expect(b.pille).toBe('translateX(280px)')
    expect(b.kopie).toBe('translateX(-280px)')
    expect(b.glas).toBe(0)
  })

  it('als Linse: jedes Symbol steht über seinem echten, um die Linsenmitte vergrößert', () => {
    const s = { x: 100, w: 60, t: 1, vx: 0, vw: 0, vt: 0 }
    const b = linsenBild(s, m)
    // Kopie und Pille zusammen abbilden: ein Punkt p der Leiste landet bei
    // Linsenmitte + zoom · (p − Linsenmitte)
    const zahlen = (str: string) => (str.match(/-?[\d.]+/g) ?? []).map(Number)
    const [tx, , sx, sy] = zahlen(b.pille)
    const [bx, by, ax, ay] = zahlen(b.kopie)
    const p = { x: 150, y: 20 }
    const q = { x: bx + ax * p.x, y: -m.einzug + by + ay * p.y }
    const bildX = m.w0 / 2 + tx + sx * (q.x - m.w0 / 2)
    const bildY = m.einzug + m.h0 / 2 + sy * (q.y - m.h0 / 2)
    const mitte = { x: 130, y: m.einzug + m.h0 / 2 }
    expect(bildX).toBeCloseTo(mitte.x + 1.3 * (p.x - mitte.x), 1)
    expect(bildY).toBeCloseTo(mitte.y + 1.3 * (p.y - mitte.y), 1)
  })
})

describe('Tempo und Form je nach Fahrt', () => {
  const m = { w0: 60, h0: 48, einzug: 7, wachsen: 0, hoehe: 0, heben: 0, zoom: 1 }
  const zahlen = (str: string) => (str.match(/-?[\d.]+/g) ?? []).map(Number)

  it('lange Wege dauern etwas länger, kurze sind flinker — nicht im selben Maß', () => {
    const f = { response: 0.6, damping: 0.7 }
    const kurz = federFuerWeg(f, 60, 1).response
    const lang = federFuerWeg(f, 240, 1).response
    expect(kurz).toBeLessThan(0.6)
    expect(lang).toBeGreaterThan(0.6)
    expect(lang / kurz).toBeLessThan(240 / 60)
    expect(federFuerWeg(f, 240, 0).response).toBe(0.6)
  })

  it('schnell wird sie lang und flach, beim Bremsen staucht sie sich und quillt', () => {
    const fahrt = linsenBild({ x: 100, w: 60, t: 0, vx: 900, vw: 0, vt: 0, ax: 0 }, m)
    const [, , sx, sy] = zahlen(fahrt.pille)
    expect(sx).toBeGreaterThan(1)
    expect(sy).toBeLessThan(1)
    const bremst = linsenBild({ x: 100, w: 60, t: 0, vx: 300, vw: 0, vt: 0, ax: -6000 }, m)
    const ohne = linsenBild({ x: 100, w: 60, t: 0, vx: 300, vw: 0, vt: 0, ax: 0 }, m)
    expect(zahlen(bremst.pille)[2]).toBeLessThan(zahlen(ohne.pille)[2])
    expect(zahlen(bremst.pille)[3]).toBeGreaterThan(zahlen(ohne.pille)[3])
  })
})
