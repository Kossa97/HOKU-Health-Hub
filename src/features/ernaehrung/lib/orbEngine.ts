/**
 * Die lebende Kalorien-Kugel: Drehen, Monde, Antippen und die fliegenden
 * Punkte beim Eintragen und Entfernen. Ohne React — die Komponente reicht
 * Canvas, Daten und Gesten herein (components/DaySummary.tsx).
 *
 * Bewegung (memory/projects/kalorientracker.md):
 * - langsame Eigendrehung, seitlich wischen dreht mit Schwung, senkrecht scrollt die Seite;
 * - ein angetippter Mond hält an, kommt nach vorn und wächst um 38 % (~0,3 s, unterbrechbar);
 * - Eintragen: Punkte fliegen im Bogen in genau die neuen Plätze, ~0,56 s je Punkt,
 *   0,42 s gestaffelt, ease-in-out; die Plätze bleiben grau, bis ihr Punkt ankommt;
 * - Entfernen: Punkte wandern zum untersten Punkt ihrer Kugel und fallen dort heraus;
 * - „Bewegung reduzieren": nichts dreht, nichts fliegt, neue Plätze leuchten nur auf.
 */
import { RELEASE_FLY_MS } from './orbBridge'
import { type Fill, type MacroKey, type OrbLayout, ORB_TILT as TILT, dotScale, fillChange, spherePoints } from './orb'
import {
  type ColorIndex, DotRenderer, type Flash, type Mat3, type Quat,
  drawSphere, easeInOut, qAxis, qMat, qMul, qNorm, sprite,
} from './orbDraw'
import { hapticGoal, hapticSelect, hapticTick, soundArrive, soundFall, soundGoal } from './orbFeedback'

/** Bezugsgröße der großen Kugel in CSS-Pixeln (die tatsächliche setzt `setStage`, siehe `fitOrb`). */
export const ORB_RADIUS = 86
/** Punktdurchmesser (CSS-Pixel) und Flug — auch für die Gericht-Kugel (components/DishStage.tsx). */
export const DOT_MAIN = 1.86
const DOT_MOON = 1.67
export const DOT_TRAIL = 1.4
export const TRAVEL = 560
export const SPREAD = 420

const MOON_COLOR: Record<MacroKey, ColorIndex> = { protein: 2, carbs: 3, fat: 4 }
/** Höchstens so viele Ticks (Haptik/Ton) je Eintrag bzw. beim Entfernen. */
const TICKS_IN = 10
const TICKS_OUT = 4

type Kind = 'core' | 'halo' | 'moonCore' | 'moonHalo'

interface Particle {
  kind: Kind
  moon?: MacroKey
  rank?: number
  f: number
  ci: ColorIndex
  sx: number
  sy: number
  delay: number
  dur: number
  t0: number
  ox: number
  oy: number
  lift: number
  side: number
  out: boolean
  dx: number
  fall: number
  /** Beim Verschieben auf einen anderen Tag: statt herauszufallen dorthin fliegen (Bildschirm-px). */
  to?: { x: number; y: number }
  /** Haptik/Ton, wenn der Punkt ankommt (bzw. unten herausfällt): Füllstand 0–1 für die Tonhöhe. */
  tick?: { level: number; last: boolean; goal: boolean }
  ticked?: boolean
}

/** Wo ein Mond gerade steht (Canvas-Pixel) — für Antippen, Etikett und Flüge. */
interface MoonGeo {
  M: Mat3
  n: number
  cx: number
  cy: number
  R: number
  front: boolean
}

export interface OrbFocus {
  key: MacroKey
  /** Mitte über dem Mond, CSS-Pixel relativ zur Zeichenfläche. */
  x: number
  y: number
}

export class OrbEngine {
  private readonly canvas: HTMLCanvasElement
  private readonly renderer: DotRenderer
  private fx: HTMLCanvasElement | null = null
  private fxCtx: CanvasRenderingContext2D | null = null
  private fxSprites: HTMLCanvasElement[] = []
  private fxDirty = false
  private palette: [number, number, number][] | null = null
  /** Bewegung reduziert: nur neu zeichnen, wenn sich etwas geändert hat. */
  private needsDraw = true
  private label: HTMLElement | null = null
  private layout: OrbLayout | null = null
  private reduce: boolean
  private readonly onFocus: (f: OrbFocus | null) => void

  private dpr = 2
  private cssW = 0
  private centerY = 0
  private visible = true
  private raf = 0
  private last = 0

  private q: Quat = qMul(qAxis(1, 0, 0, TILT), qAxis(0, 1, 0, 0.6))
  private wy = 0
  private spinF = 1
  private haloA = 0
  private drag: { id: number; x0: number; y0: number; x: number; t0: number; t: number } | null = null

  private phase: Record<MacroKey, number> = { protein: 0.4, carbs: 2.5, fat: 4.4 }
  private focusA: Record<MacroKey, number> = { protein: 0, carbs: 0, fat: 0 }
  private focusKey: MacroKey | null = null
  private focusUntil = 0
  private flash: Flash | null = null
  private moonFlash: Partial<Record<MacroKey, Flash>> = {}
  private geo: { M: Mat3; cx: number; cy: number; R: number } | null = null
  private moonGeo: Partial<Record<MacroKey, MoonGeo>> = {}
  private particles: Particle[] = []
  /** Radius der großen Kugel in CSS-Pixeln; `setStage` passt ihn an die Zone an (beim Scrollen kleiner). */
  private readonly baseRadius: number
  private radius: number
  /** Portions-Blatt: so sähe der Tag mit dieser Portion aus — die neuen Punkte pulsieren. */
  private preview: OrbLayout | null = null
  /** Geglättete Rechenzeit je Bild (ms) und wann zuletzt gezeichnet wurde — für die Bremse in der Schleife. */
  private cost = 0
  private workedAt = 0

  constructor(canvas: HTMLCanvasElement, opts: { reduce: boolean; onFocus: (f: OrbFocus | null) => void; radius?: number }) {
    this.canvas = canvas
    this.baseRadius = opts.radius ?? ORB_RADIUS
    this.radius = this.baseRadius
    this.renderer = new DotRenderer(canvas)
    this.reduce = opts.reduce
    this.onFocus = opts.onFocus
    if (this.reduce) this.spinF = 0
  }

  get mode() { return this.renderer.mode }

  setPalette(rgb: [number, number, number][]) {
    // orbPalette liefert dieselbe Liste, solange sich die Akzentfarbe nicht ändert.
    if (rgb === this.palette) return
    this.palette = rgb
    this.renderer.setPalette(rgb)
    this.fxSprites = rgb.map(sprite)
    this.needsDraw = true
  }

  setFx(fx: HTMLCanvasElement | null) {
    this.fx = fx
    try { this.fxCtx = fx ? fx.getContext('2d') : null } catch { this.fxCtx = null }
  }

  setLayout(layout: OrbLayout) {
    // Tageswechsel o. Ä.: alte Flüge passen nicht mehr.
    if (this.layout && (this.layout.main.n !== layout.main.n || this.layout.moons.length !== layout.moons.length)) this.cancelFlights()
    this.layout = layout
    this.needsDraw = true
    if (this.focusKey && !layout.moons.some(m => m.key === this.focusKey)) this.clearFocus()
  }

  /** Vorschau zeigen (`null` = keine). Gleiche Ziele wie das aktuelle Layout vorausgesetzt. */
  setPreview(after: OrbLayout | null) {
    this.preview = after
    this.needsDraw = true
  }

  setReduce(reduce: boolean) {
    this.reduce = reduce
    this.needsDraw = true
  }

  /** Etikett des angetippten Mondes: folgt ihm in jedem Bild, ohne React neu zu zeichnen. */
  setLabel(el: HTMLElement | null) { this.label = el }

  /** Größe der Zeichenfläche in CSS-Pixeln und Mitte der Kugel (von oben). */
  resize(cssW: number, cssH: number, centerY: number) {
    this.dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
    this.cssW = cssW
    this.centerY = centerY
    const w = Math.round(cssW * this.dpr)
    const h = Math.round(cssH * this.dpr)
    if (this.canvas.width !== w) this.canvas.width = w
    if (this.canvas.height !== h) this.canvas.height = h
    this.needsDraw = true
    this.sizeFx()
  }

  private sizeFx() {
    const fx = this.fx
    if (!fx) return
    const w = Math.round(window.innerWidth * this.dpr)
    const h = Math.round(window.innerHeight * this.dpr)
    if (fx.width !== w) fx.width = w
    if (fx.height !== h) fx.height = h
  }

  /**
   * Feste Kugel oben: Mitte (CSS-Pixel von oben) und Größe ändern sich beim Scrollen.
   * Nur Werte — die Zeichenfläche bleibt, gezeichnet wird im nächsten Bild.
   */
  setStage(centerY: number, radius: number) {
    const r = radius
    if (r === this.radius && centerY === this.centerY) return
    this.radius = r
    this.centerY = centerY
    this.needsDraw = true
  }

  setVisible(v: boolean) {
    this.visible = v
    this.needsDraw = true
  }

  start() {
    if (!this.raf) this.raf = requestAnimationFrame(this.loop)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.clearFx()
    this.renderer.destroy()
  }

  cancelFlights() {
    this.particles = []
    this.flash = null
    this.moonFlash = {}
    this.clearFx()
  }

  // ─── Antippen ─────────────────────────────────────────────────────────

  focus(key: MacroKey | null) {
    if (key === null) { this.clearFocus(); return }
    this.focusKey = key
    this.focusUntil = performance.now() + 2800
    if (this.reduce) for (const k of Object.keys(this.focusA) as MacroKey[]) this.focusA[k] = k === key ? 1 : 0
    this.needsDraw = true
    hapticSelect()
    this.onFocus({ key, ...this.labelAt(key) })
  }

  /** Mitte über dem Mond in seiner vollen Größe (er wächst um 38 %), CSS-Pixel. */
  private labelAt(key: MacroKey): { x: number; y: number } {
    const g = this.moonGeo[key]
    if (!g) return { x: this.cssW / 2, y: this.centerY }
    const grow = 1.38 / (1 + 0.38 * this.focusA[key])
    return { x: g.cx / this.dpr, y: (g.cy - g.R * grow) / this.dpr }
  }

  private clearFocus() {
    if (this.focusKey === null) return
    this.focusKey = null
    if (this.reduce) this.focusA = { protein: 0, carbs: 0, fat: 0 }
    this.needsDraw = true
    this.onFocus(null)
  }

  focused() { return this.focusKey }

  // ─── Gesten: seitlich wischen dreht, senkrecht scrollt die Seite ──────

  pointerDown(e: PointerEvent) {
    // Festhalten: auch beim Loslassen außerhalb der Kugel kommt pointerup hier an.
    // Gesten können von einer eigenen Fläche über der Kugel kommen (die Zeichenfläche selbst lässt Taps durch).
    const target = e.target instanceof Element ? e.target : this.canvas
    try { target.setPointerCapture(e.pointerId) } catch { /* Zeiger schon weg */ }
    this.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t0: performance.now(), t: performance.now() }
    this.wy = 0
  }

  pointerMove(e: PointerEvent) {
    const g = this.drag
    if (!g || g.id !== e.pointerId) return
    const now = performance.now()
    const dx = e.clientX - g.x
    const dt = Math.max(0.008, (now - g.t) / 1000)
    g.x = e.clientX
    g.t = now
    if (Math.abs(dx) < 0.01 || this.reduce) return
    const ang = dx / 115
    this.q = qNorm(qMul(this.q, qAxis(0, 1, 0, ang)))
    this.wy = this.wy * 0.5 + (ang / dt) * 0.5
  }

  pointerUp(e: PointerEvent) {
    const g = this.drag
    if (!g || g.id !== e.pointerId) return
    const now = performance.now()
    this.drag = null
    if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 8 && now - g.t0 < 400) {
      this.wy = 0
      this.tap(e)
      return
    }
    // Hat der Finger vor dem Loslassen still gehalten, gibt es keinen Schwung.
    if (now - g.t > 90 || this.reduce) this.wy = 0
  }

  /** Der Browser hat die Geste fürs Scrollen übernommen: loslassen, ohne Schwung. */
  pointerCancel() {
    this.drag = null
    this.wy = 0
  }

  private tap(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * this.dpr
    const y = (e.clientY - rect.top) * this.dpr
    let best: MacroKey | null = null
    let bestD = Infinity
    for (const key of Object.keys(this.moonGeo) as MacroKey[]) {
      const g = this.moonGeo[key]
      if (!g) continue
      const d = Math.hypot(x - g.cx, y - g.cy)
      // Vordere Monde gewinnen gegen solche hinter der Kugel.
      const score = d - (g.front ? 20 * this.dpr : 0)
      if (d < g.R + 12 * this.dpr && score < bestD) { bestD = score; best = key }
    }
    // Derselbe Mond noch einmal: wieder abwählen (wie der Knopf in der Makrozeile).
    this.focus(best !== null && best === this.focusKey ? null : best)
  }

  // ─── Flüge ────────────────────────────────────────────────────────────

  /**
   * Eintragen: Punkte fliegen von `from` (Bildschirm-Pixel) in die neuen Plätze.
   * Mit `from.r` kommen sie aus einer Essens-Kugel dieses Radius: Start überall auf
   * ihrer Fläche, früher abfliegende von oben (dort leert sie sich zuerst).
   */
  launch(from: { x: number; y: number; r?: number }, before: OrbLayout, after: OrbLayout) {
    const now = performance.now()
    const main = fillChange(before.main.fill, after.main.fill)
    const moonCh = after.moons.map(m => {
      const b = before.moons.find(x => x.key === m.key)
      return { key: m.key, ch: b ? fillChange(b.fill, m.fill) : null }
    })
    const flashOf = (ch: { from: number; to: number }, t0: number, hide: boolean): Flash | null =>
      ch.to > ch.from ? { from: ch.from, to: ch.to, t0, spread: SPREAD, hide } : null
    const n = after.main.n
    const share = (f: Fill) => (f.filled + f.extra) / n
    const goal = before.main.fill.filled < n && after.main.fill.filled >= n
    if (this.reduce || !this.fxCtx) {
      if (main?.grew) this.flash = flashOf(main, now, false)
      for (const { key, ch } of moonCh) if (ch?.grew) this.moonFlash[key] = flashOf(ch, now, false) ?? undefined
      // Ohne Flug: einmal Rückmeldung, sofort.
      if (main?.grew || moonCh.some(m => m.ch?.grew)) this.feedbackIn(share(after.main.fill), true, goal)
      return
    }
    const list: Omit<Particle, 'sx' | 'sy' | 'delay' | 'dur' | 't0' | 'ox' | 'oy' | 'lift' | 'side' | 'out' | 'dx' | 'fall'>[] = []
    const mainColor: ColorIndex = after.main.key === 'kcal' ? 1 : 2
    if (main?.grew) {
      const cnt = Math.min(90, main.to - main.from)
      for (let i = 0; i < cnt; i++) {
        const f = cnt > 1 ? i / (cnt - 1) : 0
        list.push({ kind: 'core', rank: Math.min(main.to - 1, Math.round(main.from + f * (main.to - main.from - 1))), f, ci: mainColor })
      }
      const hc = Math.min(40, main.extra)
      for (let h = 0; h < hc; h++) list.push({ kind: 'halo', f: (cnt ? 0.5 : 0) + (cnt ? 0.5 : 1) * (hc > 1 ? h / (hc - 1) : 0), ci: mainColor })
    }
    for (const { key, ch } of moonCh) {
      if (!ch?.grew) continue
      const span = ch.to - ch.from
      const cnt = Math.min(24, span)
      for (let j = 0; j < cnt; j++) {
        const f = cnt > 1 ? j / (cnt - 1) : 0
        list.push({ kind: 'moonCore', moon: key, rank: Math.min(ch.to - 1, Math.round(ch.from + f * (span - 1))), f: f * 0.7, ci: MOON_COLOR[key] })
      }
      // Was über das Grammziel geht, fliegt danach in die Hülle um den Mond.
      const hc = Math.min(12, ch.extra)
      for (let h = 0; h < hc; h++) list.push({ kind: 'moonHalo', moon: key, f: (cnt ? 0.5 : 0) + (cnt ? 0.5 : 1) * (hc > 1 ? h / (hc - 1) : 0), ci: MOON_COLOR[key] })
    }
    const disk = (f: number) => {
      // Punkt auf der Kugelfläche; f = Abflugreihenfolge 0…1 → von oben nach unten.
      const r = from.r ?? 0
      const y = (-1 + 2 * Math.min(1, Math.max(0, f + (Math.random() - 0.5) * 0.25))) * r
      const w = Math.sqrt(Math.max(0, r * r - y * y))
      return { x: from.x + (Math.random() * 2 - 1) * w, y: from.y + y }
    }
    const flying = list.map((p): Particle => ({
      ...p,
      ...(from.r ? (({ x, y }) => ({ sx: x, sy: y }))(disk(p.f)) : { sx: from.x + (Math.random() - 0.5) * 60, sy: from.y + (Math.random() - 0.5) * 12 }),
      delay: p.f * SPREAD + Math.random() * 40,
      dur: TRAVEL + Math.random() * 120,
      t0: now,
      ox: (Math.random() - 0.5) * 0.9,
      oy: (Math.random() - 0.5) * 0.9,
      lift: 90 + Math.random() * 70,
      side: (Math.random() - 0.5) * 120,
      out: false, dx: 0, fall: 0,
    }))
    // Ticks in der echten Ankunftsreihenfolge; Tonhöhe steigt mit dem Füllstand, der letzte ist der kräftige.
    const b0 = share(before.main.fill), b1 = share(after.main.fill)
    assignTicks(flying, p => p.delay + p.dur, TICKS_IN, pr => ({ level: b0 + (b1 - b0) * pr, last: pr === 1, goal }))
    this.particles.push(...flying)
    // Die neuen Plätze leuchten auf, wenn ihre Punkte ankommen — bis dahin bleiben sie grau.
    const t0 = now + TRAVEL + 60
    if (main?.grew) this.flash = flashOf(main, t0, true)
    for (const { key, ch } of moonCh) if (ch?.grew) this.moonFlash[key] = flashOf(ch, t0, true) ?? undefined
  }

  /**
   * Entfernen: Punkte wandern zum untersten Punkt ihrer Kugel und fallen dort heraus.
   * Mit `to` (Eintrag auf einen anderen Tag verschoben) fliegen die Punkte der Kugel von dort
   * weiter in die Kugel dieses Tages (Wochenleiste) — die Monde fallen wie sonst.
   */
  release(before: OrbLayout, after: OrbLayout, to: { x: number; y: number; r: number } | null = null) {
    const main = fillChange(before.main.fill, after.main.fill)
    if (main && !main.grew) this.flash = null
    const moonCh = after.moons.map(m => {
      const b = before.moons.find(x => x.key === m.key)
      return { key: m.key, ch: b ? fillChange(b.fill, m.fill) : null }
    })
    for (const { key, ch } of moonCh) if (ch && !ch.grew) delete this.moonFlash[key]
    const level = (after.main.fill.filled + after.main.fill.extra) / after.main.n
    if (this.reduce || !this.fxCtx || !this.geo) {
      if (main && !main.grew) this.feedbackOut(level)
      return
    }
    const now = performance.now()
    const rect = this.canvas.getBoundingClientRect()
    const mainColor: ColorIndex = after.main.key === 'kcal' ? 1 : 2
    const list: { kind: Kind; moon?: MacroKey; rank?: number; f: number; ci: ColorIndex }[] = []
    if (main && !main.grew) {
      const hc = Math.min(20, main.extra)
      for (let h = 0; h < hc; h++) list.push({ kind: 'halo', f: 0.4 * (hc > 1 ? h / (hc - 1) : 0), ci: mainColor })
      const cnt = Math.min(45, main.to - main.from)
      for (let i = 0; i < cnt; i++) {
        const f = cnt > 1 ? i / (cnt - 1) : 0
        // Zuerst die zuletzt gefüllten Plätze.
        list.push({ kind: 'core', rank: Math.max(main.from, Math.round(main.to - 1 - f * (main.to - main.from - 1))), f: (hc ? 0.4 : 0) + (hc ? 0.6 : 1) * f, ci: mainColor })
      }
    }
    for (const { key, ch } of moonCh) {
      if (!ch || ch.grew) continue
      const hc = Math.min(8, ch.extra)
      for (let h = 0; h < hc; h++) list.push({ kind: 'moonHalo', moon: key, f: 0.4 * (hc > 1 ? h / (hc - 1) : 0), ci: MOON_COLOR[key] })
      const span = ch.to - ch.from
      const cnt = Math.min(12, span)
      for (let j = 0; j < cnt; j++) {
        const f = cnt > 1 ? j / (cnt - 1) : 0
        list.push({ kind: 'moonCore', moon: key, rank: Math.max(ch.from, Math.round(ch.to - 1 - f * (span - 1))), f: (hc ? 0.4 : 0) + (hc ? 0.6 : 1) * f, ci: MOON_COLOR[key] })
      }
    }
    const falling: Particle[] = []
    for (const p of list) {
      // Landung in der unteren Hälfte der Zielkugel: dort steigen die Punkte von unten hinein.
      const a = Math.PI * (0.2 + 0.6 * Math.random())
      const d = to ? to.r * (0.2 + 0.5 * Math.random()) : 0
      const fly = to && !p.moon ? { x: to.x + Math.cos(a) * d, y: to.y + Math.sin(a) * d } : undefined
      const pt: Particle = {
        ...p, sx: 0, sy: 0, t0: now, delay: p.f * 260 + Math.random() * 30, dur: fly ? RELEASE_FLY_MS + Math.random() * 100 : 560 + Math.random() * 100,
        ox: (Math.random() - 0.5) * 0.9, oy: (Math.random() - 0.5) * 0.9, lift: 0, side: (Math.random() - 0.5) * 30, out: true,
        dx: (Math.random() - 0.5) * 16, fall: (p.moon ? 40 : 70) + Math.random() * 40, to: fly,
      }
      const start = this.target(pt, rect)
      if (!start) continue
      pt.sx = start.x
      pt.sy = start.y
      falling.push(pt)
    }
    // Ticks, wenn die Punkte den Pol verlassen (ease-in-out: etwa nach 52 % der Dauer); Tonhöhe sinkt.
    assignTicks(falling, p => p.delay + p.dur * 0.52, TICKS_OUT, pr => ({ level: level + (1 - pr) * 0.08, last: pr === 1, goal: false }))
    this.particles.push(...falling)
  }

  /** Zielpunkt eines Partikels in Bildschirm-Pixeln, in jedem Bild neu — die Kugel dreht sich ja. */
  private target(pt: Particle, rect: DOMRect): { x: number; y: number; size: number } | null {
    const g = this.geo
    if (!g) return null
    const k = this.dpr
    const at = (x: number, y: number, size: number) => ({ x: rect.left + x / k, y: rect.top + y / k, size })
    if (pt.kind === 'core' && this.layout) {
      const n = this.layout.main.n
      const p = spherePoints(n)
      const i = n - 1 - (pt.rank ?? 0)
      const x = p[i * 4], y = p[i * 4 + 1], z = p[i * 4 + 2], M = g.M
      return at(g.cx + (M[0] * x + M[1] * y + M[2] * z) * g.R, g.cy - (M[3] * x + M[4] * y + M[5] * z) * g.R, 2.4 * dotScale(n))
    }
    if (pt.kind === 'halo') return at(g.cx + pt.ox * g.R * 1.3, g.cy + pt.oy * g.R * 1.3, 2.2)
    const mg = pt.moon ? this.moonGeo[pt.moon] : undefined
    if (!mg) return null
    if (pt.kind === 'moonHalo') {
      const ang = Math.atan2(pt.oy, pt.ox)
      const r = mg.R * (1.14 + 0.12 * Math.abs(pt.ox))
      return at(mg.cx + Math.cos(ang) * r, mg.cy + Math.sin(ang) * r, 2)
    }
    const p = spherePoints(mg.n)
    const i = mg.n - 1 - (pt.rank ?? 0)
    const x = p[i * 4], y = p[i * 4 + 1], z = p[i * 4 + 2], M = mg.M
    return at(mg.cx + (M[0] * x + M[1] * y + M[2] * z) * mg.R, mg.cy - (M[3] * x + M[4] * y + M[5] * z) * mg.R, 2.2)
  }

  /** Unterster Punkt der Kugel bzw. des Mondes, aus dem entfernte Punkte fallen. */
  private pole(pt: Particle, rect: DOMRect): { x: number; y: number } | null {
    const k = this.dpr
    if (pt.moon) {
      const mg = this.moonGeo[pt.moon]
      return mg ? { x: rect.left + mg.cx / k, y: rect.top + (mg.cy + mg.R) / k } : null
    }
    const g = this.geo
    return g ? { x: rect.left + g.cx / k, y: rect.top + (g.cy + g.R) / k } : null
  }

  private feedbackIn(level: number, last: boolean, goal: boolean) {
    if (last && goal) {
      hapticGoal()
      soundGoal()
      return
    }
    hapticTick(last)
    soundArrive(level)
  }

  /** Herausfallen: immer leicht und leiser als beim Eintragen. */
  private feedbackOut(level: number) {
    hapticTick(false)
    soundFall(level)
  }

  private clearFx() {
    if (this.fxCtx && this.fx) this.fxCtx.clearRect(0, 0, this.fx.width, this.fx.height)
    this.fxDirty = false
  }

  private drawParticles(now: number) {
    const ctx = this.fxCtx
    if (!ctx || !this.fx) return
    if (!this.particles.length) {
      if (this.fxDirty) this.clearFx()
      return
    }
    this.sizeFx()
    this.fxDirty = true
    ctx.clearRect(0, 0, this.fx.width, this.fx.height)
    const S = this.dpr
    const rect = this.canvas.getBoundingClientRect()
    const keep: Particle[] = []
    const put = (ci: ColorIndex, x: number, y: number, sz: number, a: number) => {
      const s = this.fxSprites[ci]
      if (!s) return
      ctx.globalAlpha = a
      ctx.drawImage(s, (x - sz / 2) * S, (y - sz / 2) * S, sz * S, sz * S)
    }
    for (const pt of this.particles) {
      const t = (now - pt.t0 - pt.delay) / pt.dur
      // Ankunft (Eintragen): Rückmeldung genau im Bild, in dem der Punkt seinen Platz erreicht.
      if (t >= 1 && pt.tick && !pt.ticked && !pt.out) {
        pt.ticked = true
        this.feedbackIn(pt.tick.level, pt.tick.last, pt.tick.goal)
      }
      if (t >= 1) continue
      keep.push(pt)
      if (t < 0) continue
      if (pt.out) {
        const P = this.pole(pt, rect)
        if (!P) continue
        // Mit Ziel ist der Weg länger: der Gang zum Pol dauert gleich lang, der Rest ist Flug.
        const SPLIT = pt.to ? 0.32 : 0.55
        for (let tr = 2; tr >= 0; tr--) {
          const e = easeInOut(Math.max(0, t - tr * 0.03))
          let x: number, y: number, a: number, sz: number
          if (e < SPLIT) {
            // Erst nach unten, dann zur Mitte: der Bogen läuft in den Pol hinein.
            const u = e / SPLIT
            const cx = pt.sx + (P.x - pt.sx) * 0.15, cy = P.y
            x = (1 - u) ** 2 * pt.sx + 2 * (1 - u) * u * cx + u * u * P.x
            y = (1 - u) ** 2 * pt.sy + 2 * (1 - u) * u * cy + u * u * P.y
            a = 0.9
            sz = 2.6
          } else {
            // Der Punkt verlässt die Kugel: leiser Tick.
            if (tr === 0 && pt.tick && !pt.ticked) {
              pt.ticked = true
              this.feedbackOut(pt.tick.level)
            }
            const v = (e - SPLIT) / (1 - SPLIT)
            if (pt.to) {
              // Aus dem Pol nach unten, im Bogen unter die Zielkugel und von unten hinein.
              const T = pt.to
              const cx = (P.x + T.x) / 2 + pt.side, cy = Math.max(P.y, T.y) + 34
              x = (1 - v) ** 2 * P.x + 2 * (1 - v) * v * cx + v * v * T.x
              y = (1 - v) ** 2 * P.y + 2 * (1 - v) * v * cy + v * v * T.y
              const q = Math.max(0, (v - 0.85) / 0.15)
              a = 0.95 * (1 - q)
              sz = 2.8 * (1 - 0.5 * q)
            } else {
              x = P.x + pt.dx * v
              y = P.y + pt.fall * v
              a = 0.9 * (1 - v)
              sz = 2.6 * (1 - 0.35 * v)
            }
          }
          put(pt.ci, x, y, sz, a * (tr === 0 ? 1 : tr === 1 ? 0.4 : 0.18))
        }
        continue
      }
      const T = this.target(pt, rect)
      if (!T) continue
      // Bogen: Kontrollpunkt über der Mitte, leicht seitlich versetzt.
      const cx = (pt.sx + T.x) / 2 + pt.side
      const cy = Math.min(pt.sy, T.y) - pt.lift
      for (let tr = 2; tr >= 0; tr--) {
        const e = easeInOut(Math.max(0, t - tr * 0.035))
        const x = (1 - e) ** 2 * pt.sx + 2 * (1 - e) * e * cx + e * e * T.x
        const y = (1 - e) ** 2 * pt.sy + 2 * (1 - e) * e * cy + e * e * T.y
        const sz = (6 + (T.size - 6) * e) * (tr ? 0.75 : 1)
        put(pt.ci, x, y, sz, tr === 0 ? 0.95 : tr === 1 ? 0.35 : 0.15)
      }
    }
    ctx.globalAlpha = 1
    this.particles = keep
  }

  // ─── Schleife ─────────────────────────────────────────────────────────

  private readonly loop = (ts: number) => {
    this.raf = requestAnimationFrame(this.loop)
    if ((!this.visible && !this.particles.length) || document.hidden || !this.layout || !this.renderer.mode || this.renderer.lost) {
      this.last = 0
      return
    }
    // Volle Bildrate des Displays — Flüssigkeit geht vor; außer Sicht steht die Schleife.
    // Ist ein Bild teuer (schwaches Gerät, WebGL ohne Grafikkarte), höchstens ein Drittel der Zeit
    // zeichnen: sonst blockiert die Kugel Tippen, Scrollen und den Rest der Seite.
    const now = performance.now()
    if (this.cost > 6 && now - this.workedAt < this.cost * 3) return
    this.workedAt = now
    const dt = this.last ? Math.min(0.1, (ts - this.last) / 1000) : 0
    this.last = ts

    if (this.focusKey && now > this.focusUntil) this.clearFocus()
    if (!this.reduce) {
      for (const k of Object.keys(this.focusA) as MacroKey[]) {
        this.focusA[k] += ((this.focusKey === k ? 1 : 0) - this.focusA[k]) * (1 - Math.exp(-dt * 10))
      }
    }
    if (!this.drag) {
      // Schwung läuft aus und geht ins ruhige Grundtempo über.
      if (Math.abs(this.wy) > 0.002) {
        this.q = qNorm(qMul(this.q, qAxis(0, 1, 0, this.wy * dt)))
        this.wy *= Math.exp(-dt * 2.4)
      }
      const target = this.focusKey || this.reduce ? 0 : 1
      this.spinF += (target - this.spinF) * (1 - Math.exp(-dt * 1.4))
      const step = dt * 0.16 * this.spinF
      this.q = qNorm(qMul(this.q, qAxis(0, 1, 0, step)))
      this.haloA -= step * 1.6
    } else {
      this.spinF = 0
    }
    for (const m of this.layout.moons) {
      if (this.focusKey === m.key) continue
      this.phase[m.key] += (this.reduce ? 0 : dt * 1000 * m.orbit.speed * this.spinF) + this.wy * dt * 0.5
    }
    const flashing = (f: Flash | null | undefined) => !!f && now - f.t0 < f.spread + 750
    const easing = (Object.keys(this.focusA) as MacroKey[]).some(k => Math.abs((this.focusKey === k ? 1 : 0) - this.focusA[k]) > 0.003)
    if (this.visible && (!this.reduce || this.needsDraw || this.particles.length || easing || flashing(this.flash)
      || Object.values(this.moonFlash).some(flashing))) {
      this.draw(now)
      this.needsDraw = false
    }
    if (this.focusKey && this.label) {
      const p = this.labelAt(this.focusKey)
      this.label.style.left = `${p.x}px`
      this.label.style.top = `${p.y}px`
    }
    this.drawParticles(now)
    this.cost = this.cost * 0.85 + (performance.now() - now) * 0.15
  }

  private draw(now: number) {
    const layout = this.layout!
    const r = this.renderer
    const k = this.dpr
    const live = !this.reduce
    const cx = (this.cssW / 2) * k
    const cy = this.centerY * k
    const R = this.radius * k
    // Beim Verkleinern (Scrollen) werden die Punkte halb so stark mit kleiner, damit sie lesbar bleiben.
    const dens = dotScale(layout.main.n) * (0.5 + 0.5 * (this.radius / this.baseRadius))
    const M = qMat(this.q)
    r.begin()
    this.drawMoons(0, cx, cy, R, now, dens)
    const pv = this.preview
    drawSphere(r, layout.main.n, pv ? pv.main.fill : layout.main.fill, {
      M, HM: qMat(qMul(this.q, qAxis(0, 1, 0, this.haloA))), cx, cy, R,
      px: DOT_MAIN * k * dens, color: layout.main.key === 'kcal' ? 1 : 2, now, live, flash: this.flash,
      preview: pv ? previewRange(layout.main.fill, pv.main.fill) : null,
    })
    this.geo = { M, cx, cy, R }
    this.drawMoons(1, cx, cy, R, now, dens)
    r.end()
  }

  /** pass 0 = hinter der Kugel, pass 1 = davor. Ein angetippter Mond wird immer vorn gezeichnet. */
  private drawMoons(pass: 0 | 1, cx: number, cy: number, R: number, now: number, dens: number) {
    const r = this.renderer
    const k = this.dpr
    for (const m of this.layout!.moons) {
      const o = m.orbit
      const Q = qMat(qMul(this.q, qMul(qAxis(0, 0, 1, o.tiltZ), qAxis(1, 0, 0, o.tiltX))))
      // Bahn: ganz zarte Punktspur.
      for (let j = 0; j < 96; j++) {
        const th = (j / 96) * Math.PI * 2
        const ox = Math.cos(th) * o.rad, oz = Math.sin(th) * o.rad
        const ovz = Q[6] * ox + Q[8] * oz
        if ((pass === 0) !== (ovz < 0)) continue
        r.dot(0, cx + (Q[0] * ox + Q[2] * oz) * R, cy - (Q[3] * ox + Q[5] * oz) * R, DOT_TRAIL * k, 0.1 + 0.08 * (ovz / o.rad + 1) / 2)
      }
      const th = this.phase[m.key]
      const foc = this.focusA[m.key]
      const lx = Math.cos(th) * o.rad, lz = Math.sin(th) * o.rad
      const vx = Q[0] * lx + Q[2] * lz, vy = Q[3] * lx + Q[5] * lz, vz = Q[6] * lx + Q[8] * lz
      const front = vz >= 0 || foc > 0.01
      if ((pass === 1) !== front) continue
      const depth = (vz / o.rad + 1) / 2
      const d = foc > 0.01 ? Math.max(depth, foc) : depth
      const scale = (0.85 + 0.3 * d) * (1 + 0.38 * foc)
      const Mm = qMat(qMul(this.q, qAxis(0, 1, 0, (this.reduce ? 0 : now * 0.0005) + o.phase)))
      const mcx = cx + vx * R, mcy = cy - vy * R, mR = R * m.r * scale
      const pm = this.preview?.moons.find(x => x.key === m.key)
      drawSphere(r, m.n, pm ? pm.fill : m.fill, {
        preview: pm ? previewRange(m.fill, pm.fill) : null,
        M: Mm, HM: qMat(qMul(this.q, qAxis(0, 1, 0, (this.reduce ? 0 : -now * 0.0003) + o.phase))),
        cx: mcx, cy: mcy, R: mR, px: DOT_MOON * k * dens * scale, color: MOON_COLOR[m.key],
        now, live: !this.reduce, flash: this.moonFlash[m.key] ?? null,
      })
      this.moonGeo[m.key] = { M: Mm, n: m.n, cx: mcx, cy: mcy, R: mR, front }
    }
    if (pass === 1) {
      for (const key of Object.keys(this.moonGeo) as MacroKey[]) {
        if (!this.layout!.moons.some(m => m.key === key)) delete this.moonGeo[key]
      }
    }
  }
}

/** Höchstens `count` Ticks gleichmäßig über die Punkte, in der Reihenfolge ihres Eintreffens (`when`). */
function assignTicks(parts: Particle[], when: (p: Particle) => number, count: number, make: (progress: number) => NonNullable<Particle['tick']>) {
  const order = [...parts].sort((a, b) => when(a) - when(b))
  const ticks = Math.min(count, order.length)
  for (let j = 0; j < ticks; j++) {
    const pr = ticks > 1 ? j / (ticks - 1) : 1
    order[Math.round(pr * (order.length - 1))].tick = make(pr)
  }
}

/** Was die Vorschau dazubringt: Plätze `from`–`to` und Hüllenpunkte ab `extraFrom`. */
function previewRange(now: Fill, then: Fill): { from: number; to: number; extraFrom: number } {
  return { from: now.filled, to: Math.max(now.filled, then.filled), extraFrom: now.extra }
}
