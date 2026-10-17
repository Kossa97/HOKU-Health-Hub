import { useMemo, useState, type ReactNode } from 'react'
import { AmbientContext, type AmbientScene, type LightSlot, type Tint } from './context'

/** Grundfarben der Bühne — ruhig und leise, damit die Glas-Karten tragen. */
const BASE: Record<LightSlot, string> = {
  top: '#00ccf5',
  middle: '#8b7cf0',
  bottom: '#30d158',
}
const BASE_OPACITY = 0.18
const SLOTS: LightSlot[] = ['top', 'middle', 'bottom']

interface Claim extends Tint { owner: string }

/**
 * Fester Hintergrund hinter der Fortschritt-Seite. Die Karten gleiten beim
 * Scrollen über die Lichter; das Glas bricht sie dabei von selbst anders.
 * Interaktionen ändern nur Farbe und Helligkeit eines Lichts, langsam (1 s),
 * nie seine Lage. Je Eigenschaft gilt der zuletzt angemeldete bzw. geänderte
 * Wunsch, der sie setzt; wird er freigegeben, gilt der vorige bzw. die Grundfarbe.
 */
export function AmbientLightProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<Record<LightSlot, Claim[]>>({ top: [], middle: [], bottom: [] })

  const scene = useMemo<AmbientScene>(() => ({
    claim(slot, owner, tint) {
      setClaims(prev => ({ ...prev, [slot]: [...prev[slot].filter(c => c.owner !== owner), { owner, ...tint }] }))
    },
    release(slot, owner) {
      setClaims(prev => ({ ...prev, [slot]: prev[slot].filter(c => c.owner !== owner) }))
    },
  }), [])

  return (
    <AmbientContext.Provider value={scene}>
      <div className="fg-ambient" aria-hidden>
        {SLOTS.map(slot => {
          const color = claims[slot].findLast(c => c.color != null)?.color
          const boost = claims[slot].findLast(c => c.boost != null)?.boost ?? 0
          return (
            <div
              key={slot}
              className={`fg-light fg-light-${slot}`}
              data-tinted={color != null}
              style={{ backgroundColor: color ?? BASE[slot], opacity: BASE_OPACITY + boost }}
            />
          )
        })}
      </div>
      {children}
    </AmbientContext.Provider>
  )
}
