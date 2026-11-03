/**
 * Feder für die Glaslinse der Tab-Leiste, nach Apples Parametern
 * (WWDC „Designing Fluid Interfaces“): Antwortzeit `response` in Sekunden und
 * Dämpfung `damping` (1 = ohne Nachschwingen, kleiner = federnder).
 */
export interface Feder { response: number; damping: number }

/** Am Finger: eng, mit einer Spur Trägheit — die Linse hängt, sie zerrt nicht. */
export const FEDER_FINGER: Feder = { response: 0.14, damping: 0.86 }
/** Zum Platz gleiten (Tippen, Loslassen): weich mit leichtem Überschwingen. */
export const FEDER_GLEITEN: Feder = { response: 0.38, damping: 0.72 }
/** Die Linse wächst und schrumpft: kurzer, lebendiger Ausschlag. */
export const FEDER_LINSE: Feder = { response: 0.26, damping: 0.62 }

/** Ein Zeitschritt (halbimpliziter Euler); gibt [Wert, Geschwindigkeit] zurück. */
export function federSchritt(x: number, v: number, ziel: number, f: Feder, dt: number): [number, number] {
  const k = (2 * Math.PI / f.response) ** 2
  const c = (4 * Math.PI * f.damping) / f.response
  const a = -k * (x - ziel) - c * v
  const v2 = v + a * dt
  return [x + v2 * dt, v2]
}
