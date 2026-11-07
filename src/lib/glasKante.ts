/**
 * Glaskante wie bei Apples Liquid Glass, als Bild gerechnet.
 *
 * Idee aus Glisse (https://github.com/0kzh/glisse, MIT, Kelvin Zhang): Die
 * Kante ist kein Verlauf, sondern eine schmale, gewölbte Fase. Wo ihre
 * Oberfläche zum Licht zeigt (oben links), glänzt sie hell, gegenüber fängt
 * sie einen schwächeren Widerschein; an den geraden Seiten bleibt sie leise.
 * Gerechnet wird mit dem Abstandsfeld eines abgerundeten Rechtecks: daraus
 * kommt für jeden Punkt der Fase die Richtung ihrer Oberfläche.
 *
 * Das Bild wird je Größe einmal gerechnet und zwischengespeichert. Es läuft
 * überall, auch im iPhone-WebView: kein SVG-Filter, kein WebGL.
 */

export interface KantenOptionen {
  /** Breite der Fase in CSS-Pixeln */
  fase?: number
  /** Gerätepixel je CSS-Pixel */
  dpr?: number
  /** Richtung, aus der das Licht kommt (zeigt zur Lampe), wird normalisiert */
  licht?: readonly [number, number]
  /** Helligkeit des Glanzes, 0–1 */
  glanz?: number
  /** Grundhelligkeit der ganzen Kante, 0–1 */
  grund?: number
}

/** Abstand zum Rand eines abgerundeten Rechtecks (negativ: innen) und die Richtung nach außen. */
export function kantenFeld(x: number, y: number, w: number, h: number, r: number): { d: number; nx: number; ny: number } {
  const cx = w / 2, cy = h / 2
  const px = x - cx, py = y - cy
  const qx = Math.abs(px) - (cx - r)
  const qy = Math.abs(py) - (cy - r)
  const sx = px < 0 ? -1 : 1, sy = py < 0 ? -1 : 1
  if (qx > 0 && qy > 0) {
    const len = Math.hypot(qx, qy)
    return { d: len - r, nx: (qx / len) * sx, ny: (qy / len) * sy }
  }
  if (qx > qy) return { d: qx - r, nx: sx, ny: 0 }
  return { d: qy - r, nx: 0, ny: sy }
}

/** RGBA-Pixel der Kante (weiß, Deckkraft trägt den Glanz). */
export function kantenPixel(w: number, h: number, radius: number, o: KantenOptionen = {}): { breite: number; hoehe: number; daten: Uint8ClampedArray } {
  const dpr = o.dpr ?? 2
  const fase = o.fase ?? 2.5
  const glanz = o.glanz ?? 0.9
  const grund = o.grund ?? 0.1
  const [lx0, ly0] = o.licht ?? [-0.55, -0.85]
  const ll = Math.hypot(lx0, ly0) || 1
  const lx = lx0 / ll, ly = ly0 / ll
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr))
  const r = Math.min(radius, w / 2, h / 2)
  const daten = new Uint8ClampedArray(W * H * 4)
  for (let j = 0; j < H; j++) {
    const y = (j + 0.5) / dpr
    for (let i = 0; i < W; i++) {
      const x = (i + 0.5) / dpr
      const { d, nx, ny } = kantenFeld(x, y, w, h, r)
      if (d > 0.5 / dpr || d < -fase) continue
      // t: 1 am äußeren Rand, 0 am inneren Ende der Fase
      const t = 1 + d / fase
      const zumLicht = Math.max(0, nx * lx + ny * ly)
      const weg = Math.max(0, -(nx * lx + ny * ly))
      const schein = grund + glanz * zumLicht ** 3 + glanz * 0.45 * weg ** 4
      // Gewölbt: außen hell, nach innen weich auslaufend; außen kantengeglättet
      const profil = t ** 1.6 * Math.min(1, Math.max(0, 0.5 - d * dpr))
      const a = Math.min(1, schein * profil)
      if (a <= 0) continue
      const k = (j * W + i) * 4
      daten[k] = 255; daten[k + 1] = 255; daten[k + 2] = 255
      daten[k + 3] = Math.round(a * 255)
    }
  }
  return { breite: W, hoehe: H, daten }
}

const ablage = new Map<string, string>()

/** Die Kante als Bild-URL für CSS; `null`, wo es kein Canvas gibt. */
export function kantenBild(w: number, h: number, radius: number, o: KantenOptionen = {}): string | null {
  const dpr = o.dpr ?? Math.min(3, window.devicePixelRatio || 2)
  const key = `${Math.round(w)}|${Math.round(h)}|${Math.round(radius)}|${dpr}|${o.fase ?? ''}|${o.glanz ?? ''}`
  const fertig = ablage.get(key)
  if (fertig) return fertig
  const { breite, hoehe, daten } = kantenPixel(w, h, radius, { ...o, dpr })
  const canvas = document.createElement('canvas')
  canvas.width = breite
  canvas.height = hoehe
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const bild = ctx.createImageData(breite, hoehe)
  bild.data.set(daten)
  ctx.putImageData(bild, 0, 0)
  const url = `url("${canvas.toDataURL()}")`
  ablage.set(key, url)
  return url
}

/**
 * Legt die gerechnete Kante an ein Element (`--glas-kante`, `data-glas-kante`)
 * und hält sie bei Größenänderungen aktuell. Gibt eine Aufräumfunktion zurück.
 */
export function haengeGlasKante(el: HTMLElement, o: KantenOptionen = {}): () => void {
  const setzen = () => {
    const w = el.offsetWidth, h = el.offsetHeight
    if (!w || !h) return
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
    const url = kantenBild(w, h, radius, o)
    if (!url) return
    el.style.setProperty('--glas-kante', url)
    el.setAttribute('data-glas-kante', '')
  }
  setzen()
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(setzen)
  ro?.observe(el)
  return () => {
    ro?.disconnect()
    el.style.removeProperty('--glas-kante')
    el.removeAttribute('data-glas-kante')
  }
}
