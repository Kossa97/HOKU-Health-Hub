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
 *   --linse-klar     Durchsicht der Linse, 0 deckend … 1 klar wie bei Apple
 *   --linse-ruhe     Breite der ruhenden Pille, 0 schmal … 1 so breit wie der Reiter
 *   --linse-fuellung ruhende Pille als graue, gefüllte Kapsel, 0–1
 *   --linse-rand     Brechung am Rand, 0–1: wie stark die Kante den Inhalt verzerrt
 *   --linse-art      wie: 1 Ringe (zwei Stufen, läuft ohne Skript), 2 Glisse
 *                    (SVG-Verschiebungskarte, stufenlos, rechnet bei Bewegung neu)
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
  klar: number
  ruhe: number
  fuellung: number
  rand: number
  /** Art der Randbrechung: 1 Ringe, 2 Glisse */
  art: number
  /** Ringe: Breite (px) und Stärke des äußeren und des inneren Rings */
  saumAussenBreite: number
  saumAussen: number
  saumInnenBreite: number
  saumInnen: number
}

/**
 * Der Standard ist Apples Leiste aus iOS 26 (Bildschirmaufnahme vom iPhone):
 * in Ruhe eine gefüllte Kapsel so breit wie der Reiter; gedrückt eine KLARE
 * Linse, die oben und unten über die Leiste ragt, die Leiste samt Rand darin
 * leicht vergrößert, eine helle Kante mit Regenbogen an den Enden und
 * Randbrechung in Ringen. Glisse (art 2) ist archiviert, nicht Standard.
 * Werte vom Nutzer am iPhone eingestellt (2026-11-04).
 */
export const LINSE_STANDARD: LinsenWerte = {
  zoom: 1.08, heben: 0, wachsen: 36, hoehe: 40, farbe: 0.1, tempo: 0.6, schwingen: 0.3,
  klar: 1, ruhe: 1, fuellung: 1, rand: 1, art: 1,
  saumAussenBreite: 3.5, saumAussen: 0.5, saumInnenBreite: 8, saumInnen: 0.22,
}

/** Früherer Name des Standards. */
export const LINSE_APPLE = LINSE_STANDARD
export const LINSE_GRENZEN: Record<keyof LinsenWerte, { min: number; max: number; schritt: number }> = {
  zoom: { min: 1, max: 1.8, schritt: 0.02 },
  heben: { min: 0, max: 30, schritt: 1 },
  wachsen: { min: 0, max: 50, schritt: 1 },
  hoehe: { min: 0, max: 40, schritt: 1 },
  farbe: { min: 0, max: 1, schritt: 0.05 },
  tempo: { min: 0.2, max: 1.4, schritt: 0.05 },
  schwingen: { min: 0, max: 0.6, schritt: 0.02 },
  klar: { min: 0, max: 1, schritt: 0.05 },
  ruhe: { min: 0, max: 1, schritt: 0.05 },
  fuellung: { min: 0, max: 1, schritt: 0.05 },
  rand: { min: 0, max: 1, schritt: 0.05 },
  art: { min: 1, max: 2, schritt: 1 },
  saumAussenBreite: { min: 1, max: 12, schritt: 0.5 },
  saumAussen: { min: 0, max: 1, schritt: 0.02 },
  saumInnenBreite: { min: 2, max: 24, schritt: 0.5 },
  saumInnen: { min: 0, max: 1, schritt: 0.02 },
}

const SCHLUESSEL = 'tyd_linse_3'

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
  s.setProperty('--linse-klar', String(w.klar))
  s.setProperty('--linse-ruhe', String(w.ruhe))
  s.setProperty('--linse-fuellung', String(w.fuellung))
  s.setProperty('--linse-rand', String(w.rand))
  s.setProperty('--linse-art', String(w.art))
  s.setProperty('--linse-saum-aussen-breite', String(w.saumAussenBreite))
  s.setProperty('--linse-saum-aussen', String(w.saumAussen))
  s.setProperty('--linse-saum-innen-breite', String(w.saumInnenBreite))
  s.setProperty('--linse-saum-innen', String(w.saumInnen))
  // Die Tab-Leiste misst die Pille neu (ihre Breite hängt an --linse-ruhe)
  window.dispatchEvent(new Event(LINSE_GEAENDERT))
}

export const LINSE_GEAENDERT = 'tyd-linse-geaendert'

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
