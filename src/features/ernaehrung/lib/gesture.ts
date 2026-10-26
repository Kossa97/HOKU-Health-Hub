/** Gemeinsame Rechnung für Wischgesten (Zeilen, Wochenleiste) — Werte wie auf dem iPhone. */

/** Ab hier gilt die Bewegung als Wischen, nicht als Tippen oder Scrollen (px). */
export const SLOP = 10

/** Weicher Rand: je weiter über die Grenze, desto weniger folgt der Inhalt. */
export const rubber = (over: number, size: number) => (over * size * 0.55) / (size + 0.55 * Math.abs(over))

/** Wohin der Schwung trägt (Abbremsen wie beim Scrollen, etwas straffer). */
export const project = (v: number) => (v / 1000) * 0.99 / (1 - 0.99)

/** Nur die letzten Bewegungen zählen für den Schwung (ms). */
const WINDOW = 100

/**
 * Tempo beim Loslassen (px/s) aus den letzten Fingerpositionen. Stand der Finger vor dem
 * Loslassen still, ist es 0 — sonst würde eine Pause noch als Schwung gelten.
 */
export function releaseVelocity(hist: readonly { x: number; t: number }[], at: number): number {
  const last = hist[hist.length - 1]
  if (!last || at - last.t > WINDOW) return 0
  const first = hist.find(p => last.t - p.t <= WINDOW) ?? last
  return last.t > first.t ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0
}
