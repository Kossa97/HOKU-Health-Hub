/**
 * Hoku-Code: ein echter QR-Code mit der Profiladresse, selbst als SVG gezeichnet
 * (Spec 2c, Abschnitt 4).
 *
 * - Matrix aus `qrcode-generator` (Fehlerkorrektur H), nur die Matrix; gezeichnet
 *   wird hier.
 * - Datenmodule als Punkte, die drei Suchmarken als abgerundete Ringe mit Kern.
 * - Rund gesetzt: um das Quadrat ein Modul frei, dahinter helle Füllpunkte im
 *   Hoku-Verlauf bis zum Kreisrand. Sie tragen keine Daten und sind so hell, dass
 *   Kameras sie als Hintergrund lesen; ihr Muster folgt deterministisch aus der
 *   Adresse.
 * - Mitte: App-Symbol in einer runden Aussparung von etwa 7 % der Symbolfläche
 *   (H gleicht bis 30 % aus).
 * - Immer dunkel auf hell, auch im dunklen Sheet: die helle Kreisfläche gehört
 *   zum Bild und ist zugleich die Ruhezone.
 *
 * Reine Funktionen ohne DOM: dieselbe Ausgabe im Browser, in Tests (resvg) und
 * auf dem Server. Der Lesetest liegt in `hokuCode.read.test.ts`.
 */
import qrcode from 'qrcode-generator'
import { HOKU_CODE_SYMBOL } from './hokuCodeSymbol'
import { profileUrl } from './profileView'

/** Domain im Hoku-Code (Spec 2c, Frage 1). */
export const HOKU_CODE_ORIGIN = 'https://hokuhealth.app'

/** Anteil der Aussparung an der Symbolfläche (Module²). */
export const HOKU_CODE_CUTOUT_SHARE = 0.07

const INK = '#16171b'
const PAPER = '#ffffff'
const RING = '#c9ccd3'
/** Hoku-Verlauf (Cyan → Violett → Pink), stark aufgehellt: liest sich als Grund. */
const FILL_STOPS = [['0', '#c9efff'], ['.55', '#d6cbff'], ['1', '#ffcde5']] as const

const DOT_R = 0.47 // Datenpunkt; kleiner liest jsQR im Mockup ab 600 px nicht mehr
const FILL_R = 0.36
const RIM = 2.4 // Kreis um die Ecken des Quadrats, Rand inklusive

/** Profiladresse für den Code: `https://hokuhealth.app/u/<nickname klein>`, sicher kodiert. */
export function hokuCodeUrl(nickname: string): string {
  const name = nickname.trim()
  if (!name) throw new RangeError('Hoku-Code: Nickname fehlt')
  return profileUrl(name, HOKU_CODE_ORIGIN)
}

/** Adresse ohne Schema, wie sie unter dem Code und im `aria-label` steht. */
export function hokuCodeAddress(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

/**
 * QR-Matrix (Fehlerkorrektur H, kleinste passende Version), `true` = dunkel.
 * Nur druckbares ASCII: `qrcode-generator` schreibt im Byte-Modus je Zeichen ein
 * Byte; Umlaute kämen falsch an. Adressen aus `hokuCodeUrl` sind immer ASCII.
 */
export function hokuCodeMatrix(text: string): boolean[][] {
  if (!/^[\x21-\x7e]+$/.test(text)) throw new RangeError('Hoku-Code: nur druckbares ASCII')
  const qr = qrcode(0, 'H')
  qr.addData(text, 'Byte')
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => qr.isDark(y, x)))
}

/** Radius der Aussparung in Modulen: Kreisfläche = 7 % von n². */
export function hokuCodeCutoutRadius(moduleCount: number): number {
  return moduleCount * Math.sqrt(HOKU_CODE_CUTOUT_SHARE / Math.PI)
}

/** Zahl kurz und stabil (zwei Nachkommastellen, ohne Nullen am Ende). */
function num(v: number): string {
  const r = Math.round(v * 100) / 100
  return Object.is(r, -0) ? '0' : String(r)
}

/** Pseudo-Zufall aus der Adresse (FNV-1a als Startwert, dann xorshift32). */
function seeded(text: string): () => number {
  let s = 2166136261
  for (let i = 0; i < text.length; i++) s = Math.imul(s ^ text.charCodeAt(i), 16777619)
  if (s === 0) s = 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 1000) / 1000
  }
}

export interface HokuCodeSvgOptions {
  /** Präfix für die IDs von Verlauf und Beschnitt (mehrere Codes auf einer Seite). */
  idPrefix?: string
  /** Feste Breite und Höhe in px; ohne Angabe nur `viewBox` (Größe per CSS). */
  size?: number
}

/**
 * SVG des Hoku-Codes. Deterministisch: gleiche Adresse, gleiche Ausgabe.
 * Der Text der Adresse steht nicht im SVG, nur die Matrix.
 */
export function hokuCodeSvg(text: string, options: HokuCodeSvgOptions = {}): string {
  const m = hokuCodeMatrix(text)
  const n = m.length
  const h = n / 2
  const R = h * Math.SQRT2 + RIM
  const cut = hokuCodeCutoutRadius(n)
  const id = (options.idPrefix ?? 'hoku-code').replace(/[^A-Za-z0-9_-]/g, '') || 'hoku-code'
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7)

  let dots = ''
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!m[y][x] || finder(x, y)) continue
      const cx = x - h + 0.5
      const cy = y - h + 0.5
      if (Math.hypot(cx, cy) < cut) continue
      dots += `<circle cx="${num(cx)}" cy="${num(cy)}" r="${DOT_R}"/>`
    }
  }

  // Füllpunkte: außerhalb des Quadrats samt einem freien Modul, bis kurz vor den Rand
  const rnd = seeded(text)
  const span = Math.ceil(R)
  let fill = ''
  for (let y = -span; y < n + span; y++) {
    for (let x = -span; x < n + span; x++) {
      if (x >= -1 && x <= n && y >= -1 && y <= n) continue
      const cx = x - h + 0.5
      const cy = y - h + 0.5
      if (Math.hypot(cx, cy) > R - 1.3) continue
      if (rnd() < 0.5) fill += `<circle cx="${num(cx)}" cy="${num(cy)}" r="${FILL_R}"/>`
    }
  }

  const finderMark = (x: number, y: number) => {
    const px = x - h
    const py = y - h
    return `<rect x="${num(px + 0.5)}" y="${num(py + 0.5)}" width="6" height="6" rx="2.2" fill="none" stroke="${INK}" stroke-width="1"/>`
      + `<rect x="${num(px + 2)}" y="${num(py + 2)}" width="3" height="3" rx="1.1" fill="${INK}"/>`
  }

  const r = num(R)
  const img = cut - 0.75
  const size = options.size ? ` width="${num(options.size)}" height="${num(options.size)}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${r} -${r} ${num(2 * R)} ${num(2 * R)}"${size}>`
    + '<defs>'
    + `<linearGradient id="${id}-fill" gradientUnits="userSpaceOnUse" x1="-${r}" y1="-${r}" x2="${r}" y2="${r}">`
    + FILL_STOPS.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')
    + '</linearGradient>'
    + `<clipPath id="${id}-clip"><circle r="${num(img)}"/></clipPath>`
    + '</defs>'
    + `<circle r="${r}" fill="${PAPER}"/>`
    + `<circle r="${num(R - 0.45)}" fill="none" stroke="${RING}" stroke-width=".5"/>`
    + `<g fill="url(#${id}-fill)">${fill}</g>`
    + `<g fill="${INK}">${dots}</g>`
    + finderMark(0, 0) + finderMark(n - 7, 0) + finderMark(0, n - 7)
    + `<circle r="${num(cut - 0.3)}" fill="${PAPER}" stroke="${RING}" stroke-width=".3"/>`
    + `<image href="${HOKU_CODE_SYMBOL}" x="${num(-img)}" y="${num(-img)}" width="${num(2 * img)}" height="${num(2 * img)}"`
    + ` clip-path="url(#${id}-clip)" preserveAspectRatio="xMidYMid slice"/>`
    + '</svg>'
}
