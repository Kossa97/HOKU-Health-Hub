/**
 * Zeichnen der Kalorien-Kugel: viele weiche Punkte, so billig wie möglich.
 *
 * WebGL: alle Punkte eines Bildes in einem einzigen Auftrag (`gl.POINTS`).
 * Lage, Größe und Farbe rechnet JS — teuer war beim Canvas 2D das einzelne
 * Malen, nicht die Mathematik. Ohne WebGL zeichnet Canvas 2D dieselben Punkte
 * als Sprite. Ein Punkt ist ein weicher Kreis: voll bis 55 % des Radius,
 * dann linear auslaufend.
 */
import { spherePoints, type Fill } from './orb'

export type Mat3 = number[]
export type Quat = [number, number, number, number]

// ─── Lage: Quaternionen, damit Drehen sauber bleibt ─────────────────────

export function qMul(a: Quat, b: Quat): Quat {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ]
}

export function qAxis(x: number, y: number, z: number, angle: number): Quat {
  const s = Math.sin(angle / 2)
  return [Math.cos(angle / 2), x * s, y * s, z * s]
}

export function qNorm(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}

/** Drehmatrix: bildet Kugelpunkte in die Ansicht ab (x rechts, y oben, z zum Betrachter). */
export function qMat(q: Quat): Mat3 {
  const [w, x, y, z] = q
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ]
}

// ─── Farben ─────────────────────────────────────────────────────────────

/** Farbindex: 0 offen (grau), 1 Akzent (Kalorien), 2 Eiweiß, 3 Kohlenhydrate, 4 Fett. */
export type ColorIndex = 0 | 1 | 2 | 3 | 4

/** Jede CSS-Farbe (auch `var(--accent)` oder oklch) als RGB 0–1 — über ein 1×1-Canvas. */
export function resolveColor(css: string, probe?: Element | null): [number, number, number] {
  try {
    let color = css
    if (css.startsWith('var(') && probe) {
      const el = document.createElement('span')
      el.style.color = css
      el.style.display = 'none'
      probe.appendChild(el)
      color = getComputedStyle(el).color
      el.remove()
    }
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return [1, 1, 1]
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0] / 255, d[1] / 255, d[2] / 255]
  } catch {
    return [1, 1, 1]
  }
}

const MACRO_RGB = { protein: '#30d158', carbs: '#bf5af2', fat: '#ff9f0a' }
let paletteCache: { accent: string; rgb: [number, number, number][] } | null = null

/**
 * Farben je Index (siehe ColorIndex). Die Akzentfarbe kommt aus `--accent`
 * am Element `probe`; zwischengespeichert, bis sie sich ändert.
 */
export function orbPalette(probe: Element): [number, number, number][] {
  const accent = getComputedStyle(probe).getPropertyValue('--accent').trim()
  if (paletteCache && paletteCache.accent === accent) return paletteCache.rgb
  const rgb = [
    resolveColor('#aab0bd'), resolveColor('var(--accent)', probe),
    resolveColor(MACRO_RGB.protein), resolveColor(MACRO_RGB.carbs), resolveColor(MACRO_RGB.fat),
  ]
  paletteCache = { accent, rgb }
  return rgb
}

/** Weicher Punkt als kleines Bild für Canvas 2D (gleicher Verlauf wie im Shader). */
export function sprite(rgb: [number, number, number]): HTMLCanvasElement {
  const s = document.createElement('canvas')
  s.width = 32
  s.height = 32
  const g = s.getContext('2d')
  if (g) {
    const color = `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, color)
    grad.addColorStop(0.55, color)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(16, 16, 16, 0, Math.PI * 2)
    g.fill()
  }
  return s
}

// ─── Zeichner ───────────────────────────────────────────────────────────

const VS = 'attribute vec2 aPos; attribute float aSize; attribute vec4 aCol; uniform vec2 uRes; varying vec4 vCol;'
  + 'void main(){ vec2 p = aPos / uRes * 2.0 - 1.0; gl_Position = vec4(p.x, -p.y, 0.0, 1.0); gl_PointSize = aSize; vCol = aCol; }'
const FS = 'precision mediump float; varying vec4 vCol;'
  + 'void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;'
  + ' float a = (d < 0.55 ? 1.0 : 1.0 - (d - 0.55) / 0.45) * vCol.a; gl_FragColor = vec4(vCol.rgb * a, a); }'

const CAP = 20000
const STRIDE = 7

/**
 * Sammelt Punkte eines Bildes und malt sie: WebGL in einem Auftrag, sonst
 * Canvas 2D. `mode` ist null, wenn der Browser gar nichts kann (z. B. in Tests).
 */
export class DotRenderer {
  mode: 'webgl' | '2d' | null = null
  private gl: WebGLRenderingContext | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private res: WebGLUniformLocation | null = null
  private data = new Float32Array(0)
  private n = 0
  private palette: [number, number, number][] = []
  private sprites: HTMLCanvasElement[] = []
  /** Kontext verloren (Grafikkarte zurückgesetzt): bis zur Wiederherstellung nichts zeichnen. */
  lost = false
  private readonly canvas: HTMLCanvasElement
  private readonly onLost = (e: Event) => { e.preventDefault(); this.lost = true }
  private readonly onRestored = () => { this.lost = false; this.initGL() }

  constructor(canvas: HTMLCanvasElement, opts: { webgl?: boolean } = {}) {
    this.canvas = canvas
    if (opts.webgl !== false && this.initGL()) {
      canvas.addEventListener('webglcontextlost', this.onLost)
      canvas.addEventListener('webglcontextrestored', this.onRestored)
      return
    }
    try { this.ctx = canvas.getContext('2d') } catch { this.ctx = null }
    if (this.ctx) this.mode = '2d'
  }

  private initGL(): boolean {
    let gl: WebGLRenderingContext | null = null
    try {
      gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' })
    } catch { gl = null }
    if (!gl) return false
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)
      if (!s) return null
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
    }
    const v = shader(gl.VERTEX_SHADER, VS)
    const f = shader(gl.FRAGMENT_SHADER, FS)
    const prog = v && f ? gl.createProgram() : null
    if (!prog || !v || !f) return false
    gl.attachShader(prog, v)
    gl.attachShader(prog, f)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false
    gl.useProgram(prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, CAP * STRIDE * 4, gl.DYNAMIC_DRAW)
    const attr = (name: string, size: number, offset: number) => {
      const loc = gl.getAttribLocation(prog, name)
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, offset)
    }
    attr('aPos', 2, 0)
    attr('aSize', 1, 8)
    attr('aCol', 4, 12)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)
    this.res = gl.getUniformLocation(prog, 'uRes')
    this.data = new Float32Array(CAP * STRIDE)
    this.gl = gl
    this.mode = 'webgl'
    return true
  }

  /** Farben je Index (siehe ColorIndex). */
  setPalette(rgb: [number, number, number][]) {
    this.palette = rgb
    if (this.mode === '2d') this.sprites = rgb.map(sprite)
  }

  begin() {
    this.n = 0
    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0)
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  /** Ein Punkt: Mitte (Canvas-Pixel), Durchmesser, Deckkraft. */
  dot(ci: ColorIndex, x: number, y: number, size: number, alpha: number) {
    if (this.gl) {
      if (this.n >= CAP) return
      const o = this.n * STRIDE
      const c = this.palette[ci] ?? [1, 1, 1]
      const d = this.data
      d[o] = x; d[o + 1] = y; d[o + 2] = size
      d[o + 3] = c[0]; d[o + 4] = c[1]; d[o + 5] = c[2]; d[o + 6] = Math.min(1, alpha)
      this.n++
      return
    }
    const ctx = this.ctx
    const s = this.sprites[ci]
    if (!ctx || !s) return
    ctx.globalAlpha = Math.min(1, alpha)
    ctx.drawImage(s, x - size / 2, y - size / 2, size, size)
  }

  end() {
    const gl = this.gl
    if (gl && !this.lost) {
      const W = this.canvas.width
      const H = this.canvas.height
      gl.viewport(0, 0, W, H)
      gl.uniform2f(this.res, W, H)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * STRIDE))
      gl.drawArrays(gl.POINTS, 0, this.n)
    }
    if (this.ctx) this.ctx.globalAlpha = 1
  }

  destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    // Den Kontext nicht verwerfen: ein erneutes Einhängen (StrictMode) bekommt denselben zurück.
    this.gl = null
    this.ctx = null
  }
}

/** Aufleuchten neu gefüllter Plätze: gestaffelt über `spread` ms; mit `hide` bis dahin grau (der Punkt ist noch unterwegs). */
export interface Flash {
  from: number
  to: number
  t0: number
  spread: number
  hide?: boolean
}

export interface SphereOpts {
  M: Mat3
  /** Lage der Hülle (dreht gegenläufig). */
  HM: Mat3
  cx: number
  cy: number
  R: number
  /** Punktdurchmesser vorne, Canvas-Pixel. */
  px: number
  color: ColorIndex
  now: number
  live: boolean
  alpha?: number
  dim?: boolean
  flash?: Flash | null
}

/**
 * Eine Punkt-Kugel: hintere Hälfte zuerst, dann die vordere; gefüllte Plätze
 * von unten in `color`, offene grau. Dahinter bzw. davor die Hülle über dem Ziel.
 */
export function drawSphere(r: DotRenderer, n: number, f: Fill, o: SphereOpts) {
  const pts = spherePoints(n)
  const M = o.M
  const am = o.alpha ?? 1
  const fl = o.flash
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const x = pts[i * 4], y = pts[i * 4 + 1], z = pts[i * 4 + 2], s = pts[i * 4 + 3]
      const vz = M[6] * x + M[7] * y + M[8] * z
      if ((pass === 0) !== (vz < 0)) continue
      const vx = M[0] * x + M[1] * y + M[2] * z
      const vy = M[3] * x + M[4] * y + M[5] * z
      const rr = 1 + (o.live ? 0.024 * Math.sin(o.now * 0.0012 + s * 6.283) : 0)
      const d = (vz + 1) / 2
      const rank = n - 1 - i
      let ci: ColorIndex = rank < f.filled ? o.color : 0
      let size = o.px * (0.5 + 0.75 * d)
      let alpha = (ci ? 0.32 + 0.68 * d : 0.07 + 0.26 * d) * am
      if (o.dim) alpha *= 0.5
      if (fl && rank >= fl.from && rank < fl.to) {
        const delay = ((rank - fl.from) / Math.max(1, fl.to - fl.from)) * fl.spread
        const age = o.now - fl.t0 - delay
        if (age < 0 && fl.hide) {
          ci = 0
          alpha = (0.07 + 0.26 * d) * am
        } else if (age >= 0 && age < 750) {
          const b = (1 - age / 750) ** 2
          size *= 1 + 1.1 * b
          alpha = Math.min(1, alpha + 0.6 * b)
        }
      }
      r.dot(ci, o.cx + vx * o.R * rr, o.cy - vy * o.R * rr, size, alpha)
    }
  }
  const m = f.extra
  if (m <= 0) return
  // Über dem Ziel: lockere Hülle außen, jeder Punkt mit eigenem Platz.
  const HN = m > 1500 ? 4000 : 1500
  const hp = spherePoints(HN)
  const H = o.HM
  for (let j = 0; j < m; j++) {
    const k = Math.floor((j * HN) / m)
    const hx = hp[k * 4], hy = hp[k * 4 + 1], hz = hp[k * 4 + 2], hs = hp[k * 4 + 3]
    const rad = 1.12 + 0.16 * hs + (o.live ? 0.03 * Math.sin(o.now * 0.0009 + hs * 9) : 0)
    const hvx = H[0] * hx + H[1] * hy + H[2] * hz
    const hvy = H[3] * hx + H[4] * hy + H[5] * hz
    const hd = (H[6] * hx + H[7] * hy + H[8] * hz + 1) / 2
    r.dot(o.color, o.cx + hvx * o.R * rad, o.cy - hvy * o.R * rad, o.px * (0.45 + 0.6 * hd), (0.2 + 0.5 * hd) * am * (o.dim ? 0.5 : 1))
  }
}

/** Kurven aus easing.dev: starkes ease-in-out für Bewegung über den Bildschirm. */
export function easeInOut(t: number): number {
  return cubicBezier(t, 0.77, 0, 0.175, 1)
}

function cubicBezier(t: number, x1: number, y1: number, x2: number, y2: number): number {
  let u = t
  for (let i = 0; i < 6; i++) {
    const x = 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3 - t
    const dx = 3 * x1 * (1 - u) * (1 - 3 * u) + 3 * x2 * u * (2 - 3 * u) + 3 * u * u
    if (Math.abs(dx) < 1e-5) break
    u = Math.min(1, Math.max(0, u - x / dx))
  }
  return 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3
}
