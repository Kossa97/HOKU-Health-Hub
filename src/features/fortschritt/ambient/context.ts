import { createContext, useContext, useEffect, useId } from 'react'

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
