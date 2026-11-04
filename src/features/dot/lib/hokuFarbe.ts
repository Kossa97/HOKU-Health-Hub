/**
 * Hokus Farbe (Mockup „Hoku Varianten", Runde 5, Nutzer 02.11.2026): Der Nutzer
 * wählt sie im Profil. „Passend zum Design" nimmt die Farbe, die zum gewählten
 * App-Design gehört. Gespeichert nur auf dem Gerät, wie das App-Design.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Look } from '../../../lib/look'

export type Rgb = readonly [number, number, number]
export type HokuFarbe = 'heute' | 'cyanweiss' | 'eiscyan' | 'schnee' | 'minze' | 'weiss' | 'sonne' | 'koralle' | 'stimmung'
export type HokuFarbWahl = 'auto' | HokuFarbe

/** Reihenfolge in der Auswahl. */
export const HOKU_FARBEN: readonly HokuFarbe[] = ['heute', 'cyanweiss', 'eiscyan', 'schnee', 'minze', 'weiss', 'sonne', 'koralle', 'stimmung']

/** Standard je App-Design. */
export const STANDARD_JE_LOOK: Record<Look, HokuFarbe> = {
  schwarz: 'cyanweiss',
  satin: 'schnee',
  licht: 'weiss',
  nacht: 'heute',
  instrument: 'eiscyan',
  softdark: 'schnee',
  frost: 'heute',
  labor: 'eiscyan',
  neon: 'cyanweiss',
  tiefsee: 'minze',
  obsidian: 'eiscyan',
  // Papier: Hoku wird per Farbumkehr schwarz gezeichnet (liquid-glass.css)
  papier: 'schnee',
}

/** Drei Töne von vorn nach hinten, dazu der Schein; `kraeftig`: hintere Punkte bleiben sichtbar (Handy, Sonne). */
export interface Palette { vorn: Rgb; rand: Rgb; hinten: Rgb; schein: Rgb; kraeftig: boolean }

export const PALETTEN: Record<Exclude<HokuFarbe, 'heute' | 'stimmung'> | 'glut', Palette> = {
  cyanweiss: { vorn: [255, 255, 255], rand: [104, 230, 252], hinten: [0, 150, 192], schein: [80, 210, 240], kraeftig: true },
  eiscyan: { vorn: [214, 250, 255], rand: [52, 212, 240], hinten: [0, 128, 172], schein: [40, 190, 230], kraeftig: true },
  schnee: { vorn: [255, 255, 255], rand: [228, 239, 247], hinten: [150, 182, 206], schein: [210, 226, 242], kraeftig: true },
  minze: { vorn: [236, 255, 214], rand: [132, 242, 168], hinten: [26, 196, 150], schein: [90, 230, 160], kraeftig: true },
  weiss: { vorn: [255, 255, 255], rand: [240, 244, 255], hinten: [255, 176, 128], schein: [230, 236, 255], kraeftig: true },
  sonne: { vorn: [255, 244, 150], rand: [255, 196, 40], hinten: [255, 128, 24], schein: [255, 180, 40], kraeftig: true },
  koralle: { vorn: [255, 222, 200], rand: [255, 118, 96], hinten: [236, 58, 118], schein: [255, 100, 100], kraeftig: true },
  // Stimmungslicht in Ruhe; beim Denken wird es zu „Heute"
  glut: { vorn: [255, 232, 172], rand: [255, 160, 94], hinten: [255, 88, 126], schein: [255, 150, 90], kraeftig: false },
}

/**
 * Ton einer gewählten Farbe in der Tiefe `t` (0 vorn, 1 hinten): hell vorn, satt am Rand, dunkler hinten.
 * `null` für „Cyan-Violett“, das seinen eigenen Verlauf hat (oben Cyan, unten Pink).
 */
export function tonInTiefe(f: HokuFarbe, t: number): Rgb | null {
  if (f === 'heute') return null
  const p = PALETTEN[f === 'stimmung' ? 'glut' : f], u = Math.min(1, Math.max(0, t))
  const [a, b, q] = u < 0.5 ? [p.vorn, p.rand, u / 0.5] : [p.rand, p.hinten, (u - 0.5) / 0.5]
  return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q]
}

/** Für die Auswahl im Profil: die drei Töne der Farbe (vorn, Rand, hinten). */
export function muster(f: HokuFarbe): readonly Rgb[] {
  if (f === 'heute') return [[110, 230, 255], [175, 135, 255], [255, 120, 200]]
  if (f === 'stimmung') return [[255, 232, 172], [255, 160, 94], [110, 230, 255]]
  const p = PALETTEN[f]
  return [p.vorn, p.rand, p.hinten]
}

const SCHLUESSEL = 'tyd.hoku.farbe'
const EREIGNIS = 'tyd-hoku-farbe'
const WAHLEN: readonly HokuFarbWahl[] = ['auto', ...HOKU_FARBEN]

export function leseFarbWahl(): HokuFarbWahl {
  try {
    const w = localStorage.getItem(SCHLUESSEL)
    return WAHLEN.find(x => x === w) ?? 'auto'
  } catch {
    return 'auto'
  }
}

export function setzeFarbWahl(w: HokuFarbWahl) {
  try { localStorage.setItem(SCHLUESSEL, w) } catch { /* ohne Speicher gilt die Wahl bis zum Neuladen */ }
  window.dispatchEvent(new CustomEvent(EREIGNIS, { detail: w }))
}

/** Die Farbe, die Hoku gerade trägt. */
export function aktiveHokuFarbe(look: Look, wahl: HokuFarbWahl = leseFarbWahl()): HokuFarbe {
  return wahl === 'auto' ? STANDARD_JE_LOOK[look] : wahl
}

/** Meldet jede Änderung der Wahl oder des App-Designs; gibt das Abmelden zurück. */
export function beobachteHokuFarbe(beiAenderung: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === SCHLUESSEL) beiAenderung() }
  window.addEventListener(EREIGNIS, beiAenderung)
  window.addEventListener('storage', onStorage)
  const mo = new MutationObserver(beiAenderung)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-look'] })
  return () => {
    window.removeEventListener(EREIGNIS, beiAenderung)
    window.removeEventListener('storage', onStorage)
    mo.disconnect()
  }
}

export function useHokuFarbWahl(): [HokuFarbWahl, (w: HokuFarbWahl) => void] {
  const [wahl, setWahl] = useState<HokuFarbWahl>(leseFarbWahl)
  useEffect(() => beobachteHokuFarbe(() => setWahl(leseFarbWahl())), [])
  const setze = useCallback((w: HokuFarbWahl) => { setzeFarbWahl(w); setWahl(w) }, [])
  return [wahl, setze]
}
