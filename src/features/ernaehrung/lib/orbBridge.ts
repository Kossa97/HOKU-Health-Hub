/**
 * Verbindung zwischen Formularen unter der Kugel und der Tageskugel oben —
 * ohne Durchreichen durch die Seite. Zwei Dinge:
 *
 * - Vorschau: Was das gerade offene Formular dazubrächte (Portion, Schnelleintrag),
 *   pulsiert in der Tageskugel.
 * - Startpunkt des nächsten Flugs: Die Punkte fliegen aus der Essens-Kugel, aus der
 *   eingetragen wurde, statt von unten.
 */
import { useSyncExternalStore } from 'react'

export interface OrbAdd { kcal: number; protein: number; carbs: number; fat: number }
export interface OrbOrigin { x: number; y: number; r?: number }

let preview: OrbAdd | null = null
let origin: { at: number; o: OrbOrigin } | null = null
const listeners = new Set<() => void>()

export function setOrbPreview(add: OrbAdd | null) {
  if (add === preview || (add && preview && add.kcal === preview.kcal && add.protein === preview.protein && add.carbs === preview.carbs && add.fat === preview.fat)) return
  preview = add
  listeners.forEach(l => l())
}

export function useOrbPreview(): OrbAdd | null {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => preview,
    () => null,
  )
}

/** Vor dem Speichern: der nächste Zuwachs der Tageskugel startet hier. */
export function setOrbOrigin(o: OrbOrigin | null) {
  origin = o ? { at: performance.now(), o } : null
}

/** Einmal abholen; älter als 5 s gilt nicht mehr (Speichern hat zu lange gedauert oder scheiterte). */
export function takeOrbOrigin(): OrbOrigin | null {
  const hit = origin && performance.now() - origin.at < 5000 ? origin.o : null
  origin = null
  return hit
}

/** Wie lange ein Flug aus einer Essens-Kugel dauert, bis alle Punkte angekommen sind (ms). */
export const FLIGHT_MS = 420 + 40 + 560 + 120 + 80
