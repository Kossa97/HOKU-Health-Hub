/**
 * Hokus Auftritte auf der Anmeldung, als reine Bahnen (Mockup „Dots Auftritte", Wahl des Nutzers
 * 29.10.2026). Die Engine liest daraus Lage, Größe und Stauchung je Bild.
 *
 * Hinweis (K4): zwei ruhige Runden auf einem flachen Ring um den Knopf, wie Hoku in der App um die
 * iPhone-Uhr fliegt; vorn unten größer und heller, hinten oben hinter dem Knopf. Weich am Anfang
 * und Ende, ohne Zufall und ohne Tippen.
 *
 * Klopfen: dreimal schnell nah an die Scheibe, Aufprall mit Stauchen, federnd zurück.
 *
 * Erfolg: der Kreis des Portals wächst über das Display hinaus; seine Punkte bleiben am Rand hängen.
 */
import { TAU, clamp01 } from './geometry'

export const AUFTRITT = {
  // Hinweis: Hinflug (s), Dauer der Runden, Zahl der Runden, Rückflug; Größe unterwegs (px)
  hin: 0.45, runde: 3.0, runden: 2, rueck: 0.6, klein: 12,
  // Ring um den Knopf: Abstand vor den Enden, halbe Höhe (px), wie an der Uhr
  ringAbstand: 16, ringHoehe: 13,
  // Klopfen: Beginn der drei Stöße (s), Dauer je Stoß, Anteil bis zum Aufprall, Nähe (Größe ×), Gesamtdauer
  stoesse: [0.3, 0.9, 1.5], stossDauer: 0.6, stossHin: 0.252, nah: 2.9, klopfen: 2.4,
}

const misch = (a: number, b: number, r: number) => a + (b - a) * r
const einaus = (u: number) => { u = clamp01(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2 }
const ein3 = (u: number) => { u = clamp01(u); return u * u * u }

export interface Rechteck { left: number; top: number; width: number; height: number }
export interface RingPunkt { x: number; y: number; z: number }
/** Punkt auf dem flachen Ring um den Knopf nach p Runden: vom linken Ende erst nach vorn (unten, z > 0), dann dahinter. */
export function ringPunkt(k: Rechteck, p: number): RingPunkt {
  const th = Math.PI - TAU * p, a = k.width / 2 + AUFTRITT.ringAbstand
  return { x: k.left + k.width / 2 + a * Math.cos(th), y: k.top + k.height / 2 + 2 + AUFTRITT.ringHoehe * Math.sin(th), z: Math.sin(th) }
}
/** So viele Runden nach t Sekunden: weich beschleunigt und abgebremst wie an der Uhr. */
export const runde = (t: number) => AUFTRITT.runden * einaus(t / AUFTRITT.runde)

/** Abstand von (x, y) in Richtung th bis zum Rand des Displays, 6 px innen. */
export function randAbstand(x: number, y: number, th: number, W: number, H: number): number {
  const c = Math.cos(th), s = Math.sin(th)
  const tx = c > 1e-6 ? (W - 6 - x) / c : c < -1e-6 ? (6 - x) / c : Infinity
  const ty = s > 1e-6 ? (H - 6 - y) / s : s < -1e-6 ? (6 - y) / s : Infinity
  return Math.max(0, Math.min(tx, ty))
}

/** Klopfen zum Zeitpunkt t (s): Größe relativ zur Bühnengröße, Stauchung 0…1, Helligkeit des Aufpralls 0…1. */
export function stoss(t: number): { skala: number; quetsch: number; treffer: number; naehe: number } {
  const A = AUFTRITT, basis = 1 + 0.2 * einaus((t - 0.05) / 0.25) * (1 - einaus((t - 2.0) / 0.4))
  let skala = basis, quetsch = 0, treffer = 0
  for (const b of A.stoesse) {
    const u = (t - b) / A.stossDauer
    if (u < 0 || u > 1) continue
    const hin = A.stossHin / A.stossDauer
    if (u < hin) skala = misch(basis, A.nah, ein3(u / hin))
    else {
      const w = (u - hin) * A.stossDauer
      skala = misch(basis, A.nah, Math.exp(-7 * w) * Math.cos(11 * w))
      quetsch = Math.exp(-w * 16); treffer = Math.exp(-w * 9)
    }
  }
  return { skala, quetsch, treffer, naehe: clamp01((skala - 1) / (A.nah - 1)) }
}
