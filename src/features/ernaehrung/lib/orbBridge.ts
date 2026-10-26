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
let target: { at: number; o: Required<OrbOrigin> } | null = null
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

/**
 * Vor dem Verschieben auf einen anderen Tag: die Punkte, die die Tageskugel verliert, fliegen
 * in diese Kugel (Wochenleiste), statt herauszufallen. Einmal abholen; nur 1 s gültig — die
 * Kugel gibt die Punkte im nächsten Bild ab (die Anzeige ändert sich sofort), ein späteres
 * Entfernen soll nicht in diesen Tag fliegen.
 */
export function setOrbTarget(o: Required<OrbOrigin> | null) {
  target = o ? { at: performance.now(), o } : null
}

export function takeOrbTarget(): Required<OrbOrigin> | null {
  const hit = target && performance.now() - target.at < 1000 ? target.o : null
  target = null
  return hit
}

/** Dauer eines Punktes, der aus der Tageskugel in einen anderen Tag fliegt (ohne Versatz, ms). */
export const RELEASE_FLY_MS = 1050
/** Bis die letzten dieser Punkte angekommen sind (Versatz + Dauer + Streuung, ms). */
export const RELEASE_FLIGHT_MS = 260 + 30 + RELEASE_FLY_MS + 100
