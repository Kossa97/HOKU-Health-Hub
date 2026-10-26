/**
 * Reine Geometrie für Dot: Abstandsfelder (SDF) der Wände, gegen die er stößt.
 * Ohne DOM und ohne Zustand, damit sie sich prüfen lassen.
 *
 * Vorzeichen überall gleich: `d > 0` heißt frei (im Bildschirm, außerhalb der
 * Leiste), `n` zeigt in den freien Raum.
 */

export interface Abstand { d: number; nx: number; ny: number }
export interface Rand { l: number; t: number; r: number; b: number }
export interface Kapsel { l: number; r: number; t: number; b: number }
export interface Knopf { x: number; y: number; rad: number }

export const FERN: Abstand = { d: 999, nx: 0, ny: -1 }

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
export const clamp01 = (x: number) => clamp(x, 0, 1)
export const easeOut3 = (x: number) => 1 - Math.pow(1 - x, 3)
export const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
export const TAU = Math.PI * 2
export function winkelAbstand(a: number, b: number) {
  let d = (a - b) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

/**
 * Die runden Ecken des Bildschirms: außerhalb des Bogens ist kein Platz.
 * `untenGerade` gilt über der Tastatur — deren Kante hat keine Rundung.
 */
export function eckenAbstand(px: number, py: number, b: Rand, radius: number, untenGerade: boolean): Abstand {
  if (radius <= 0) return FERN
  let cy: number
  if (py < b.t + radius) cy = b.t + radius
  else if (py > b.b - radius && !untenGerade) cy = b.b - radius
  else return FERN
  let cx: number
  if (px < b.l + radius) cx = b.l + radius
  else if (px > b.r - radius) cx = b.r - radius
  else return FERN
  const dx = px - cx, dy = py - cy, l = Math.hypot(dx, dy) || 1e-6
  return { d: radius - l, nx: -dx / l, ny: -dy / l }
}

/**
 * Der ganze Bildschirmrand als eine Fläche (abgerundetes Rechteck). In einer
 * Ecke läuft die flache Form so um den Bogen herum, statt an ihm zu enden.
 */
export function rahmenAbstand(px: number, py: number, b: Rand, radius: number, untenGerade: boolean): Abstand {
  const cx = (b.l + b.r) / 2, cy = (b.t + b.b) / 2
  const R = py < cy ? radius : untenGerade ? 0 : radius
  const sx = px < cx ? -1 : 1, sy = py < cy ? -1 : 1
  const qx = Math.abs(px - cx) - ((b.r - b.l) / 2 - R), qy = Math.abs(py - cy) - ((b.b - b.t) / 2 - R)
  if (qx > 0 && qy > 0) {
    const l = Math.hypot(qx, qy) || 1e-6
    return { d: R - l, nx: (-sx * qx) / l, ny: (-sy * qy) / l }
  }
  return qx > qy ? { d: R - qx, nx: -sx, ny: 0 } : { d: R - qy, nx: 0, ny: -sy }
}

/** Die Leiste: eine liegende Kapsel und der runde Plus-Knopf daneben. */
export function leistenAbstand(px: number, py: number, kapsel: Kapsel, plus: Knopf | null): Abstand {
  const rad = (kapsel.b - kapsel.t) / 2, yc = kapsel.t + rad, qx = clamp(px, kapsel.l + rad, kapsel.r - rad)
  const dx = px - qx, dy = py - yc, l = Math.hypot(dx, dy) || 1e-6
  let o: Abstand = { d: l - rad, nx: dx / l, ny: dy / l }
  if (plus) {
    const ex = px - plus.x, ey = py - plus.y, el = Math.hypot(ex, ey) || 1e-6, pd = el - plus.rad
    if (pd < o.d) o = { d: pd, nx: ex / el, ny: ey / el }
  }
  return o
}

/**
 * Ein Kasten mit runden Ecken als Körper (die Mitte der Statusleiste mit der
 * Kamera-Insel). d > 0 außerhalb, die Normale zeigt vom Kasten weg.
 */
export function kastenAbstand(px: number, py: number, k: Rand, radius: number): Abstand {
  const cx = (k.l + k.r) / 2, cy = (k.t + k.b) / 2, sx = px < cx ? -1 : 1, sy = py < cy ? -1 : 1
  const R = Math.min(radius, (k.r - k.l) / 2, (k.b - k.t) / 2)
  const qx = Math.abs(px - cx) - ((k.r - k.l) / 2 - R), qy = Math.abs(py - cy) - ((k.b - k.t) / 2 - R)
  if (qx > 0 && qy > 0) {
    const l = Math.hypot(qx, qy) || 1e-6
    return { d: l - R, nx: (sx * qx) / l, ny: (sy * qy) / l }
  }
  return qx > qy ? { d: qx - R, nx: sx, ny: 0 } : { d: qy - R, nx: 0, ny: sy }
}

/** Apples Projektion des Endpunkts (Designing Fluid Interfaces), etwas kürzer. */
export const projektion = (v: number) => ((v / 1000) * 0.993) / (1 - 0.993)

/** Gummiband: über die Grenze hinaus folgt er dem Finger immer zäher. */
export const gummi = (ueber: number, mass: number) => (ueber * mass * 0.55) / (mass + 0.55 * Math.abs(ueber))

export interface Flaeche { l: number; r: number; t: number; b: number }
export const ueberlappt = (s: Flaeche, zonen: readonly Flaeche[]) =>
  zonen.some(z => s.l < z.r && s.r > z.l && s.t < z.b && s.b > z.t)

/** Bis wann ist es noch hin? „3 Std. 5 Min." aus Minuten. */
export function dauerText(minuten: number, std: string, min: string) {
  const m = Math.max(0, Math.round(minuten))
  const h = Math.floor(m / 60), r = m % 60
  return [h ? `${h} ${std}` : '', r || !h ? `${r} ${min}` : ''].filter(Boolean).join(' ')
}
