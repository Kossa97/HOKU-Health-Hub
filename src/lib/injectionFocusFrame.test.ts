// src/lib/injectionFocusFrame.test.ts
import { describe, expect, it } from 'vitest'
import { focusTargetDrop, freeViewportFromRects } from './injectionFocusFrame'

const canvas = { top: 0, bottom: 1000, height: 1000 }
const box = (top: number, bottom: number) => ({ top, bottom, height: bottom - top })

describe('freeViewportFromRects', () => {
  it('nimmt den Bereich zwischen dem tiefsten oberen und dem hoechsten unteren Overlay', () => {
    // Kopf bis 160 px, Chip bis 210 px; Historie ab 520 px, Knoepfe ab 930 px.
    expect(freeViewportFromRects(canvas, [box(40, 160), box(170, 210)], [box(520, 1000), box(930, 990)]))
      .toEqual({ top: 0.21, bottom: 0.52 })
  })

  it('ohne Overlays: ganze Karte', () => {
    expect(freeViewportFromRects(canvas, [], [])).toEqual({ top: 0, bottom: 1 })
  })

  it('faellt bei fast verdeckter Karte auf die ganze Karte zurueck', () => {
    expect(freeViewportFromRects(canvas, [box(0, 450)], [box(500, 1000)])).toEqual({ top: 0, bottom: 1 })
  })

  it('rechnet relativ zur Canvas, nicht zum Fenster', () => {
    expect(freeViewportFromRects({ top: 100, bottom: 1100, height: 1000 }, [box(100, 300)], [box(800, 1100)]))
      .toEqual({ top: 0.2, bottom: 0.7 })
  })
})

describe('focusTargetDrop', () => {
  it('kein Versatz, wenn der freie Bereich mittig liegt', () => {
    expect(focusTargetDrop({ top: 0.2, bottom: 0.8 }, 0.82, 48)).toBeCloseTo(0)
  })

  it('freier Bereich oben: Ziel tiefer, Pin erscheint in dessen Mitte', () => {
    const distance = 0.82
    const fov = 48
    const viewport = { top: 0.21, bottom: 0.52 }
    const drop = focusTargetDrop(viewport, distance, fov)
    const visibleHeight = 2 * distance * Math.tan((fov * Math.PI) / 360)
    // Bildposition des Pins (0 = oben): Mitte minus Versatz in Bildanteilen.
    expect(0.5 - drop / visibleHeight).toBeCloseTo((viewport.top + viewport.bottom) / 2)
    expect(drop).toBeGreaterThan(0)
  })
})
