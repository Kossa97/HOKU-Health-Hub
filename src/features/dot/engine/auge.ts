/**
 * Hokus Auge (Mockup „Hoku Varianten", Runden 4–7, Nutzer 02.11.2026).
 *
 * - Augapfel: Hoku dreht sich als Ganzes zum Blickziel (D10, ruhig und genau);
 *   bei großen Sprüngen und im Flug mit etwas Masse (D11, schwingt leicht nach).
 *   Seine Punkte rollen dabei langsam um die Blickachse.
 * - Pupille als Irisblende: Punkte vor der Pupille weichen an ihren Rand und
 *   bilden einen hellen, dichten Ring; dahinter liegende Punkte verschwinden.
 * - Blinzeln: ein Lid aus Punkten gleitet von oben über die Pupille (schließt
 *   in 90 ms, öffnet in 170 ms), manchmal doppelt.
 * - Zuhören (Zuhören 4): Die Pupille wird etwas größer, ein Teil der Punkte
 *   löst sich als heller Ring, der im Takt der Stimme schneller dreht.
 *
 * Reine Rechnung ohne DOM, damit sie testbar ist. Lage in Hokus Einheiten:
 * x nach rechts, y nach unten, z zum Betrachter, Kugelradius 1.
 */
import { clamp01 } from './geometry'

/** Pupillenradius in der Tangentialebene (Einheit: Kugelradius). */
export const PUPILLE = 0.4
/** So groß wird sie beim Zuhören. */
export const PUPILLE_HOEREN = 1.12
/** Anteil der Punkte, die beim Zuhören den Irisring bilden (nach `u`). */
export const IRIS_ANTEIL = 0.1

export interface Auge {
  // Blick (−0,62 … 0,62, x/y wie der Bildschirm), geglättet
  gx: number; gy: number
  // Ausrichtung des Körpers, an Federn
  yaw: number; pitch: number; vyaw: number; vpitch: number
  // Blicksprünge, wenn nichts Bestimmtes zu sehen ist
  sx: number; sy: number; naechsterBlick: number
  // Lid: 0 offen, 1 zu
  lidP: number; blinzelAb: number; zweites: number; naechstesBlinzeln: number
  /** Kurz nach dem Blinzeln ist die Pupille etwas weiter. */
  weit: number
  /** 0 = Auge nicht zu sehen (andere Form, zu klein, an der Wand), 1 = offen. */
  offen: number
  /** Zuhören 0 … 1, und der Winkel des Irisrings. */
  hoer: number; irisW: number
  t: number
  // je Bild abgeleitet
  G: [number, number, number]; rx: [number, number, number]; uy: [number, number, number]
  rp: number; lidKante: number; stimme: number
}

export function neuesAuge(): Auge {
  return {
    gx: 0, gy: 0, yaw: 0, pitch: 0, vyaw: 0, vpitch: 0, sx: 0, sy: 0, naechsterBlick: 1.5,
    lidP: 0, blinzelAb: -1, zweites: -1, naechstesBlinzeln: 2.5, weit: 0, offen: 0, hoer: 0, irisW: 0, t: 0,
    G: [0, 0, 1], rx: [1, 0, 0], uy: [0, 1, 0], rp: PUPILLE, lidKante: -PUPILLE, stimme: 0,
  }
}

/** Lidstellung beim Blinzeln, `tb` Sekunden nach Beginn: zu in 90 ms, 50 ms geschlossen, auf in 170 ms. */
export function lidStand(tb: number): number {
  if (tb < 0) return 0
  if (tb < 0.09) { const x = tb / 0.09; return x * x }
  if (tb < 0.14) return 1
  if (tb < 0.31) { const x = (tb - 0.14) / 0.17; return Math.pow(1 - x, 3) }
  return 0
}

export interface AugenEingabe {
  /** Wohin er schauen soll (Blickeinheiten), `null` = umherschauen. */
  ziel: { gx: number; gy: number } | null
  /** Großer Sprung oder im Flug: mit Masse (D11) statt ruhig (D10). */
  gross: boolean
  /** Darf das Auge zu sehen sein? */
  sichtbar: boolean
  hoert: boolean
  /** Lautstärke der Stimme 0 … 1 (beim Zuhören). */
  stimme: number
  weniger: boolean
  zufall?: () => number
}

const feder = (x: number, v: number, ziel: number, k: number, zeta: number, dt: number): [number, number] => {
  v += (k * (ziel - x) - 2 * Math.sqrt(k) * zeta * v) * dt
  return [x + v * dt, v]
}

export function blinzle(a: Auge, doppelt = false) {
  if (a.blinzelAb >= 0) return
  a.blinzelAb = a.t
  a.zweites = doppelt ? a.t + 0.36 : -1
}

/** Ein Schritt: Blick, Ausrichtung, Lid, Zuhören. Danach gelten G, rx, uy, rp und lidKante für dieses Bild. */
export function augeSchritt(a: Auge, dt: number, e: AugenEingabe) {
  const zufall = e.zufall ?? Math.random
  dt = Math.min(dt, 0.05)
  a.t += dt

  // Blickziel: bestimmt oder Blicksprünge
  if (e.ziel) { a.sx = e.ziel.gx; a.sy = e.ziel.gy; a.naechsterBlick = a.t + 1.2 + zufall() * 1.5 }
  else if (!e.weniger && a.t > a.naechsterBlick) {
    a.sx = (zufall() * 2 - 1) * 0.42; a.sy = (zufall() * 2 - 1) * 0.3
    a.naechsterBlick = a.t + 1.1 + zufall() * 2.4
  }
  if (e.weniger) { a.sx = e.ziel ? e.ziel.gx : 0; a.sy = e.ziel ? e.ziel.gy : 0 }
  const kb = e.weniger ? 1 : 1 - Math.exp(-dt * 12)
  a.gx += (a.sx - a.gx) * kb; a.gy += (a.sy - a.gy) * kb

  // Körper dreht sich zum Blick (D10 ruhig, D11 bei großen Bewegungen mit Masse)
  const yawZiel = Math.asin(Math.max(-0.62, Math.min(0.62, a.gx)))
  const pitchZiel = -Math.asin(Math.max(-0.5, Math.min(0.5, a.gy)))
  if (e.weniger) { a.yaw = yawZiel; a.pitch = pitchZiel; a.vyaw = a.vpitch = 0 }
  else {
    const k = e.gross ? 46 : 70, z = e.gross ? 0.72 : 1
    ;[a.yaw, a.vyaw] = feder(a.yaw, a.vyaw, yawZiel, k, z, dt)
    ;[a.pitch, a.vpitch] = feder(a.pitch, a.vpitch, pitchZiel, k, z, dt)
  }

  // Lid: von selbst blinzeln, sonst offen
  if (!e.weniger && a.blinzelAb < 0 && a.t > a.naechstesBlinzeln && a.offen > 0.9) blinzle(a, zufall() < 0.22)
  if (a.blinzelAb >= 0) {
    let tb = a.t - a.blinzelAb
    if (a.zweites > 0 && a.t >= a.zweites) { a.blinzelAb = a.zweites; a.zweites = -1; tb = 0 }
    a.lidP = e.weniger ? 0 : lidStand(tb)
    if (tb > 0.31 && a.zweites < 0) {
      a.blinzelAb = -1; a.lidP = 0; a.weit = 1
      a.naechstesBlinzeln = a.t + 2.6 + zufall() * 3.6
    }
  }
  a.weit *= Math.exp(-dt * 2.5)

  // Sichtbarkeit: zu schnell (wie ein Lid), auf etwas langsamer
  const offenZiel = e.sichtbar ? 1 : 0
  a.offen += (offenZiel - a.offen) * (e.weniger ? 1 : 1 - Math.exp(-dt * (offenZiel > a.offen ? 7 : 22)))

  // Zuhören: Irisring löst sich, dreht im Takt der Stimme
  a.hoer += ((e.hoert ? 1 : 0) - a.hoer) * (e.weniger ? 1 : 1 - Math.exp(-dt * 4))
  a.stimme = e.hoert ? clamp01(e.stimme) : 0
  if (!e.weniger) a.irisW += dt * (0.35 + 1.8 * a.stimme)

  // Achsen für dieses Bild
  const cp = Math.cos(a.pitch), sp = Math.sin(a.pitch), cy = Math.cos(a.yaw), sy = Math.sin(a.yaw)
  const G = a.G
  G[0] = cp * sy; G[1] = -sp; G[2] = cp * cy
  const rl = Math.hypot(G[2], G[0]) || 1
  a.rx[0] = G[2] / rl; a.rx[1] = 0; a.rx[2] = -G[0] / rl
  // unten in der Pupillenebene: G × rx, so gedreht, dass y nach unten zeigt
  let ux = G[1] * a.rx[2] - G[2] * a.rx[1], uyy = G[2] * a.rx[0] - G[0] * a.rx[2], uz = G[0] * a.rx[1] - G[1] * a.rx[0]
  if (uyy < 0) { ux = -ux; uyy = -uyy; uz = -uz }
  a.uy[0] = ux; a.uy[1] = uyy; a.uy[2] = uz
  a.rp = PUPILLE * (1 + 0.1 * a.weit) * (1 + (PUPILLE_HOEREN - 1) * a.hoer)
  // Lidkante: wandert mit dem Lid von oben (offen) nach unten (zu); geschlossen auch, wenn das Auge nicht zu sehen ist
  const lid = Math.max(a.lidP, 1 - a.offen)
  a.lidKante = -a.rp * 1.08 + 2.16 * a.rp * lid
}

/**
 * Lage eines Punkts der Kugel (Bildraum, schon gedreht) unter dem Auge.
 * Schreibt in `aus`: x, y, Sichtbarkeit (Faktor), Licht (Faktor), z.
 * `iris`: der Punkt gehört zum Irisring (beim Zuhören), `i` sein Platz darin.
 */
export function augePunkt(a: Auge, x: number, y: number, z: number, iris: boolean, i: number, aus: number[]) {
  aus[0] = x; aus[1] = y; aus[2] = 1; aus[3] = 1; aus[4] = z
  const offen = a.offen
  if (offen < 0.005) return
  const G = a.G, rx = a.rx, uy = a.uy, rp = a.rp
  const dd = x * G[0] + y * G[1] + z * G[2]
  const pa = x * rx[0] + z * rx[2], pb = x * uy[0] + y * uy[1] + z * uy[2]
  const kante = a.lidKante - 1.1 * pa * pa
  const bedeckt = pb < kante

  if (dd <= 0.5) {
    // dahinter: was durch die Pupille zu sehen wäre, verschwindet
    if (!bedeckt) aus[2] = 1 - 0.97 * (1 - glatt(rp * 0.85, rp * 1.05, Math.hypot(pa, pb))) * offen
  } else {
    const r = Math.hypot(pa, pb), aussen = rp * 1.3
    if (!bedeckt && r < aussen) {
      // Irisblende: aus der Pupille an ihren Rand
      const q = r / aussen, r2 = rp * (1 + 0.28 * q), schub = (r2 - r) * offen
      const nx = r > 1e-4 ? pa / r : 1, ny = r > 1e-4 ? pb / r : 0
      aus[0] += (nx * rx[0] + ny * uy[0]) * schub
      aus[1] += ny * uy[1] * schub
      aus[3] = 1 + 0.45 * (1 - q) * offen
    }
    // Lidkante leuchtet, solange das Lid in Bewegung ist
    const lid = Math.max(a.lidP, 1 - offen)
    if (lid > 0.04 && lid < 0.98 && r < aussen) {
      const naehe = 1 - glatt(0, 0.06, Math.abs(pb - kante))
      aus[3] = Math.max(aus[3], 1 + 0.7 * naehe)
    }
  }

  // Zuhören: Irispunkte lösen sich vom Körper und drehen sich um die Pupille
  if (iris && a.hoer > 0.01) {
    const st = a.stimme, rho = rp * 1.28 * (1 + 0.06 * st)
    const w = i * 2.399963 + a.irisW, c = Math.cos(w), s = Math.sin(w)
    const tief = Math.sqrt(Math.max(0, 1 - rho * rho)), heb = 1.08
    const ix = (G[0] * tief + rho * (c * rx[0] + s * uy[0])) * heb
    const iy = (G[1] * tief + rho * s * uy[1]) * heb
    const iz = (G[2] * tief + rho * (c * rx[2] + s * uy[2])) * heb
    const unterLid = rho * s < a.lidKante - 1.1 * rho * rho * c * c ? 1 : 0
    const L = a.hoer * offen
    aus[0] += (ix - aus[0]) * L; aus[1] += (iy - aus[1]) * L; aus[4] += (iz - aus[4]) * L
    aus[2] += (1 - 0.9 * unterLid - aus[2]) * L
    aus[3] += (1.3 + 0.6 * st - aus[3]) * L
  }
}

function glatt(a: number, b: number, x: number) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }

/**
 * Blickziel zu einem Punkt auf dem Bildschirm (px), von Hoku (Mitte, Radius in px) aus.
 * Ganz nah (auf ihm) schaut er dich an.
 */
export function blickZu(hx: number, hy: number, r: number, px: number, py: number) {
  const dx = px - hx, dy = py - hy, d = Math.hypot(dx, dy)
  if (d < r * 0.8) return { gx: 0, gy: 0 }
  const s = Math.min(0.62, d / (r * 3.5)) / d
  return { gx: dx * s, gy: dy * s }
}
