/**
 * Wie Hoku einen Satz schreibt und wieder zur Kugel wird.
 *
 * Aus dem Mockup „Hokus Schrift" (Nutzer 31.10.2026): alle sechs Arten kommen in die App,
 * jeder Satz bekommt die nächste aus einem gemischten Stapel, egal welcher Satz und wo.
 * „wirbel" (die bisherige) und „klar" federn wie jeder Formwechsel; die übrigen vier
 * laufen auf festen Bahnen, die hier stehen. Danach übernehmen wieder die Federn.
 *
 * Lagen in px um Hokus Mitte (y nach unten), z = Sichtbarkeit 0…1. `von` ist beim
 * Schreiben die Lage in der Kugel, beim Zurückkehren die im Satz; `nach` umgekehrt.
 */
import { clamp01, easeIO, easeOut3 as aus3 } from './geometry'

export type SchriftArt = 'wirbel' | 'klar' | 'feder' | 'pop' | 'klappen' | 'rasten'
export const SCHRIFT_ARTEN: readonly SchriftArt[] = ['wirbel', 'klar', 'feder', 'pop', 'klappen', 'rasten']
export type BahnArt = Exclude<SchriftArt, 'wirbel' | 'klar'>
export const istBahn = (a: SchriftArt): a is BahnArt => a !== 'wirbel' && a !== 'klar'
/** So lange laufen die Bahnen (s) beim Schreiben und beim Zurückkehren; danach steht jeder Punkt an seinem Ziel. */
export const BAHN_DAUER: Record<BahnArt, { ein: number; aus: number }> = {
  feder: { ein: 1.6, aus: 1.25 }, pop: { ein: 1.6, aus: 1.25 }, klappen: { ein: 1, aus: 1 }, rasten: { ein: 0.95, aus: 0.9 },
}

/**
 * Nächste Art aus dem Stapel: erst wenn alle sechs dran waren, wird neu gemischt,
 * und nie kommt dieselbe zweimal hintereinander (auch nicht über die Grenze des Stapels).
 * Der Stapel wird verbraucht (von hinten).
 */
export function naechsteSchrift(stapel: SchriftArt[], letzte: SchriftArt | null, zufall: () => number = Math.random): SchriftArt {
  if (!stapel.length) {
    stapel.push(...SCHRIFT_ARTEN)
    for (let i = stapel.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [stapel[i], stapel[j]] = [stapel[j], stapel[i]] }
    if (stapel[stapel.length - 1] === letzte) [stapel[0], stapel[stapel.length - 1]] = [stapel[stapel.length - 1], stapel[0]]
  }
  return stapel.pop()!
}

const weich = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x) }
const easeOut3 = (x: number) => aus3(clamp01(x))
const hinaus = (x: number) => { x = clamp01(x) - 1; return 1 + 2.70158 * x * x * x + 1.70158 * x * x }
const bogen = (a: number, m: number, c: number, u: number) => { const v = 1 - u; return v * v * a + 2 * v * u * m + u * u * c }
/** Licht in der Schrift: ein Lauf von links nach rechts, leises Flackern. */
export const lichtLauf = (t: number, x: number, s: number, staerke: number, funkeln: number) =>
  1 + staerke * Math.max(0, Math.sin(t * 2.2 - x * 0.028)) + funkeln * Math.sin(t * 3.1 + s * 4)
/** Sichtbarkeit eines Schriftpunkts aus seiner Dicke (nicht genutzte Punkte < 0): nie unter 0,8, damit die Schrift nicht blass wirkt. */
export const schriftSicht = (dicke: number) => dicke < 0 ? 0 : 0.8 + 0.2 * dicke
/** Licht der fertigen Schrift: Stärke des Laufs und des Flackerns. */
export interface SchriftLicht { licht: number; funkeln: number }

/** Ein Punkt auf seiner Bahn. */
export interface BahnPunkt {
  ax: number; ay: number; az: number
  bx: number; by: number; bz: number
  /** Zufall 0…1 und Phase je Punkt; Kind = einer der Punkte, die nur für die Schrift aus Hoku heraustreten. */
  k: number; s: number; kind: boolean
  /** Lesereihenfolge 0…1, Buchstabe, dessen Mitte (px) und Zahl der Buchstaben. */
  lese: number; bi: number; mx: number; my: number; n: number
}
/** Ergebnis: Lage (px), Sichtbarkeit, Licht, Größe (1 = wie in der Kugel). */
export type BahnLage = [number, number, number, number, number]

/**
 * Lage eines Punkts `pt` Sekunden nach dem Wechsel. `g` ist die Größe der Schriftpunkte,
 * `t` die laufende Zeit (für Licht und Zittern), `sl` das Licht der fertigen Schrift
 * (am Ende der Bahn steht dasselbe Licht wie danach, sonst blitzt es beim Übergang).
 */
export function bahn(art: BahnArt, ein: boolean, pt: number, p: BahnPunkt, g: number, t: number, sl: SchriftLicht, out: BahnLage): BahnLage {
  const { ax, ay, az, bx, by, bz, k, s, kind } = p
  const lauf = (an = 1) => lichtLauf(t, bx, s, sl.licht * an, sl.funkeln * an)
  const set = (x: number, y: number, z: number, l: number, sz: number) => { out[0] = x; out[1] = y; out[2] = z; out[3] = l; out[4] = sz; return out }
  if (art === 'feder') {
    // Ein heller Kopf läuft in Leserichtung, die Punkte strömen im Bogen hinterher; die Kugel wird dabei zur Schrift
    if (ein) {
      const fort = clamp01(pt / 1.15), sk = 1 - 0.85 * easeIO(fort), kx = ax * sk, ky = ay * sk
      const u = clamp01((pt - p.lese * 1.05 - k * 0.05) / 0.42), e = easeOut3(u)
      if (u <= 0) return set(kx, ky, kind ? 0 : az * (1 - 0.3 * fort), 1, 1)
      const mx = (kx + bx) / 2, my = Math.min(ky, by) - 30 - 20 * k
      // der Kopf klingt bis zum Ende der Bahn ganz aus, sonst blitzt der letzte Buchstabe beim Übergang
      const kopf = Math.exp(-Math.pow((pt - 0.35 - p.lese * 1.05) / 0.09, 2)) * clamp01((BAHN_DAUER.feder.ein - pt) / 0.25)
      return set(bogen(kx, mx, bx, e), bogen(ky, my, by, e), bz * (kind ? e : 1), lauf() + 1.2 * kopf, 1 + (g - 1) * e)
    }
    // zurück von rechts nach links
    const e = easeIO(clamp01((pt - (1 - p.lese) * 0.55 - k * 0.08) / 0.5)), sk = 0.15 + 0.85 * easeIO(clamp01((pt - 0.2) / 0.8))
    const kx = bx * sk, ky = by * sk, mx = (kx + ax) / 2, my = Math.min(ky, ay) - 24 - 18 * k
    return set(bogen(ax, mx, kx, e), bogen(ay, my, ky, e), kind ? az * (1 - e) : az + (bz - az) * e, 1, g + (1 - g) * e)
  }
  if (art === 'pop') {
    // Hoku holt Luft, dann springt jeder Buchstabe einzeln heraus und federt mit Überschwinger an seinen Platz
    const ab = Math.min(0.055, 0.75 / Math.max(1, p.n))
    if (ein) {
      const luft = Math.sin(Math.PI * clamp01(pt / 0.3)), klein = 1 - 0.6 * weich(pt / 0.9)
      const kx = ax * (1 + 0.1 * luft) * klein, ky = ay * (1 - 0.12 * luft) * klein
      const u = clamp01((pt - 0.22 - p.bi * ab - k * 0.04) / 0.5)
      if (u <= 0) return set(kx, ky, kind ? 0 : az, 1, 1)
      const fl = easeOut3(clamp01(u / 0.55)), ent = hinaus(clamp01((u - 0.25) / 0.75)), los = 1 - clamp01(u * 3)
      const cx = bogen(0, p.mx * 0.5, p.mx, fl), cy = bogen(0, Math.min(0, p.my) - 40, p.my, fl)
      const x = cx + (bx - p.mx) * ent, y = cy + (by - p.my) * ent
      return set(x + (kx - x) * los, y + (ky - y) * los, (kind ? clamp01(u * 2.5) : 1) * bz, lauf(), 1 + (g - 1) * clamp01(u * 2))
    }
    // rückwärts wieder hinein
    const u = clamp01((pt - (p.n - 1 - p.bi) * ab * 0.8 - k * 0.04) / 0.45), sk = 0.4 + 0.6 * weich((pt - 0.3) / 0.8)
    const kx = bx * sk, ky = by * sk, ent = 1 - weich(u / 0.5), fl = easeIO(clamp01((u - 0.2) / 0.8))
    const cx = bogen(p.mx, p.mx * 0.5, kx, fl), cy = bogen(p.my, Math.min(0, p.my) - 30, ky, fl)
    return set(cx + (ax - p.mx) * ent, cy + (ay - p.my) * ent, kind ? az * (1 - fl) : az + (bz - az) * fl, 1, g + (1 - g) * fl)
  }
  if (art === 'klappen') {
    // Hoku wird zur leuchtenden Linie auf Höhe des Satzes, die sich nach oben und unten öffnet
    if (ein) {
      const ly = Math.sin(t * 6 + s * 3) * 0.6, sel = bz > 0 ? 1 : 0
      const a = easeIO(clamp01(pt / 0.38)), o = easeOut3(clamp01((pt - 0.38 - (Math.abs(bx) / 160) * 0.12) / 0.45))
      const x = ax + (bx - ax) * a, y = ay + (ly - ay) * a, vz = kind ? sel * a : az + (sel * 0.9 - az) * a
      return set(x, y + (by - y) * o, o > 0 ? vz + (bz - vz) * o : vz,
        (1 + 1.4 * a * (1 - o)) * lauf(o), 1 + (g * (o > 0 ? 1 : 0.8) - 1) * a)
    }
    const ly = Math.sin(t * 6 + s * 3) * 0.6, sel = az > 0 ? 1 : 0
    const c = easeIO(clamp01(pt / 0.35)), r = easeIO(clamp01((pt - 0.35 - (1 - Math.min(1, Math.abs(ax) / 160)) * 0.1) / 0.5))
    const y0 = ay + (ly - ay) * c, vz = az + (sel * 0.9 - az) * c
    return set(ax + (bx - ax) * r, y0 + (by - y0) * r, kind ? vz * (1 - r) : vz + (bz - vz) * r, 1 + 1.4 * c * (1 - r), g + (1 - g) * r)
  }
  // rasten: schnell hin, unscharf, dann scharf gestellt (mit kurzem Blitz beim Einrasten)
  if (ein) {
    const u = easeOut3(clamp01((pt - k * 0.12) / 0.32)), un = 14 * Math.pow(1 - clamp01((pt - 0.15) / 0.55), 2)
    const nx = Math.cos(s + t * 9) * un * k, ny = Math.sin(s * 1.7 + t * 8) * un * (1 - k), blitz = Math.exp(-Math.pow((pt - 0.72) / 0.07, 2))
    return set(ax + (bx - ax) * u + nx * u, ay + (by - ay) * u + ny * u, kind ? bz * u : az + (bz - az) * u,
      lauf(clamp01((pt - 0.55) / 0.25)) + 0.6 * blitz, 1 + (g - 1) * u)
  }
  const un = 12 * clamp01(pt / 0.3), u = easeIO(clamp01((pt - 0.2 - k * 0.15) / 0.5))
  const nx = Math.cos(s + t * 9) * un * k, ny = Math.sin(s * 1.7 + t * 8) * un * (1 - k)
  return set(ax + nx + (bx - ax - nx) * u, ay + ny + (by - ay - ny) * u, kind ? az * (1 - u) : az + (bz - az) * u, 1, g + (1 - g) * u)
}
