/**
 * Schrift aus Dots Punkten, dazu sein Herzschlag.
 *
 * Text wird einmal auf einer Offscreen-Canvas (640 px, Maßstab 2)
 * gezeichnet und mit einem Sechseck-Gitter abgetastet. Die übrigen Gesten
 * (Winken, Herz, Fehler, Kein Netz, Haken) stehen in `gesten.ts`.
 *
 * Koordinaten sind in Mockup-Pixeln bei Radius 66; die Engine teilt durch
 * `FORM_R` und skaliert mit ihrem eigenen Radius.
 */

/** Radius, für den die Schrift gezeichnet ist. */
export const FORM_R = 66

type Zeichnung = (c: CanvasRenderingContext2D) => void

/**
 * Silhouette gleichmäßig mit höchstens `anzahl` Punkten füllen. Mit `gitter`
 * steht der Abstand fest; ohne wird er so gewählt, dass höchstens `anzahl`
 * Punkte hineinpassen.
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

/** Herzschlag „lub-dub": 0 in Ruhe, Spitzen beim Schlag. */
export function herzSchlag(te: number, bpm: number) {
  const ph = te < 0.45 ? -1 : ((te - 0.45) / (60 / bpm)) % 1
  if (ph < 0) return 0
  return Math.exp(-Math.pow((ph - 0.096) / 0.084, 2)) + 0.55 * Math.exp(-Math.pow((ph - 0.36) / 0.096, 2))
}
