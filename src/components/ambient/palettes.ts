import type { LightSlot } from './context'

export type Palette = Record<LightSlot, string>

/** Grundbühne: Cyan oben links, Violett Mitte rechts, Grün unten links. */
export const DEFAULT_PALETTE: Palette = { top: '#00ccf5', middle: '#8b7cf0', bottom: '#30d158' }

export interface AmbientScheme {
  palette: Palette
  /** Helligkeit relativ zur Grundbühne: 1 = wie Fortschritt, darunter leiser */
  level: number
}

/**
 * Je Bereich eine eigene, ruhige Grundstimmung — die Farbe des Bereichs oben,
 * zwei Begleiter darunter. Seiten zum Arbeiten (Rechner, Formulare, Texte)
 * sind leiser, damit nichts vom Lesen und Eingeben ablenkt.
 * Längster passender Pfad gewinnt (/lab/peptipedia vor /lab).
 */
const SCHEMES: [prefix: string, scheme: AmbientScheme][] = [
  ['/progress', { palette: DEFAULT_PALETTE, level: 1 }],
  ['/blutwerte', { palette: { top: '#ff375f', middle: '#8b7cf0', bottom: '#ff8a65' }, level: 0.9 }],
  ['/simulation', { palette: { top: '#06b6d4', middle: '#5e5ce6', bottom: '#00ccf5' }, level: 0.9 }],
  ['/my-stack', { palette: { top: '#00ccf5', middle: '#8b7cf0', bottom: '#30d158' }, level: 0.9 }],
  ['/peptide', { palette: { top: '#00ccf5', middle: '#8b7cf0', bottom: '#30d158' }, level: 0.9 }],
  ['/kalender', { palette: { top: '#8b5cf6', middle: '#00ccf5', bottom: '#10b981' }, level: 0.85 }],
  ['/injektionen', { palette: { top: '#10b981', middle: '#00ccf5', bottom: '#8b5cf6' }, level: 0.85 }],
  ['/health', { palette: { top: '#ff375f', middle: '#30d158', bottom: '#00ccf5' }, level: 0.85 }],
  ['/lab', { palette: { top: '#8b5cf6', middle: '#06b6d4', bottom: '#5e5ce6' }, level: 0.85 }],
  ['/lab/peptipedia', { palette: { top: '#06b6d4', middle: '#8b5cf6', bottom: '#00ccf5' }, level: 0.75 }],
  ['/the-lab', { palette: { top: '#8b5cf6', middle: '#06b6d4', bottom: '#5e5ce6' }, level: 0.85 }],
  ['/tagebuch', { palette: { top: '#ec4899', middle: '#8b5cf6', bottom: '#00ccf5' }, level: 0.75 }],
  ['/bewertungen', { palette: { top: '#f59e0b', middle: '#8b7cf0', bottom: '#00ccf5' }, level: 0.75 }],
  ['/rechner', { palette: { top: '#3b82f6', middle: '#00ccf5', bottom: '#5e5ce6' }, level: 0.65 }],
  ['/protokoll', { palette: DEFAULT_PALETTE, level: 0.6 }],
  ['/profil', { palette: DEFAULT_PALETTE, level: 0.6 }],
  ['/faq', { palette: DEFAULT_PALETTE, level: 0.6 }],
]

export function ambientForPath(pathname: string): AmbientScheme {
  let best: AmbientScheme | null = null
  let bestLength = -1
  for (const [prefix, scheme] of SCHEMES) {
    const hit = pathname === prefix || pathname.startsWith(`${prefix}/`)
    if (hit && prefix.length > bestLength) { best = scheme; bestLength = prefix.length }
  }
  // Startseite und alles Übrige: die Grundbühne
  return best ?? { palette: DEFAULT_PALETTE, level: 0.9 }
}
