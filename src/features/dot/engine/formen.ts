/**
 * Dots Formen aus seinen eigenen Punkten: Hand, Herz, X und Kein-Netz.
 *
 * Jede Silhouette wird einmal auf einer Offscreen-Canvas (640 px, Maßstab 2)
 * gezeichnet und mit einem Sechseck-Gitter abgetastet. Der Abstand ist so
 * gewählt, dass höchstens so viele Punkte hineinpassen, wie Dot hat; die
 * übrigen bleiben unsichtbar. Werte und Zeichnungen aus `docs/login/mockup.html`
 * (`sampleShape`, `drawHand`, `drawHeart`, `drawWifiOff`).
 *
 * Koordinaten sind in Mockup-Pixeln bei Radius 66; die Engine teilt durch
 * `FORM_R` und skaliert mit ihrem eigenen Radius.
 */
import { TAU } from './geometry'

export type DotForm = 'hand' | 'heart' | 'cross' | 'wifi'

/** Radius, für den die Formen gezeichnet sind. */
export const FORM_R = 66
/** Drehpunkt der Hand (Handgelenk), y in Mockup-Pixeln. */
export const HAND_GELENK = 92
/** Kein-Netz: Mitte der Bögen und der Schrägstrich. */
export const WIFI_O = 46
export const SL0 = [-66, -70], SL1 = [66, 62]

export interface Formen {
  /** je Punkt x, y, Dicke (0…1; < 0 = unsichtbar) */
  hand: Float32Array
  heart: Float32Array
  cross: Float32Array
  wifi: Float32Array
  /** größter Abstand eines Herzpunkts vom Kern (für die Lichtwelle) */
  herzMax: number
}

type Zeichnung = (c: CanvasRenderingContext2D) => void

function abgerundet(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill()
}

function finger(c: CanvasRenderingContext2D, bx: number, by: number, ang: number, len: number, w: number, glieder: number[]) {
  c.save(); c.translate(bx, by); c.rotate(ang)
  let y = 6
  const ws = [w, w * 0.9, w * 0.78]
  for (let i = 0; i < glieder.length; i++) {
    const L = len * glieder[i], ww = ws[i]
    abgerundet(c, -ww / 2, y - L, ww, L + 4, ww / 2)
    c.beginPath(); c.arc(0, y - L, ww * 0.52, 0, TAU); c.fill()
    y -= L
  }
  c.restore()
}

const hand: Zeichnung = c => {
  c.beginPath()
  c.moveTo(-36, 92)
  c.bezierCurveTo(-54, 70, -62, 30, -50, -22)
  c.bezierCurveTo(-46, -36, -30, -40, -14, -38)
  c.bezierCurveTo(10, -40, 40, -34, 50, -16)
  c.bezierCurveTo(60, 10, 56, 60, 40, 92)
  c.closePath(); c.fill()
  c.save(); c.translate(-38, 44); c.rotate(-0.5); c.beginPath(); c.ellipse(0, 0, 24, 36, 0, 0, TAU); c.fill(); c.restore()
  abgerundet(c, -30, 78, 62, 34, 16)
  finger(c, -38, -28, -0.16, 84, 24, [0.42, 0.33, 0.25])
  finger(c, -12, -36, -0.03, 94, 24, [0.42, 0.33, 0.25])
  finger(c, 15, -33, 0.09, 88, 22, [0.42, 0.33, 0.25])
  finger(c, 40, -20, 0.24, 66, 19, [0.42, 0.34, 0.24])
  finger(c, -54, 24, -0.92, 86, 27, [0.52, 0.48])
}

const herz: Zeichnung = c => {
  c.beginPath()
  for (let t = 0; t <= TAU + 0.01; t += 0.02) {
    const x = 16 * Math.pow(Math.sin(t), 3) * 4.6
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 4.6 + 3
    if (t === 0) c.moveTo(x, y); else c.lineTo(x, y)
  }
  c.closePath(); c.fill()
}

const kreuz: Zeichnung = c => {
  for (const a of [Math.PI / 4, -Math.PI / 4]) { c.save(); c.rotate(a); abgerundet(c, -80, -18, 160, 36, 18); c.restore() }
}

// Drei Bögen und ein Punkt, durchgestrichen, mit sauberer Lücke um den Strich
const keinNetz: Zeichnung = c => {
  c.lineCap = 'round'; c.strokeStyle = '#fff'; c.fillStyle = '#fff'
  for (const r of [34, 66, 98]) { c.lineWidth = 17; c.beginPath(); c.arc(0, WIFI_O, r, -Math.PI / 2 - 0.85, -Math.PI / 2 + 0.85); c.stroke() }
  c.beginPath(); c.arc(0, WIFI_O, 11, 0, TAU); c.fill()
  c.globalCompositeOperation = 'destination-out'; c.lineWidth = 28
  c.beginPath(); c.moveTo(SL0[0], SL0[1]); c.lineTo(SL1[0], SL1[1]); c.stroke()
  c.globalCompositeOperation = 'source-over'; c.lineWidth = 15
  c.beginPath(); c.moveTo(SL0[0], SL0[1]); c.lineTo(SL1[0], SL1[1]); c.stroke()
}

/**
 * Silhouette gleichmäßig mit höchstens `anzahl` Punkten füllen. Mit `gitter`
 * steht der Abstand fest (Schrift); ohne wird er so gewählt, dass höchstens
 * `anzahl` Punkte hineinpassen (Dots Formen).
 */
function abtasten(zeichne: Zeichnung, anzahl: number, gitter?: number): Float32Array {
  const S = 640, cv = document.createElement('canvas')
  cv.width = S; cv.height = S
  const g = cv.getContext('2d', { willReadFrequently: true })!
  g.translate(S / 2, S / 2); g.scale(2, 2); g.fillStyle = '#fff'; zeichne(g)
  const d = g.getImageData(0, 0, S, S).data
  const innen = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && d[((y | 0) * S + (x | 0)) * 4 + 3] > 120
  const dicke = (x: number, y: number) => {
    let tmax = 0
    for (const e of [3, 6, 9, 12, 16]) {
      const f = e * 0.7
      if (!(innen(x + e, y) && innen(x - e, y) && innen(x, y + e) && innen(x, y - e) && innen(x + f, y + f) && innen(x - f, y - f) && innen(x + f, y - f) && innen(x - f, y + f))) break
      tmax = e
    }
    return tmax
  }
  const raster = (gr: number) => {
    const out: number[][] = []
    let zeile = 0
    for (let y = 0; y < S; y += gr * 0.866, zeile++) {
      for (let x = zeile % 2 ? gr / 2 : 0; x < S; x += gr) if (innen(x, y)) out.push([x - S / 2, y - S / 2, dicke(x, y)])
    }
    return out
  }
  let pts: number[][] = []
  if (gitter) pts = raster(gitter)
  else {
    let flaeche = 0
    for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 2) if (innen(x, y)) flaeche += 4
    let gr = Math.sqrt(flaeche / (anzahl * 0.866))
    for (let it = 0; it < 40; it++) { pts = raster(gr); if (pts.length <= anzahl) break; gr *= 1.015 }
  }
  if (!pts.length) pts.push([0, 0, 0])

  // Halbiert zurück auf den Maßstab 1; nach Winkel um die Mitte sortiert, damit
  // jeder Punkt der Kugel einen nahen Platz in der Form findet
  const M = Math.min(pts.length, anzahl), sel: number[][] = []
  let mx = 0, my = 0
  for (let i = 0; i < M; i++) {
    const p = pts[Math.floor((i * pts.length) / M) % pts.length]
    const q = [p[0] / 2, p[1] / 2, 0.5 + 0.5 * Math.min(1, p[2] / 14)]
    sel.push(q); mx += q[0]; my += q[1]
  }
  mx /= M; my /= M
  sel.sort((a, b) => Math.atan2(a[1] - my, a[0] - mx) - Math.atan2(b[1] - my, b[0] - mx))
  const out = new Float32Array(anzahl * 3)
  for (let i = 0; i < anzahl; i++) {
    const sp = sel[Math.floor((i * M) / anzahl)]
    out[i * 3] = sp[0]; out[i * 3 + 1] = sp[1]; out[i * 3 + 2] = i < M ? sp[2] : -1
  }
  if (M < anzahl) for (let i = 0; i < M; i++) { out[i * 3] = sel[i][0]; out[i * 3 + 1] = sel[i][1]; out[i * 3 + 2] = sel[i][2] }
  return out
}

// Schrift: Space Grotesk 700, zentriert, höchstens 300 breit (sonst kleiner)
const SCHRIFT = '"Space Grotesk", system-ui, sans-serif'
function zeilen(text: string[], groesse: number): Zeichnung {
  return c => {
    c.textAlign = 'center'; c.textBaseline = 'middle'
    let fs = groesse
    for (const z of text) { c.font = `700 ${fs}px ${SCHRIFT}`; const w = c.measureText(z).width; if (w > 300) fs = Math.floor((fs * 300) / w) }
    c.font = `700 ${fs}px ${SCHRIFT}`
    const lh = fs * 1.1, y0 = (-lh * (text.length - 1)) / 2
    text.forEach((z, i) => c.fillText(z, 0, y0 + i * lh))
  }
}

const texte = new Map<string, Float32Array>()
/** Text (Zeilen durch Zeilenumbruch getrennt) als Punkte, Abstand `dichte` im 640er-Raster; nicht genutzte Punkte < 0. */
export function textForm(text: string, anzahl: number, dichte: number): Float32Array {
  const key = `${anzahl}|${dichte}|${text}`
  let f = texte.get(key)
  if (!f) { f = abtasten(zeilen(text.split('\n'), 64), anzahl, dichte); texte.set(key, f) }
  return f
}

/** Die Schrift laden, bevor Text abgetastet wird (sonst misst die Canvas die Ersatzschrift). */
export function ladeSchrift(ms = 1500): Promise<void> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined
  if (!fonts?.load) return Promise.resolve()
  return Promise.race([
    fonts.load(`700 64px ${SCHRIFT}`).then(() => undefined, () => undefined),
    new Promise<void>(r => window.setTimeout(r, ms)),
  ])
}

let cache: { anzahl: number; formen: Formen } | null = null

/** Einmal abtasten, danach aus dem Speicher. */
export function formen(anzahl: number): Formen {
  if (cache && cache.anzahl === anzahl) return cache.formen
  const heart = abtasten(herz, anzahl)
  let herzMax = 1
  for (let i = 0; i < anzahl; i++) herzMax = Math.max(herzMax, Math.hypot(heart[i * 3], heart[i * 3 + 1] - 8))
  const f: Formen = { hand: abtasten(hand, anzahl), heart, cross: abtasten(kreuz, anzahl), wifi: abtasten(keinNetz, anzahl), herzMax }
  cache = { anzahl, formen: f }
  return f
}

/** Herzschlag „lub-dub": 0 in Ruhe, Spitzen beim Schlag. */
export function herzPhase(te: number, bpm: number) {
  return te < 0.45 ? -1 : ((te - 0.45) / (60 / bpm)) % 1
}
export function herzSchlag(te: number, bpm: number) {
  const ph = herzPhase(te, bpm)
  if (ph < 0) return 0
  return Math.exp(-Math.pow((ph - 0.096) / 0.084, 2)) + 0.55 * Math.exp(-Math.pow((ph - 0.36) / 0.096, 2))
}
