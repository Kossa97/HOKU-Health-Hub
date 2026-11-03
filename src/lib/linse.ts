/**
 * Einstellungen der Glaslinse in der Tab-Leiste (Test, Idee aus Glisse).
 *
 * Gehalten oder beim Gleiten nach einem Tipp wird die Pille zur Linse: sie
 * wächst über die Leiste hinaus und vergrößert die Symbole darunter. Wie
 * stark, steht hier — auf dem Gerät gespeichert und als CSS-Variablen am <html>:
 *   --linse-zoom     Vergrößerung der Symbole in der Linse
 *   --linse-heben    wie weit sich die Linse zusätzlich nach oben hebt (px)
 *   --linse-wachsen  wie viel breiter sie wird (px)
 *   --linse-hoehe    wie viel höher sie wird (px), je zur Hälfte oben und unten;
 *                    kleiner als die Breite ergibt die Kapsel
 *   --linse-farbe    Farbsaum am Rand, 0–1 (bei Glisse „Dispersion")
 * Tempo und Nachschwingen gelten für die Feder beim Gleiten (gleitFeder()).
 */
import { useCallback, useState } from 'react'
import type { Feder } from '../components/navigation/linsenFeder'

export interface LinsenWerte {
  zoom: number
  heben: number
  wachsen: number
  hoehe: number
  farbe: number
  /** Antwortzeit der Gleitfeder in Sekunden: größer = langsamer */
  tempo: number
  /** 0 = ohne Nachschwingen, größer = federnder */
  schwingen: number
}

export const LINSE_STANDARD: LinsenWerte = {
  zoom: 1.32, heben: 0, wachsen: 30, hoehe: 12, farbe: 0.5, tempo: 0.75, schwingen: 0.3,
}
export const LINSE_GRENZEN: Record<keyof LinsenWerte, { min: number; max: number; schritt: number }> = {
  zoom: { min: 1, max: 1.8, schritt: 0.02 },
  heben: { min: 0, max: 30, schritt: 1 },
  wachsen: { min: 0, max: 50, schritt: 1 },
  hoehe: { min: 0, max: 40, schritt: 1 },
  farbe: { min: 0, max: 1, schritt: 0.05 },
  tempo: { min: 0.2, max: 1.4, schritt: 0.05 },
  schwingen: { min: 0, max: 0.6, schritt: 0.02 },
}

const SCHLUESSEL = 'tyd_linse_2'

const begrenzt = (v: unknown, g: { min: number; max: number }, ersatz: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(g.max, Math.max(g.min, v)) : ersatz

export function leseLinse(): LinsenWerte {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? 'null') as Partial<LinsenWerte> | null
    if (!roh) return { ...LINSE_STANDARD }
    const w = { ...LINSE_STANDARD }
    for (const k of Object.keys(LINSE_STANDARD) as (keyof LinsenWerte)[]) {
      w[k] = begrenzt(roh[k], LINSE_GRENZEN[k], LINSE_STANDARD[k])
    }
    return w
  } catch {
    return { ...LINSE_STANDARD }
  }
}

let aktuell: LinsenWerte = { ...LINSE_STANDARD }

/** Die Feder, mit der die Linse zu ihrem Platz gleitet. */
export function gleitFeder(): Feder {
  return { response: aktuell.tempo, damping: 1 - aktuell.schwingen }
}

export function wendeLinseAn(w: LinsenWerte): void {
  aktuell = { ...w }
  const s = document.documentElement.style
  s.setProperty('--linse-zoom', String(w.zoom))
  s.setProperty('--linse-heben', `${w.heben}px`)
  s.setProperty('--linse-wachsen', `${w.wachsen}px`)
  s.setProperty('--linse-hoehe', `${w.hoehe}px`)
  s.setProperty('--linse-farbe', String(w.farbe))
}

export function useLinse() {
  const [werte, setWerte] = useState<LinsenWerte>(leseLinse)
  const setze = useCallback((neu: LinsenWerte) => {
    try {
      localStorage.setItem(SCHLUESSEL, JSON.stringify(neu))
    } catch {
      // Ohne Speicher gilt die Wahl bis zum Neuladen.
    }
    wendeLinseAn(neu)
    setWerte(neu)
  }, [])
  return { werte, setze }
}
