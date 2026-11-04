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

/** Stand der Linse: linke Kante und Breite der Pille, `t` 0 Pille … 1 Linse, je mit Geschwindigkeit. */
export interface LinsenStand { x: number; w: number; t: number; vx: number; vw: number; vt: number }
/** Wohin sie will. */
export interface LinsenZiel { x: number; w: number; gehalten: boolean }
/** Maße der gerenderten Pille und wie stark die Linse wird (aus den --linse-* Variablen). */
export interface LinsenMasse {
  /** gerenderte Breite, Höhe und Einzug der Pille (px) */
  w0: number; h0: number; einzug: number
  wachsen: number; hoehe: number; heben: number; zoom: number
  /** Brechung am Rand, 0–1 (--linse-rand) */
  rand?: number
  /** Größe eines Gerätepixels in CSS-px: in Ruhe rastet die Pille darauf ein */
  raster?: number
}

/**
 * Die Brechung am Rand, in Ringen von außen nach innen: im Ring wird die
 * Kopie mit kleinerem Maßstab abgebildet — dort zeigt das Glas wie eine dicke,
 * gewölbte Kante mehr von der Umgebung, zusammengedrückt. `breite` in px der
 * ungewachsenen Pille, `faktor` wie stark der Maßstab dort sinkt (× rand).
 */
export const SAEUME = [
  { breite: 8, faktor: 0.22 },
  { breite: 3.5, faktor: 0.5 },
] as const

export const BILD = 1 / 60

/** Groß, solange ein Finger liegt oder die Linse noch unterwegs ist. */
export const tZiel = (s: LinsenStand, z: LinsenZiel) =>
  z.gehalten || Math.abs(z.x - s.x) > 1.5 || Math.abs(s.vx) > 40 ? 1 : 0

/** Ein Bild der Feder; `lage` treibt Ort und Breite, FEDER_LINSE die Größe. */
export function linsenSchritt(s: LinsenStand, z: LinsenZiel, lage: Feder, dt: number): LinsenStand {
  const [x, vx] = federSchritt(s.x, s.vx, z.x, lage, dt)
  const [w, vw] = federSchritt(s.w, s.vw, z.w, lage, dt)
  const [t, vt] = federSchritt(s.t, s.vt, tZiel(s, z), FEDER_LINSE, dt)
  return { x, w, t, vx, vw, vt }
}

export const ruhig = (s: LinsenStand, z: LinsenZiel) =>
  Math.abs(z.x - s.x) < 0.3 && Math.abs(s.vx) < 4 && Math.abs(z.w - s.w) < 0.3 && Math.abs(s.vw) < 4
  && Math.abs((z.gehalten ? 1 : 0) - s.t) < 0.005 && Math.abs(s.vt) < 0.05

export const endStand = (z: LinsenZiel): LinsenStand =>
  ({ x: z.x, w: z.w, t: z.gehalten ? 1 : 0, vx: 0, vw: 0, vt: 0 })

/**
 * Der ganze Weg bis zur Ruhe, ein Stand je Bild (1/60 s), der letzte ist das
 * Ziel. Daraus werden Keyframes: der Browser spielt sie selbst ab, auch wenn
 * die Seite gerade aufgebaut wird und das Skript keine Zeit hat.
 */
export function planeWeg(start: LinsenStand, z: LinsenZiel, lage: Feder, maxSek = 4): LinsenStand[] {
  const weg = [start]
  let s = start
  for (let i = 0; i < maxSek / BILD && !ruhig(s, z); i++) {
    s = linsenSchritt(s, z, lage, BILD)
    weg.push(s)
  }
  weg[weg.length - 1] = endStand(z)
  return weg
}

const px = (n: number) => `${Math.round(n * 100) / 100}px`
const zahl = (n: number) => String(Math.round(n * 10000) / 10000)

/**
 * Wie die Linse in einem Stand aussieht — nur `transform` und `opacity`, damit
 * nichts neu vermessen oder gemalt werden muss.
 *
 * Die Pille ist so breit gerendert wie ihr Ziel (`w0`); Ort, Wachsen und
 * Dehnen sind ein `transform` um ihre Mitte. Die farbige Kopie der Symbole
 * liegt IN der Pille und muss deren Skalierung aufheben: sie wird so gesetzt,
 * dass jedes Symbol über seinem echten steht, um die Mitte der Linse um
 * `zoom` vergrößert.
 */
export function linsenBild(s: LinsenStand, m: LinsenMasse) {
  const t = s.t
  const dehnen = Math.min(0.22, Math.abs(s.vx) / 2200)
  const sx = (m.w0 > 0 ? (s.w + m.wachsen * t) / m.w0 : 1) * (1 + dehnen)
  const sy = (m.h0 > 0 ? (m.h0 + m.hoehe * t) / m.h0 : 1) * (1 - dehnen * 0.5)
  const mitte = s.x + s.w / 2
  const ty = -m.heben * t
  const z = 1 + (m.zoom - 1) * t
  const glatt = Math.abs(sx - 1) < 1e-4 && Math.abs(sy - 1) < 1e-4 && Math.abs(ty) < 1e-3
  // In Ruhe genau auf Gerätepixel: sonst rundet der Browser Pille, Kopie und
  // echte Symbole verschieden, und beim Scrollen zucken die Symbole.
  let tx = mitte - m.w0 / 2
  if (glatt && m.raster) tx = Math.round(tx / m.raster) * m.raster
  const cx = tx + m.w0 / 2
  const pille = glatt ? `translateX(${px(tx)})` : `translateX(${px(tx)}) translateY(${px(ty)}) scale(${zahl(sx)}, ${zahl(sy)})`
  const bx = m.w0 / 2 - (z / sx) * cx
  const by = m.h0 / 2 + m.einzug - (z / sy) * (m.einzug + m.h0 / 2 + ty)
  const kopie = glatt && Math.abs(z - 1) < 1e-4
    ? `translateX(${px(bx)})`
    : `translate(${px(bx)}, ${px(by)}) scale(${zahl(z / sx)}, ${zahl(z / sy)})`
  const rand = m.rand ?? 0
  const saeume = SAEUME.map(({ faktor }) => {
    const zs = 1 + (m.zoom * (1 - faktor * rand) - 1) * t
    const sbx = m.w0 / 2 - (zs / sx) * cx
    const sby = m.h0 / 2 + m.einzug - (zs / sy) * (m.einzug + m.h0 / 2 + ty)
    return `translate(${px(sbx)}, ${px(sby)}) scale(${zahl(zs / sx)}, ${zahl(zs / sy)})`
  })
  return { pille, kopie, saeume, glas: Math.min(1, Math.max(0, t)), linse: t > 0.02 }
}

const masken = new Map<string, string>()

/**
 * Maske eines Rings an der Innenkante einer Kapsel (w × h), `breite` px
 * breit, weich auslaufend. Als SVG-Bild, einmal je Größe gerechnet.
 */
export function saumMaske(w: number, h: number, breite: number, rund = h / 2): string {
  const key = `${Math.round(w)}|${Math.round(h)}|${breite}|${Math.round(rund)}`
  const fertig = masken.get(key)
  if (fertig) return fertig
  const b = breite
  const kapsel = (x: number, y: number, kw: number, kh: number, kr0: number) => {
    const kr = Math.max(0, Math.min(kh / 2, kw / 2, kr0))
    return `M${x + kr},${y}H${x + kw - kr}A${kr},${kr} 0 0 1 ${x + kw - kr},${y + kh}H${x + kr}A${kr},${kr} 0 0 1 ${x + kr},${y}Z`
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>`
    + `<defs><filter id='f' x='-10%' y='-10%' width='120%' height='120%'><feGaussianBlur stdDeviation='${Math.max(0.6, b / 4)}'/></filter></defs>`
    + `<path fill-rule='evenodd' fill='#000' filter='url(#f)' d='${kapsel(-2, -2, w + 4, h + 4, rund + 2)}${kapsel(b, b, Math.max(0, w - 2 * b), Math.max(0, h - 2 * b), Math.max(0, rund - b))}'/>`
    + `</svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  masken.set(key, url)
  return url
}
