/**
 * Hokus Auftritte auf der Anmeldung, als reine Bahnen (Mockup „Dots Auftritte" K2 und G4,
 * Wahl des Nutzers 29.10.2026). Die Engine liest daraus Lage, Größe und Stauchung je Bild.
 *
 * Flug um einen Knopf: der Köder, dem Hoku an einer weichen Feder nachjagt. Lage längs des
 * Knopfs, Winkel um seine Längsachse und Abstand folgen je einer Summe aus Schwingungen mit
 * krummen, je Saat zufälligen Frequenzen; die Winkelgeschwindigkeit schwankt so stark, dass
 * er mal flitzt, mal fast steht und umkehrt. Alles stetig, nichts wiederholt sich sichtbar.
 *
 * Klopfen: dreimal schnell nah an die Scheibe, Aufprall mit Stauchen, federnd zurück.
 */
import { TAU, clamp01 } from './geometry'

export const AUFTRITT = {
  // Flug: Hinflug, Simulation um den Knopf, Rückflug (s); Größe unterwegs (px)
  hin: 0.55, flug: 2.55, rueck: 0.6, klein: 12,
  // Feder des Flugs (Dämpfung unter 1: er schwingt über) und leichte Schwerkraft (px/s²)
  federK: 55, federD: 0.22, schwer: 150,
  // Tippen: so lange nach Beginn der Simulation (s, plus Zufall bis tippZufall), Fall, Rückprall
  tippAb: 0.65, tippZufall: 0.4, tippDauer: 0.66, anflug: 0.22, fall: 2600, rueckprall: 0.55,
  // Klopfen: Beginn der drei Stöße (s), Dauer je Stoß, Anteil bis zum Aufprall, Nähe (Größe ×), Gesamtdauer
  stoesse: [0.3, 0.9, 1.5], stossDauer: 0.6, stossHin: 0.252, nah: 2.9, klopfen: 2.4,
}

const misch = (a: number, b: number, r: number) => a + (b - a) * r
const einaus = (u: number) => { u = clamp01(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2 }
const ein3 = (u: number) => { u = clamp01(u); return u * u * u }
/** Feder von 0 nach 1 mit Überschwingen und Ausklingen; u in Sekunden seit Beginn. */
export const feder = (u: number, k: number, w: number) => (u <= 0 ? 0 : 1 - Math.exp(-k * u) * Math.cos(w * u))

export interface FlugWerte {
  w0: number; wa: number[]; wb: number[]; wp: number[]
  xa: number[]; xb: number[]; xp: number[]; db: number[]; dp: number[]; jp: number
  tipp: number; tippX: number
}
/** Feste Zufallswerte je Saat: Frequenzen, Phasen, Zeitpunkt und Stelle des Tippens. */
export function flugWerte(saat: number): FlugWerte {
  let s = Math.floor(saat * 7919) + 13
  const zz = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
  const v = Array.from({ length: 22 }, zz)
  return {
    w0: (3.3 + 1.5 * v[0]) * (v[1] < 0.5 ? 1 : -1),
    wa: [2.6 + 1.4 * v[2], 1.8 + 1.2 * v[3]], wb: [1.1 + 0.9 * v[4], 2.7 + 1.6 * v[5]], wp: [v[6] * TAU, v[7] * TAU],
    xa: [0.62, 0.28, 0.1], xb: [0.8 + 0.7 * v[8], 1.9 + 1.3 * v[9], 4.2 + 2.2 * v[10]], xp: [v[11] * TAU, v[12] * TAU, v[13] * TAU],
    db: [1.3 + 1.2 * v[14], 3.1 + 1.8 * v[15]], dp: [v[16] * TAU, v[17] * TAU], jp: v[18] * TAU,
    tipp: AUFTRITT.tippAb + AUFTRITT.tippZufall * v[19], tippX: 0.15 + 0.7 * v[20],
  }
}

export interface Rechteck { left: number; top: number; width: number; height: number }
export interface FlugPunkt { x: number; y: number; z: number }
/** Der Köder zum Zeitpunkt t (s): Lage im Display; z > 0 vor dem Knopf, z < 0 dahinter. */
export function flugPunkt(k: Rechteck, F: FlugWerte, t: number): FlugPunkt {
  let p = F.w0 * t
  for (let j = 0; j < 2; j++) p += (F.wa[j] * (Math.cos(F.wp[j]) - Math.cos(F.wb[j] * t + F.wp[j]))) / F.wb[j]
  let q = 0
  for (let m = 0; m < 3; m++) q += F.xa[m] * Math.sin(F.xb[m] * t + F.xp[m])
  const d = k.height / 2 + 19 + 9 * Math.sin(F.db[0] * t + F.dp[0]) + 5 * Math.sin(F.db[1] * t + F.dp[1])
  return {
    x: k.left + k.width / 2 + (k.width / 2 - 6) * q + 1.8 * Math.sin(19 * t + F.jp),
    y: k.top + k.height / 2 - d * Math.cos(p) + 1.6 * Math.cos(23 * t + F.jp),
    z: Math.sin(p),
  }
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
