/**
 * Echte Brechung am Rand einer Glaskapsel, als SVG-Filter auf eigenem Inhalt.
 *
 * Nach Glisse (https://github.com/0kzh/glisse, MIT, Kelvin Zhang): Im iPhone-
 * WebView kann kein Glas den Hintergrund brechen (`backdrop-filter` mit SVG
 * kann nur Chromium). Glisse bricht deshalb seine eigene Kopie der Inhalte —
 * mit einer Verschiebungskarte: in einem Band an der Kante zeigt jeder Punkt
 * Inhalt von weiter innen, nach außen hin stärker; die Mitte bleibt, wie sie
 * ist. Die drei Farbkanäle werden verschieden weit verschoben, das gibt den
 * Farbsaum. Unsere Glaslinse hat dieselbe Kopie, also passt die Technik.
 *
 * WebKit rechnet Filter auf HTML nur in Anteilen der Box zuverlässig
 * (objectBoundingBox); dann muss waagrecht und senkrecht getrennt verschoben
 * werden, weil eine Verschiebung dort an der Breite bzw. Höhe hängt.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const erf = (x: number) => Math.tanh(1.7724538509 * x)

/** Abstand zum Rand eines abgerundeten Rechtecks um den Ursprung (negativ: innen). */
function abstand(x: number, y: number, hw: number, hh: number, r: number) {
  const qx = Math.abs(x) - hw + r
  const qy = Math.abs(y) - hh + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

export interface BrechungsPixel {
  spalten: number
  zeilen: number
  /** waagrechte Verschiebung im Rotkanal (128 = keine) */
  quer: Uint8ClampedArray
  /** senkrechte Verschiebung im Rotkanal */
  hoch: Uint8ClampedArray
  /** wo gebrochen wird (Alpha): außerhalb davon bleibt der Inhalt unberührt */
  bereich: Uint8ClampedArray
}

/**
 * Die Karte einer Kapsel w × h mit Radius r: in einem Band `tiefe` px an der
 * Kante zieht sie Inhalt von weiter innen heran, zur Mitte hin weich auslaufend.
 */
export function brechungsPixel(w: number, h: number, r: number, tiefe: number, dichte = 1): BrechungsPixel {
  const hw = w / 2, hh = h / 2
  const radius = clamp(r, 0, Math.min(hw, hh))
  const spalten = Math.max(1, Math.round(w * dichte))
  const zeilen = Math.max(1, Math.round(h * dichte))
  const quer = new Uint8ClampedArray(spalten * zeilen * 4)
  const hoch = new Uint8ClampedArray(spalten * zeilen * 4)
  const bereich = new Uint8ClampedArray(spalten * zeilen * 4)
  const innenW = Math.max(0, hw - tiefe), innenH = Math.max(0, hh - tiefe)
  const innenR = clamp(radius, 0, Math.min(innenW, innenH))
  const rampe = tiefe > 0 ? 1 / (tiefe * Math.SQRT2) : 1e6
  const grau = (d: Uint8ClampedArray, i: number, v: number, a = 255) => {
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = a
  }
  for (let z = 0; z < zeilen; z++) {
    for (let s = 0; s < spalten; s++) {
      const i = (z * spalten + s) * 4
      const x = ((s + 0.5) / spalten) * w - hw
      const y = ((z + 0.5) / zeilen) * h - hh
      const rand = abstand(x, y, hw, hh, radius)
      if (rand >= 0) {
        grau(quer, i, 128); grau(hoch, i, 128); grau(bereich, i, 128, 0)
        continue
      }
      const dx = clamp(x / hw, -1, 1)
      const dy = clamp(y / hh, -1, 1)
      const auslauf = 0.5 * (1 + erf(abstand(x, y, innenW, innenH, innenR) * rampe))
      grau(quer, i, Math.round((0.5 - 0.5 * dx * auslauf) * 255))
      grau(hoch, i, Math.round((0.5 - 0.5 * dy * auslauf) * 255))
      grau(bereich, i, 255, Math.round(255 * Math.min(1, auslauf * 20, -rand)))
    }
  }
  return { spalten, zeilen, quer, hoch, bereich }
}

const karten = new Map<string, { quer: string; hoch: string; bereich: string } | null>()

function alsBilder(key: string, p: () => BrechungsPixel) {
  if (karten.has(key)) return karten.get(key)!
  const k = p()
  const canvas = document.createElement('canvas')
  canvas.width = k.spalten
  canvas.height = k.zeilen
  const ctx = canvas.getContext('2d')
  if (!ctx) { karten.set(key, null); return null }
  const bild = ctx.createImageData(k.spalten, k.zeilen)
  const png = (d: Uint8ClampedArray) => { bild.data.set(d); ctx.putImageData(bild, 0, 0); return canvas.toDataURL() }
  const fertig = { quer: png(k.quer), hoch: png(k.hoch), bereich: png(k.bereich) }
  karten.set(key, fertig)
  return fertig
}

const NS = 'http://www.w3.org/2000/svg'
const el = (name: string, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(NS, name)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  return e
}

/** WebKit (Safari, iPhone-WebView) braucht Filter in Anteilen der Box. */
const inBox = () => /AppleWebKit\//.test(navigator.userAgent) && !/Chrom(?:e|ium)\//.test(navigator.userAgent)

let ablage: SVGDefsElement | null = null
function defs() {
  if (ablage?.isConnected) return ablage
  const root = el('svg', { width: 0, height: 0, 'aria-hidden': 'true' })
  ;(root as SVGSVGElement).style.cssText = 'position:absolute;pointer-events:none'
  ablage = el('defs', {}) as SVGDefsElement
  root.append(ablage)
  document.body.append(root)
  return ablage
}

const KANAELE = [
  '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0',
  '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0',
  '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0',
]

let gebaut = 0

/**
 * Baut den Filter für eine Kapsel w × h und gibt `url(#…)` für CSS zurück;
 * `null`, wo es kein Canvas gibt. `weite` ist, wie weit die Kante Inhalt
 * heranzieht (px), `farbe` wie weit die Farbkanäle auseinanderlaufen.
 * Jeder Aufruf mit neuen Werten baut einen neuen Filter (WebKit merkt sich
 * sonst das alte Ergebnis); der vorige wird entfernt.
 */
export function brechungsFilter(
  w: number, h: number, o: { tiefe: number; weite: number; farbe: number; alt?: string | null },
): string | null {
  if (!w || !h) return null
  const dichte = Math.min(window.devicePixelRatio || 1, 2)
  const bilder = alsBilder(`${Math.round(w)}|${Math.round(h)}|${o.tiefe}|${dichte}`,
    () => brechungsPixel(w, h, h / 2, o.tiefe, dichte))
  if (!bilder) return null
  const box = inBox()
  const einheit = box ? 'objectBoundingBox' : 'userSpaceOnUse'
  const flaeche = box ? { x: 0, y: 0, width: 1, height: 1 } : { x: 0, y: 0, width: w, height: h }
  const id = `tyd-brechung-${++gebaut}`
  const f = el('filter', { id, filterUnits: einheit, primitiveUnits: einheit, 'color-interpolation-filters': 'sRGB', ...flaeche })
  const bild = (href: string, result: string) => el('feImage', { href, preserveAspectRatio: 'none', result, ...flaeche })
  f.append(
    bild(bilder.quer, 'quer'), bild(bilder.hoch, 'hoch'), bild(bilder.bereich, 'bereich'),
    el('feFlood', { 'flood-color': 'rgb(128, 128, 128)', result: 'neutral', ...flaeche }),
  )
  // Je Richtung: der andere Kanal (Alpha) steht auf 0,5 = keine Verschiebung
  for (const r of ['quer', 'hoch']) {
    f.append(el('feComposite', { in: r, in2: 'neutral', operator: 'over', result: `${r}-grau` }))
    const halb = el('feComponentTransfer', { in: `${r}-grau`, result: `${r}-zug` })
    halb.append(el('feFuncA', { type: 'linear', slope: 0, intercept: 0.5 }))
    f.append(halb)
  }
  const spektrum = [1 + 0.2 * o.farbe, 1 + 0.1 * o.farbe, 1]
  KANAELE.forEach((kanal, i) => {
    const sx = (box ? o.weite / w : o.weite) * spektrum[i]
    const sy = (box ? o.weite / h : o.weite) * spektrum[i]
    f.append(
      el('feDisplacementMap', { in: 'SourceGraphic', in2: 'quer-zug', scale: sx, xChannelSelector: 'R', yChannelSelector: 'A', result: `strahl-q-${i}` }),
      el('feDisplacementMap', { in: `strahl-q-${i}`, in2: 'hoch-zug', scale: sy, xChannelSelector: 'A', yChannelSelector: 'R', result: `strahl-${i}` }),
      el('feColorMatrix', { in: `strahl-${i}`, type: 'matrix', values: `${kanal}  0 0 0 0.3333 0`, result: `licht-${i}` }),
    )
  })
  f.append(
    el('feComposite', { in: 'licht-0', in2: 'licht-1', operator: 'arithmetic', k2: 1, k3: 1, result: 'licht-01' }),
    el('feComposite', { in: 'licht-01', in2: 'licht-2', operator: 'arithmetic', k2: 1, k3: 1, result: 'gestreut' }),
    el('feColorMatrix', { in: 'gestreut', type: 'matrix', values: '3 0 0 0 0  0 3 0 0 0  0 0 3 0 0  0 0 0 1 0', result: 'gebrochen' }),
    // Nur in der Kante gebrochen, die Mitte bleibt genau das Original
    el('feComposite', { in: 'gebrochen', in2: 'bereich', operator: 'in', result: 'innen' }),
    el('feComposite', { in: 'SourceGraphic', in2: 'bereich', operator: 'out', result: 'aussen' }),
    el('feComposite', { in: 'innen', in2: 'aussen', operator: 'arithmetic', k2: 1, k3: 1 }),
  )
  if (o.alt) document.getElementById(o.alt)?.remove()
  defs().append(f)
  return id
}

export function entferneBrechung(id: string | null) {
  if (id) document.getElementById(id)?.remove()
}
