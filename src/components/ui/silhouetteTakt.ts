// Logik zu den Silhouetten (Silhouette.tsx): welcher Umriss zu welcher Seite
// gehört und wann er erscheint.
import { useEffect, useRef, useState } from 'react'

export type SilhouettenArt = 'start' | 'kalender' | 'stack' | 'blutwerte' | 'liste' | 'lab' | 'profil' | 'karten'

/** Welcher Umriss zu einem Pfad gehört. */
export function silhouetteFuerPfad(pfad: string): SilhouettenArt {
  const p = pfad.replace(/\/+$/, '') || '/'
  if (p === '/') return 'start'
  if (p.startsWith('/kalender')) return 'kalender'
  if (p.startsWith('/my-stack')) return 'stack'
  if (p.startsWith('/blutwerte')) return 'blutwerte'
  if (p.startsWith('/tagebuch') || p.startsWith('/bewertungen')) return 'liste'
  if (p === '/lab' || p === '/the-lab') return 'lab'
  if (p.startsWith('/profil')) return 'profil'
  return 'karten'
}

export const SICHTBAR_NACH = 250
const EINBLENDEN = 280
// Ganz zu sehen, also nach dem Einblenden, mindestens so lange
const MIN_SICHTBAR = EINBLENDEN + 300

export type Ladephase = 'laden' | 'einblenden' | 'fertig'

/**
 * Taktet eine Silhouette für Daten, die eine Seite nachlädt:
 * - 'laden': Silhouette zeigen (sie selbst wird erst nach 250 ms sichtbar).
 *   Ist sie erschienen, bleibt sie nach dem Einblenden mindestens 300 ms — kein Aufblitzen.
 * - 'einblenden': die Silhouette war zu sehen; der Inhalt blendet einmal über (.lg-reveal).
 * - 'fertig': es ging schnell genug, der Inhalt steht einfach da.
 */
export function useLadephase(laedt: boolean): Ladephase {
  const [halten, setHalten] = useState(false)
  const [gezeigt, setGezeigt] = useState(false)
  const sichtbarSeit = useRef(0)

  useEffect(() => {
    if (!laedt) return
    const id = setTimeout(() => {
      sichtbarSeit.current = performance.now()
      setGezeigt(true)
      setHalten(true)
    }, SICHTBAR_NACH)
    return () => clearTimeout(id)
  }, [laedt])

  useEffect(() => {
    if (laedt || !halten) return
    const rest = Math.max(0, sichtbarSeit.current + MIN_SICHTBAR - performance.now())
    const id = setTimeout(() => setHalten(false), rest)
    return () => clearTimeout(id)
  }, [laedt, halten])

  // Das Überblenden gilt einmal, nicht bei jedem späteren Neuaufbau des Inhalts
  useEffect(() => {
    if (laedt || halten || !gezeigt) return
    const id = setTimeout(() => setGezeigt(false), EINBLENDEN + 100)
    return () => clearTimeout(id)
  }, [laedt, halten, gezeigt])

  if (laedt || halten) return 'laden'
  return gezeigt ? 'einblenden' : 'fertig'
}

// Folgen mehrere Silhouetten direkt aufeinander (Kaltstart: Anmeldung →
// Zustimmung → Seitencode), soll die nächste nicht wieder unsichtbar
// beginnen: sie übernimmt den Startzeitpunkt der Kette.
let kette = { start: 0, ende: -Infinity }
const KETTEN_LUECKE = 150

/** Wann die Kette begann, zu der eine jetzt erscheinende Silhouette gehört. */
export function kettenStart(jetzt: number): number {
  return jetzt - kette.ende < KETTEN_LUECKE ? kette.start : jetzt
}

/** Eine Silhouette verschwindet: ihre Kette bleibt kurz offen. */
export function ketteBeenden(start: number, jetzt: number) {
  kette = { start, ende: jetzt }
}
