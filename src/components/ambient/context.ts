import { createContext, useContext, useEffect, useId, type RefObject } from 'react'
import type { Point, ZoneKind } from './framing'

/** Die drei festen Lichter der Bühne: oben links, Mitte rechts, unten links. */
export type LightSlot = 'top' | 'middle' | 'bottom'

/** Wunsch einer Karte an ein Licht: andere Farbe und/oder etwas heller. */
export interface Tint {
  color?: string
  /** zusätzliche Helligkeit, 0..0,2 */
  boost?: number
}

export interface AmbientScene {
  claim: (slot: LightSlot, owner: string, tint: Tint) => void
  release: (slot: LightSlot, owner: string) => void
  addZone: (owner: string, ref: RefObject<HTMLElement | null>, kind: ZoneKind) => void
  removeZone: (owner: string) => void
  /** Ablese-Punkt in Bildschirm-Koordinaten, null = nicht am Ablesen */
  avoid: (at: Point | null) => void
}

export const AmbientContext = createContext<AmbientScene | null>(null)

/**
 * Färbt ein Licht der Bühne, solange `tint` gesetzt ist; mit null gibt die
 * Karte es wieder frei und das Licht kehrt langsam in seine Grundfarbe zurück.
 * Die Lichter bewegen sich nie — nur Farbe und Helligkeit ändern sich.
 */
export function useAmbientTint(slot: LightSlot, tint: Tint | null) {
  const scene = useContext(AmbientContext)
  const owner = useId()
  const color = tint?.color
  const boost = tint?.boost
  const active = tint != null
  useEffect(() => {
    if (!scene || !active) return
    scene.claim(slot, owner, { color, boost })
    return () => scene.release(slot, owner)
  }, [scene, slot, owner, active, color, boost])
}

/**
 * Meldet eine Karte als Lesefläche an. Kommt das Scrollen auf ihr zur Ruhe,
 * gleiten die Lichter um sie herum (Fotos: die Lichter werden nur leiser).
 */
export function useReadingZone(ref: RefObject<HTMLElement | null>, kind: ZoneKind = 'read') {
  const scene = useContext(AmbientContext)
  const owner = useId()
  useEffect(() => {
    if (!scene) return
    scene.addZone(owner, ref, kind)
    return () => scene.removeZone(owner)
  }, [scene, owner, ref, kind])
}

/** Beim Ablesen im Graphen: das Licht unter dem Ablese-Punkt tritt zurück. */
export function useAmbientAvoid(at: Point | null) {
  const scene = useContext(AmbientContext)
  const x = at?.x
  const y = at?.y
  useEffect(() => {
    scene?.avoid(x == null || y == null ? null : { x, y })
  }, [scene, x, y])
  // Verschwindet der Graph mitten im Ablesen, kehrt das Licht zurück
  useEffect(() => () => scene?.avoid(null), [scene])
}
