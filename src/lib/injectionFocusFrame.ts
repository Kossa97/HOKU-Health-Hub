// src/lib/injectionFocusFrame.ts
//
// Wohin die Kamera beim Fokus auf einen Pin schaut, damit der Pin in der
// Mitte des *sichtbaren* Teils der Karte landet -- zwischen Kopf/Chips oben
// und Historie/Knoepfen unten -- statt in der Bildmitte unter einem Overlay.
//
// Overlays markieren sich mit data-injection-cover="top" bzw. "bottom".

export const INJECTION_COVER_ATTR = 'data-injection-cover'

/** Freier Bereich als Anteil der Canvas-Hoehe (0 = oben, 1 = unten). */
export interface FreeViewport {
  top: number
  bottom: number
}

const FULL: FreeViewport = { top: 0, bottom: 1 }
// Bleibt weniger frei, lieber die Bildmitte als ein Pin am Rand.
const MIN_FREE = 0.18

type Box = Pick<DOMRect, 'top' | 'bottom' | 'height'>

export function freeViewportFromRects(canvas: Box, tops: Box[], bottoms: Box[]): FreeViewport {
  if (canvas.height <= 0) return FULL
  const fraction = (y: number) => Math.min(1, Math.max(0, (y - canvas.top) / canvas.height))
  const top = tops.reduce((max, rect) => Math.max(max, fraction(rect.bottom)), 0)
  const bottom = bottoms.reduce((min, rect) => Math.min(min, fraction(rect.top)), 1)
  return bottom - top >= MIN_FREE ? { top, bottom } : FULL
}

export function measureFreeViewport(canvas: Element): FreeViewport {
  const rects = (side: 'top' | 'bottom') =>
    Array.from(document.querySelectorAll(`[${INJECTION_COVER_ATTR}="${side}"]`))
      .map(element => element.getBoundingClientRect())
      .filter(rect => rect.height > 0)
  return freeViewportFromRects(canvas.getBoundingClientRect(), rects('top'), rects('bottom'))
}

/**
 * Wie weit (Welt-Einheiten, entlang der Bild-Senkrechten) das Kameraziel unter
 * dem Pin liegen muss, damit der Pin auf Hoehe der Mitte des freien Bereichs
 * erscheint. Positiv = Ziel tiefer, Pin erscheint hoeher.
 */
export function focusTargetDrop(viewport: FreeViewport, distance: number, fovDeg: number): number {
  const center = (viewport.top + viewport.bottom) / 2
  const visibleHeight = 2 * distance * Math.tan((fovDeg * Math.PI) / 360)
  return (0.5 - center) * visibleHeight
}

export const FOCUS_FLIGHT_MS = 550

/**
 * Fortschritt der Kamerafahrt (0..1, weich an- und auslaufend) nach
 * `elapsedMs` seit ihrem ersten Bild. Bewusst an der Uhr statt am
 * Bild-Abstand gemessen: Die Karte zeichnet nur bei Bedarf, das erste Bild
 * nach einer Pause meldet sonst die ganze Pause als Abstand -- die Fahrt
 * waere sofort fertig und die Kamera spraenge.
 */
export function focusFlightEase(elapsedMs: number, durationMs = FOCUS_FLIGHT_MS): number {
  const p = Math.min(1, Math.max(0, elapsedMs / durationMs))
  return p * p * (3 - 2 * p)
}
