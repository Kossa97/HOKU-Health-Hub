import type { LightSlot } from './context'

export interface Point { x: number; y: number }
export interface Box { left: number; top: number; right: number; bottom: number }

/** Karte zum Ablesen (Graph, Werte, Veränderungen) oder mit Fotos. */
export type ZoneKind = 'read' | 'photo'
export interface Zone { kind: ZoneKind; box: Box }

export interface Framing {
  /** Verschiebung je Licht gegenüber seinem festen Platz, in px */
  offsets: Record<LightSlot, Point>
  /** Abdunklung je Licht, 1 = unverändert */
  dims: Record<LightSlot, number>
}

export const SLOTS: LightSlot[] = ['top', 'middle', 'bottom']

/** Lesebereich: mittlere 60 % der Bildschirmhöhe */
const BAND_TOP = 0.2
const BAND_BOTTOM = 0.8
/** So viel vom Lesebereich muss eine Karte füllen, um als gelesen zu gelten */
const MIN_SHARE = 0.35
/** Abstand, mit dem ein Licht außerhalb der Karte zur Ruhe kommt */
const PAD = 24
/** Lichter, die trotzdem hinter der Karte bleiben, werden dunkler */
const BEHIND_DIM = 0.6
/** Fotos: Lichter leiser, damit Hautfarben echt bleiben */
const PHOTO_DIM = 0.6
/** Beim Ablesen: das Licht unter der Ablese-Linie */
export const AVOID_DIM = 0.5

/** Längster Weg eines Lichts: ein Viertel der Breite, höchstens 120 px */
export const maxTravel = (vw: number) => Math.min(vw * 0.25, 120)

/** Alle Lichter an ihrem festen Platz, unverändert hell */
export const rest = (): Framing => ({
  offsets: { top: { x: 0, y: 0 }, middle: { x: 0, y: 0 }, bottom: { x: 0, y: 0 } },
  dims: { top: 1, middle: 1, bottom: 1 },
})

/** Die Karte, die nach dem Scrollen den Lesebereich am meisten füllt. */
export function pickFocus(zones: Zone[], vh: number): Zone | null {
  const top = vh * BAND_TOP
  const bottom = vh * BAND_BOTTOM
  let best: Zone | null = null
  let bestShare = MIN_SHARE
  for (const zone of zones) {
    const share = Math.max(0, Math.min(zone.box.bottom, bottom) - Math.max(zone.box.top, top)) / (bottom - top)
    if (share >= bestShare) { best = zone; bestShare = share }
  }
  return best
}

const inside = (p: Point, b: Box) => p.x > b.left && p.x < b.right && p.y > b.top && p.y < b.bottom

/**
 * Lichter um die gelesene Karte herum: ein Licht, dessen Mitte hinter der
 * Karte liegt, gleitet zum nächsten Rand und knapp darüber hinaus — auf
 * kurzem Weg. Schafft es den Rand nicht, wird es dunkler, damit hinter dem
 * Text kein Licht steht. Lichter neben der Karte bleiben, wo sie sind.
 * `still` (Bewegung reduzieren): nichts bewegt sich, Lichter hinter der Karte
 * werden nur dunkler.
 */
export function frameLights(centers: Record<LightSlot, Point>, focus: Zone | null, vw: number, still = false): Framing {
  const framing = rest()
  if (!focus) return framing
  if (focus.kind === 'photo') {
    for (const slot of SLOTS) framing.dims[slot] = PHOTO_DIM
    return framing
  }
  // Ganze Karte, auch über den Bildschirmrand hinaus: ein Licht, das oben aus
  // dem Bild gleitet, steht sonst weiter hinter dem Teil der Karte darüber.
  const box = focus.box
  const travel = maxTravel(vw)
  for (const slot of SLOTS) {
    const c = centers[slot]
    if (!inside(c, box)) continue
    if (still) { framing.dims[slot] = BEHIND_DIM; continue }
    const ways: Point[] = [
      { x: box.left - PAD - c.x, y: 0 },
      { x: box.right + PAD - c.x, y: 0 },
      { x: 0, y: box.top - PAD - c.y },
      { x: 0, y: box.bottom + PAD - c.y },
    ]
    const way = ways.reduce((a, b) => (Math.hypot(b.x, b.y) < Math.hypot(a.x, a.y) ? b : a))
    const length = Math.hypot(way.x, way.y)
    const scale = length > travel ? travel / length : 1
    const offset = { x: Math.round(way.x * scale), y: Math.round(way.y * scale) }
    framing.offsets[slot] = offset
    if (inside({ x: c.x + offset.x, y: c.y + offset.y }, box)) framing.dims[slot] = BEHIND_DIM
  }
  return framing
}

/** Das sichtbare Licht, dessen Mitte am nächsten am Ablese-Punkt liegt. */
export function nearestLight(centers: Record<LightSlot, Point>, at: Point, vh: number): LightSlot | null {
  let best: LightSlot | null = null
  const dist = (p: Point) => Math.hypot(p.x - at.x, p.y - at.y)
  for (const slot of SLOTS) {
    const c = centers[slot]
    if (c.y < 0 || c.y > vh) continue
    if (best == null || dist(c) < dist(centers[best])) best = slot
  }
  return best
}
