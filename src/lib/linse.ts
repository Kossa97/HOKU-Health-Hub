/**
 * Einstellungen der Glaslinse in der Tab-Leiste (Test, Idee aus Glisse).
 *
 * Gehalten wird die Pille zur Linse: sie wächst über die Leiste hinaus, hebt
 * sich an und vergrößert die Symbole darunter. Wie stark, steht hier — auf dem
 * Gerät gespeichert und als CSS-Variablen am <html>:
 *   --linse-zoom     Vergrößerung der Symbole in der Linse
 *   --linse-heben    wie weit sich die Linse nach oben hebt (px)
 *   --linse-wachsen  wie viel breiter sie wird (px); in der Höhe drei Viertel davon
 */
import { useCallback, useState } from 'react'

export interface LinsenWerte { zoom: number; heben: number; wachsen: number }

export const LINSE_STANDARD: LinsenWerte = { zoom: 1.32, heben: 14, wachsen: 20 }
export const LINSE_GRENZEN = {
  zoom: { min: 1, max: 1.8, schritt: 0.02 },
  heben: { min: 0, max: 30, schritt: 1 },
  wachsen: { min: 0, max: 40, schritt: 1 },
} as const

const SCHLUESSEL = 'tyd_linse'

const begrenzt = (v: unknown, g: { min: number; max: number }, ersatz: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(g.max, Math.max(g.min, v)) : ersatz

export function leseLinse(): LinsenWerte {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? 'null') as Partial<LinsenWerte> | null
    if (!roh) return { ...LINSE_STANDARD }
    return {
      zoom: begrenzt(roh.zoom, LINSE_GRENZEN.zoom, LINSE_STANDARD.zoom),
      heben: begrenzt(roh.heben, LINSE_GRENZEN.heben, LINSE_STANDARD.heben),
      wachsen: begrenzt(roh.wachsen, LINSE_GRENZEN.wachsen, LINSE_STANDARD.wachsen),
    }
  } catch {
    return { ...LINSE_STANDARD }
  }
}

export function wendeLinseAn(w: LinsenWerte): void {
  const s = document.documentElement.style
  s.setProperty('--linse-zoom', String(w.zoom))
  s.setProperty('--linse-heben', `${w.heben}px`)
  s.setProperty('--linse-wachsen', `${w.wachsen}px`)
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
