import { describe, expect, it } from 'vitest'
import { frameLights, maxTravel, nearestLight, pickFocus, type Zone } from './framing'

const vw = 390
const vh = 664
// Lagen wie auf dem iPhone 13: oben links, Mitte rechts, unten links
const centers = { top: { x: 96, y: 151 }, middle: { x: 326, y: 416 }, bottom: { x: 72, y: 540 } }
const card = (top: number, bottom: number, kind: Zone['kind'] = 'read'): Zone => ({ kind, box: { left: 18, right: 372, top, bottom } })

describe('pickFocus', () => {
  it('wählt die Karte, die den Lesebereich am meisten füllt', () => {
    const a = card(-300, 200)
    const b = card(220, 700)
    expect(pickFocus([a, b], vh)).toBe(b)
  })

  it('keine Karte, wenn keine den Lesebereich genug füllt', () => {
    expect(pickFocus([card(480, 900)], vh)).toBeNull()
    expect(pickFocus([], vh)).toBeNull()
  })
})

describe('frameLights', () => {
  it('ohne gelesene Karte bleiben alle Lichter an ihrem Platz', () => {
    const f = frameLights(centers, null, vw)
    expect(f.offsets.top).toEqual({ x: 0, y: 0 })
    expect(f.dims).toEqual({ top: 1, middle: 1, bottom: 1 })
  })

  it('Lichter hinter der Karte gleiten zum nächsten Rand, höchstens ein Viertel der Breite', () => {
    const f = frameLights(centers, card(-100, 600), vw)
    // oben links → nach links hinaus, Mitte rechts → nach rechts hinaus
    expect(f.offsets.top.x).toBeLessThan(0)
    expect(f.offsets.top.y).toBe(0)
    expect(f.offsets.middle.x).toBeGreaterThan(0)
    for (const o of Object.values(f.offsets)) expect(Math.hypot(o.x, o.y)).toBeLessThanOrEqual(maxTravel(vw) + 1)
    // Mitte rechts schafft den Rand (46 + 24 px) und bleibt hell
    expect(centers.middle.x + f.offsets.middle.x).toBeGreaterThan(372)
    expect(f.dims.middle).toBe(1)
  })

  it('ein Licht neben der Karte bleibt stehen', () => {
    const f = frameLights(centers, card(250, 470), vw)
    expect(f.offsets.top).toEqual({ x: 0, y: 0 })
    expect(f.offsets.bottom).toEqual({ x: 0, y: 0 })
    expect(f.offsets.middle.x).toBeGreaterThan(0)
  })

  it('schafft ein Licht den Rand nicht, wird es dunkler', () => {
    const wide = { kind: 'read' as const, box: { left: -400, right: 800, top: 0, bottom: vh } }
    const f = frameLights(centers, wide, vw)
    expect(f.dims.top).toBeLessThan(1)
  })

  it('Fotos: nichts bewegt sich, alle Lichter werden leiser', () => {
    const f = frameLights(centers, card(100, 600, 'photo'), vw)
    expect(f.offsets.middle).toEqual({ x: 0, y: 0 })
    expect(f.dims.top).toBeLessThan(1)
    expect(f.dims.bottom).toBe(f.dims.top)
  })
})

describe('frameLights bei reduzierter Bewegung', () => {
  it('nichts bewegt sich; Lichter hinter der Karte werden dunkler', () => {
    const f = frameLights(centers, card(-100, 600), vw, true)
    expect(f.offsets.middle).toEqual({ x: 0, y: 0 })
    expect(f.dims.middle).toBeLessThan(1)
  })
})

describe('frameLights bei hohen Karten', () => {
  it('ein Licht entkommt nicht über den Bildschirmrand, wenn die Karte darüber weitergeht', () => {
    const f = frameLights({ ...centers, top: { x: 96, y: 20 } }, card(-300, 700), vw)
    // Nach oben wäre die Karte noch 320 px lang: das Licht geht zur Seite
    expect(f.offsets.top.y).toBe(0)
    expect(f.offsets.top.x).toBeLessThan(0)
  })
})

describe('nearestLight', () => {
  it('nimmt das sichtbare Licht, das am nächsten am Ablese-Punkt liegt', () => {
    expect(nearestLight(centers, { x: 300, y: 400 }, vh)).toBe('middle')
    // Graph oben: das Licht dahinter, nicht das weit darunter
    expect(nearestLight(centers, { x: 80, y: 180 }, vh)).toBe('top')
    expect(nearestLight({ ...centers, top: { x: 96, y: -300 } }, { x: 80, y: 300 }, vh)).toBe('bottom')
  })
})
