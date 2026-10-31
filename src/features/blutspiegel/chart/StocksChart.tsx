/**
 * Der Blutspiegel-Graph, nach dem Vorbild der Aktien-App:
 *
 *  - Kein Rahmen, keine Karte. Flaeche mit Verlauf, Y-Werte rechts, Zeit unten.
 *  - Fester Zeitraum (vom Aufrufer), Y-Achse passt sich dem Ausschnitt an.
 *  - Wechsel von Zeitraum oder Substanz gleitet (Achsen) bzw. blendet (Kurve)
 *    in ~350 ms, statt zu springen.
 *  - Finger auf den Graph: senkrechte Linie + Punkt folgen dem Finger, der
 *    Teil rechts davon wird blasser; Wert und Zeit meldet `onScrub` an die
 *    Ueberschrift. Maus: sofort. Touch: waagerecht ziehen oder kurz halten —
 *    senkrecht bleibt Scrollen der Seite.
 *  - Einnahmen als feine Striche am unteren Rand (wie die Volumenbalken).
 *
 * Alles laeuft in einem Canvas mit requestAnimationFrame; React rendert den
 * Graph nur bei neuen Props, nicht pro Frame.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { hapticTick } from '../../../lib/haptics'
import { useThemeRedraw } from './useThemeRedraw'
import {
  easeOutCubic,
  indexAtOrBefore,
  levelAt,
  timeStep,
  timeTicks,
  visibleSlice,
  zoneRuns,
  zoneRunsStepped,
  limitsAt,
  type LimitStep,
  yDomainFor,
  type LevelPoint,
  type YDomain,
} from './stocksChartMath'

export interface ChartMarker { ts: number; label: string; color: string }

/** Zyklus-Balken am Boden der Zeichenflaeche, je Zeile einer (Fortschritt-Verlauf). */
export interface LaneBand {
  id: string
  color: string
  /** Abgeschlossener Zyklus: gefuellt; laufende Substanz: gestrichelter Rahmen. */
  filled: boolean
  x1: number
  x2: number
  lane: number
  /** Echter Start (fuer den Start-Strich); null, wenn er vor dem Fenster liegt. */
  start: number | null
  /** Name im Balken, wenn er hineinpasst (Blutwerte). */
  label?: string
}

export interface LaneLayout { blockHeight: number; laneHeight: number; laneGap: number }

/** Weitere Linie im selben Graph (z. B. mehrere Marker in % Veraenderung). */
export interface ExtraSeries { key: string; name: string; points: LevelPoint[]; color: string }

export interface StocksChartProps {
  points: LevelPoint[]
  start: number
  end: number
  accent: string
  height: number
  /** Wechselt die Substanz, blendet die Kurve über statt zu gleiten. */
  seriesKey: string
  intakes?: number[]
  markers?: ChartMarker[]
  formatTick: (ts: number, stepMs: number) => string
  /** Eigene X-Ticks (z. B. Stunden nach der Gabe); Standard: Uhrzeit/Tage. */
  xTicks?: (start: number, end: number, widthPx: number) => { ticks: number[]; step: number }
  formatValue?: (value: number) => string
  onScrub?: (point: LevelPoint | null) => void
  /**
   * Schild ueber dem Graph beim Ablesen (wie die Aktien-App): Datum oben,
   * Wert darunter in der Linienfarbe. Haelt oben eine feste Zeile frei, damit
   * beim Antippen nichts springt.
   */
  scrubLabel?: {
    date: (ts: number) => string
    value: (level: number) => string
    /** Zusatz hinter dem Wert, z. B. „BPC-157 · Start" (gedaempft). */
    note?: (ts: number) => string | null
  }
  ariaLabel: string
  /** Punkt am Kurvenende (Live). */
  liveEnd?: boolean
  /** Schattiertes Band (z. B. Referenzbereich) mit gestrichelten Grenzen. */
  band?: {
    lo: number | null; hi: number | null; color: string
    /** Grenzen, die sich ueber die Zeit aendern; ersetzt dann lo/hi. */
    steps?: LimitStep[]
  }
  /**
   * Hauptlinie nach Bereich faerben: innerhalb [lo, hi] `inside`, darueber und
   * darunter `outside` — Linie, Flaeche, Punkte und Ablesen. Die Farbe wechselt
   * genau dort, wo die Linie eine Grenze kreuzt.
   */
  zoneColors?: {
    lo: number | null; hi: number | null; inside: string; outside: string
    /** Grenzen, die sich ueber die Zeit aendern; ersetzt dann lo/hi. */
    steps?: LimitStep[]
    /** Farbe fuer Abschnitte ohne Bereich (nur mit steps). */
    neutral?: string
  }
  /** Jeden Datenpunkt als Punkt zeigen (Messwerte statt Kurve). */
  dots?: boolean
  /** Werte, die die Y-Achse immer enthalten soll (z. B. die Bandgrenzen). */
  yInclude?: number[]
  /** Y-Achse bei 100 deckeln (Prozent-Spiegel); Standard an. */
  percentCap?: boolean
  /** Kleinste Spanne der Y-Achse; Standard 2. */
  minSpan?: number
  /** Leiste fuer Einnahme-Striche unter der Kurve; Standard an. */
  intakeStrip?: boolean
  /** Breite der Werte-Achse links; Standard AXIS_WIDTH. */
  axisWidth?: number
  /**
   * Zurueckblaettern: Wischen verschiebt das Fenster (Ende zwischen min + Spanne
   * und max), Halten liest ab, die Maus liest beim Ueberfahren. Ohne pan liest
   * Ziehen ab.
   */
  pan?: { min: number; max: number; onPan: (end: number) => void; jumpLabel: string }
  /** Haltezeit bis zum Ablesen bei Beruehrung; Standard 180 ms. */
  holdMs?: number
  /** Weitere Zeitpunkte, an denen das Ablesen einrastet (z. B. Zyklus-Starts). */
  snapTimes?: number[]
  /** Name der Hauptlinie im Ablese-Schild, wenn es weitere Linien gibt. */
  seriesName?: string
  /** Weitere Linien; das Schild nennt dann alle Werte des Zeitpunkts. */
  others?: ExtraSeries[]
  /** Zeitabschnitte im Hintergrund (z. B. Zyklusphasen) mit Namen oben links. */
  xBands?: Array<{ x1: number; x2: number; color: string; label: string }>
  /** Senkrechte gestrichelte Linien (z. B. Bluttests), optional beschriftet. */
  xLines?: Array<{ ts: number; color: string; label?: string }>
  /** Zeitachse unten zeigen; Standard an. */
  xAxis?: boolean
  /** Ungefaehre Zahl der Werte-Linien; Standard 4 (kleine Graphen: 2). */
  yTicks?: number
  /** Von aussen gesetzter Ablesezeitpunkt (gekoppelte Graphen). */
  syncTs?: number | null
  /** Zyklus-Balken hinter der Kurve. */
  lanes?: {
    items: LaneBand[]; count: number; layout: (plotHeight: number, count: number) => LaneLayout
    /** Zusaetzliche Hoehe unter der Werteflaeche: die unteren Reihen haengen dort hinein. */
    below?: number
  }
}

/** Breite der Werte-Achse rechts; Inhalte darunter richten sich danach aus. */
export const AXIS_WIDTH = 38
const AXIS_BOTTOM = 22
const INTAKE_STRIP_H = 12
/** Mehr Einnahmen im Fenster: nur noch Striche unter der Achse, keine Linien und Ringe. */
const MAX_EINNAHME_LINIEN = 40
const PAD_TOP = 10
/** Hoehe der freien Zeile fuer das Ablese-Schild. */
const LABEL_H = 40
const ANIM_MS = 350
const REVEAL_MS = 650
const HOLD_MS = 180
const DRAG_START_PX = 6

interface View { start: number; end: number; lo: number; hi: number }

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function cssVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim()
  return v || fallback
}

export const StocksChart = memo(function StocksChart({
  points, start, end, accent, height, seriesKey, intakes = [], markers = [],
  formatTick, xTicks, formatValue = v => String(Math.round(v)), onScrub, scrubLabel, ariaLabel, liveEnd = false,
  band, dots = false, yInclude, percentCap = true, minSpan = 2, intakeStrip = true,
  axisWidth = AXIS_WIDTH, pan, holdMs = HOLD_MS, snapTimes, lanes,
  seriesName, others, xBands, xLines, xAxis = true, syncTs = null, yTicks = 4, zoneColors,
}: StocksChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pulseRef = useRef<HTMLSpanElement>(null)
  const widthRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  // Wischen: hoechstens ein Fensterwechsel je Bild
  const panFrameRef = useRef<number | null>(null)
  const pendingPanRef = useRef<number | null>(null)

  // Was gerade gezeichnet wird (animiert) und wohin es geht.
  const viewRef = useRef<View | null>(null)
  const fromViewRef = useRef<View | null>(null)
  const targetViewRef = useRef<View | null>(null)
  const animStartRef = useRef(0)

  // Kurven-Ueberblendung beim Substanzwechsel
  const pointsRef = useRef(points)
  const prevPointsRef = useRef<LevelPoint[] | null>(null)
  const prevAccentRef = useRef(accent)
  const currentAccentRef = useRef(accent)
  const fadeStartRef = useRef(0)
  const seriesKeyRef = useRef(seriesKey)
  const revealStartRef = useRef<number | null>(null)

  const propsRef = useRef({ intakes, markers, formatTick, xTicks, formatValue, liveEnd, height, scrubLabel, band, dots, intakeStrip, axisWidth, snapTimes, lanes, seriesName, others, xBands, xLines, xAxis, syncTs, zoneColors })
  const onScrubRef = useRef(onScrub)
  const panRef = useRef(pan)
  useLayoutEffect(() => {
    propsRef.current = { intakes, markers, formatTick, xTicks, formatValue, liveEnd, height, scrubLabel, band, dots, intakeStrip, axisWidth, snapTimes, lanes, seriesName, others, xBands, xLines, xAxis, syncTs, zoneColors }
    onScrubRef.current = onScrub
    panRef.current = pan
  })

  const scrubTsRef = useRef<number | null>(null)
  const panningRef = useRef(false)
  const lastHapticBucketRef = useRef<number | null>(null)

  // ── Zeichnen ──────────────────────────────────────────────────────────────
  // Die Zeichenfunktion plant sich selbst neu, solange etwas gleitet; ueber
  // den Ref, weil sie sich innerhalb ihrer eigenen Definition nicht kennt.
  const drawRef = useRef<(now: number) => void>(() => {})
  const draw = useCallback((now: number) => {
    rafRef.current = null
    const canvas = canvasRef.current
    const target = targetViewRef.current
    if (!canvas || !target) return
    const width = widthRef.current
    const color = currentAccentRef.current
    const { intakes: intakeList, markers: markerList, formatTick: fmtTick, xTicks: customTicks, formatValue: fmtValue, liveEnd: showLive, height: h, band: bandArea, dots: showDots } = propsRef.current
    const INTAKE_STRIP = propsRef.current.intakeStrip ? INTAKE_STRIP_H : 0
    const LANES_BELOW = propsRef.current.lanes?.below ?? 0
    // Alles zwischen Werteflaeche und Zeitachse
    const BELOW = INTAKE_STRIP + LANES_BELOW
    if (width <= 0) return

    const reduced = prefersReducedMotion()
    let animating = false

    // Achsen gleiten
    const from = fromViewRef.current
    let view = target
    if (from && !reduced) {
      const t = Math.min(1, (now - animStartRef.current) / ANIM_MS)
      const e = easeOutCubic(t)
      view = {
        start: lerp(from.start, target.start, e),
        end: lerp(from.end, target.end, e),
        lo: lerp(from.lo, target.lo, e),
        hi: lerp(from.hi, target.hi, e),
      }
      if (t < 1) animating = true
      else fromViewRef.current = null
    }
    viewRef.current = view

    // Kurve blendet
    let fade = 1
    if (prevPointsRef.current && !reduced) {
      fade = Math.min(1, (now - fadeStartRef.current) / ANIM_MS)
      if (fade < 1) animating = true
      else prevPointsRef.current = null
    }

    // Erster Auftritt: Kurve waechst von links
    let reveal = 1
    if (revealStartRef.current != null && !reduced) {
      reveal = easeOutCubic(Math.min(1, (now - revealStartRef.current) / REVEAL_MS))
      if (reveal < 1) animating = true
      else revealStartRef.current = null
    }

    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, h)

    const muted = cssVar(canvas, '--text-muted', '#8a94a6')
    // Ruhiges Gitter als Haarlinie, Achsen in Mono wie auf einem Laborbefund
    const grid = cssVar(canvas, '--lg-hair', 'rgba(148,163,184,0.16)')
    const surface = cssVar(canvas, '--surface', '#05060d')
    const sans = cssVar(canvas, '--font-sans', 'ui-sans-serif, system-ui, -apple-system, sans-serif')
    const mono = cssVar(canvas, '--font-mono', 'ui-monospace, Menlo, monospace')

    const plotL = propsRef.current.axisWidth
    // Rechts derselbe Rand wie links fuer die Werte: der Graph steht mittig.
    const plotR = width - propsRef.current.axisWidth
    const label = propsRef.current.scrubLabel
    const plotT = PAD_TOP + (label ? LABEL_H : 0)
    // Ohne Zeitachse bleibt ein schmaler Rand, damit die unterste Zahl nicht abgeschnitten wird.
    const axisBottom = propsRef.current.xAxis ? AXIS_BOTTOM : 8
    const plotB = h - axisBottom - BELOW
    const plotW = plotR - plotL
    const plotH = plotB - plotT
    const span = Math.max(1, view.end - view.start)
    const xOf = (ts: number) => plotL + ((ts - view.start) / span) * plotW
    const yOf = (lv: number) => plotB - ((lv - view.lo) / Math.max(1e-9, view.hi - view.lo)) * plotH

    // Band (Referenzbereich): offene Seite reicht bis an den Rand
    if (bandArea) {
      // Ohne steps ein Band ueber die ganze Breite; mit steps je Abschnitt eines.
      const abschnitte = bandArea.steps?.length
        ? bandArea.steps.map((st, i, all) => ({
          x1: i === 0 ? plotL : Math.max(plotL, xOf(st.from)),
          x2: i + 1 < all.length ? Math.min(plotR, xOf(all[i + 1].from)) : plotR,
          lo: st.lo, hi: st.hi,
        }))
        : [{ x1: plotL, x2: plotR, lo: bandArea.lo, hi: bandArea.hi }]
      for (const ab of abschnitte) {
        if (ab.x2 <= ab.x1 || (ab.lo == null && ab.hi == null)) continue
        const yTop = ab.hi != null ? Math.max(plotT, yOf(ab.hi)) : plotT
        const yBot = ab.lo != null ? Math.min(plotB, yOf(ab.lo)) : plotB
        if (yBot > yTop) {
          ctx.fillStyle = hexAlpha(bandArea.color, 0.1)
          ctx.fillRect(ab.x1, yTop, ab.x2 - ab.x1, yBot - yTop)
        }
        ctx.save()
        ctx.strokeStyle = hexAlpha(bandArea.color, 0.55)
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        for (const edge of [ab.lo, ab.hi]) {
          if (edge == null) continue
          const y = Math.round(yOf(edge)) + 0.5
          if (y < plotT || y > plotB) continue
          ctx.beginPath(); ctx.moveTo(ab.x1, y); ctx.lineTo(ab.x2, y); ctx.stroke()
        }
        ctx.restore()
      }
    }

    // Zyklus-Balken am Boden, hinter Raster und Kurve
    const laneData = propsRef.current.lanes
    if (laneData && laneData.count > 0 && laneData.items.length) {
      const { laneHeight, laneGap, blockHeight } = laneData.layout(plotH, laneData.count)
      const baseY = plotB + LANES_BELOW - blockHeight
      const scrubX = scrubTsRef.current != null ? xOf(scrubTsRef.current) : null
      // Farben duerfen auch `var(--name)` sein
      const farbe = (c: string) => {
        const m = /^var\((--[\w-]+)\)$/.exec(c.trim())
        return m ? cssVar(canvas, m[1], muted) : c
      }
      for (const lane of laneData.items) {
        const b = { ...lane, color: farbe(lane.color) }
        const x1 = Math.max(plotL, xOf(b.x1))
        const x2 = Math.min(plotR, xOf(b.x2))
        if (x2 <= x1) continue
        // Waechst beim ersten Auftritt von rechts nach links
        const w = Math.max(3, (x2 - x1) * reveal)
        const x = x2 - w
        const y = baseY + b.lane * (laneHeight + laneGap)
        ctx.save()
        ctx.beginPath(); ctx.roundRect(x, y, w, laneHeight, 4)
        ctx.globalAlpha = b.filled ? 0.16 : 0.1
        ctx.fillStyle = b.color
        ctx.fill()
        if (!b.filled) {
          ctx.globalAlpha = 0.4
          ctx.strokeStyle = b.color
          ctx.lineWidth = 1.5
          ctx.setLineDash([5, 4])
          ctx.stroke()
        }
        ctx.restore()
        if (b.label && reveal >= 1 && laneHeight >= 12) {
          // Name links im Balken, in Textfarbe
          ctx.save()
          ctx.font = `500 10px ${sans}`
          ctx.textBaseline = 'middle'
          ctx.textAlign = 'left'
          const links = b.start != null && xOf(b.start) >= plotL ? x + 7 : x + 5
          // Zu lang: mit „…" kuerzen, solange mindestens drei Zeichen bleiben
          const frei = x2 - links - 4
          let text = b.label
          if (ctx.measureText(text).width > frei) {
            while (text.length > 3 && ctx.measureText(`${text}…`).width > frei) text = text.slice(0, -1)
            text = `${text.trimEnd()}…`
          }
          if (ctx.measureText(text).width <= frei) {
            ctx.fillStyle = muted
            ctx.fillText(text, links, y + laneHeight / 2)
          }
          ctx.restore()
        }
        if (b.start != null && reveal >= 1) {
          const sx = xOf(b.start)
          if (sx < plotL || sx > plotR) continue
          const hi = scrubX != null && Math.abs(scrubX - sx) <= 14
          ctx.save()
          ctx.strokeStyle = b.color
          ctx.globalAlpha = hi ? 1 : 0.55
          ctx.lineWidth = hi ? 2.5 : 1.5
          ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx, y + laneHeight); ctx.stroke()
          ctx.globalAlpha = hi ? 1 : 0.8
          ctx.fillStyle = hi ? b.color : surface
          ctx.lineWidth = hi ? 2 : 1.25
          ctx.beginPath(); ctx.arc(sx, y, hi ? 4.5 : 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
          ctx.restore()
        }
      }
    }

    // Horizontale Linien + Werte rechts (die Ziel-Ticks, mit gleitender Lage)
    ctx.font = `400 10px ${mono}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'right'
    ctx.lineWidth = 1
    for (const tick of targetDomainTicks(target)) {
      const y = Math.round(yOf(tick)) + 0.5
      if (y < plotT - 1 || y > plotB + 1) continue
      ctx.strokeStyle = grid
      ctx.beginPath(); ctx.moveTo(plotL, y); ctx.lineTo(plotR, y); ctx.stroke()
      ctx.fillStyle = muted
      ctx.fillText(fmtValue(tick), plotL - 6, y)
    }

    // Senkrechte Linien + Zeit unten
    const xAxis = customTicks
      ? customTicks(view.start, view.end, plotW)
      : (() => { const step = timeStep(view.start, view.end, plotW); return { step, ticks: timeTicks(view.start, view.end, step) } })()
    const step = xAxis.step
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (const ts of xAxis.ticks) {
      const x = Math.round(xOf(ts)) + 0.5
      if (x < plotL || x > plotR) continue
      ctx.strokeStyle = grid
      ctx.beginPath(); ctx.moveTo(x, plotT); ctx.lineTo(x, plotB + BELOW); ctx.stroke()
      ctx.fillStyle = muted
      const label = fmtTick(ts, step)
      if (propsRef.current.xAxis && x + 4 + ctx.measureText(label).width < width) ctx.fillText(label, x + 4, plotB + BELOW + 6)
    }
    // Grundlinie
    ctx.strokeStyle = grid
    ctx.beginPath(); ctx.moveTo(plotL, plotB + BELOW + 0.5); ctx.lineTo(plotR, plotB + BELOW + 0.5); ctx.stroke()

    // Zeitabschnitte (Zyklusphasen) und senkrechte Linien (Bluttests)
    ctx.textBaseline = 'top'
    ctx.font = `500 9px ${sans}`
    for (const b of propsRef.current.xBands ?? []) {
      const x1 = Math.max(plotL, xOf(b.x1))
      const x2 = Math.min(plotR, xOf(b.x2))
      if (x2 <= x1) continue
      ctx.fillStyle = hexAlpha(b.color, 0.07)
      ctx.fillRect(x1, plotT, x2 - x1, plotB - plotT)
      if (x2 - x1 > 30) {
        ctx.save()
        ctx.beginPath(); ctx.rect(x1, plotT, x2 - x1, 14); ctx.clip()
        ctx.fillStyle = hexAlpha(b.color, 0.75)
        ctx.fillText(b.label, x1 + 4, plotT + 3)
        ctx.restore()
      }
    }
    for (const l of propsRef.current.xLines ?? []) {
      const x = Math.round(xOf(l.ts)) + 0.5
      if (x < plotL || x > plotR) continue
      ctx.save()
      ctx.strokeStyle = hexAlpha(l.color, 0.45)
      ctx.setLineDash([2, 5])
      ctx.beginPath(); ctx.moveTo(x, plotT); ctx.lineTo(x, plotB); ctx.stroke()
      ctx.restore()
      if (l.label) {
        ctx.fillStyle = hexAlpha(l.color, 0.8)
        ctx.textAlign = x + 4 + ctx.measureText(l.label).width > plotR ? 'right' : 'left'
        ctx.fillText(l.label, ctx.textAlign === 'right' ? x - 4 : x + 4, plotB - 14)
        ctx.textAlign = 'left'
      }
    }

    // Einnahmen: Striche unter der Achse in der Farbe der Substanz; sind es
    // nicht zu viele, dazu eine dezente senkrechte Linie bis zur Kurve.
    const sichtbareEinnahmen = intakeList.filter(ts => ts >= view.start && ts <= view.end)
    ctx.fillStyle = hexAlpha(color, 0.8)
    for (const ts of sichtbareEinnahmen) {
      ctx.fillRect(Math.round(xOf(ts)) - 1, plotB + 3, 2, INTAKE_STRIP - 4)
    }
    if (sichtbareEinnahmen.length <= MAX_EINNAHME_LINIEN && reveal >= 1) {
      ctx.save()
      ctx.strokeStyle = hexAlpha(color, 0.28)
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      for (const ts of sichtbareEinnahmen) {
        const lv = levelAt(pointsRef.current, ts)
        const x = Math.round(xOf(ts)) + 0.5
        ctx.beginPath(); ctx.moveTo(x, lv != null ? yOf(lv) : plotT); ctx.lineTo(x, plotB); ctx.stroke()
      }
      ctx.restore()
    }

    // Kurve(n)
    // Eigenes Ablesen geht vor; sonst der Zeitpunkt eines gekoppelten Graphen.
    const wantedScrub = scrubTsRef.current ?? propsRef.current.syncTs
    // Ein Zeitpunkt ausserhalb des Fensters (gekoppelter Graph) wird nicht gezeichnet.
    const scrubTs = wantedScrub != null && wantedScrub >= view.start && wantedScrub <= view.end ? wantedScrub : null
    const revealX = plotL + plotW * reveal
    const drawSeries = (pts: LevelPoint[], stroke: string, alpha: number, clipX?: [number, number]) => {
      const slice = visibleSlice(pts, view.start, view.end)
      if (slice.length < 2 || alpha <= 0) return
      const path = new Path2D()
      slice.forEach((p, i) => {
        const x = xOf(p.ts)
        const y = yOf(p.level)
        if (i === 0) path.moveTo(x, y)
        else path.lineTo(x, y)
      })
      const firstX = xOf(slice[0].ts)
      const lastX = xOf(slice[slice.length - 1].ts)
      const area = new Path2D(path)
      area.lineTo(lastX, plotB)
      area.lineTo(firstX, plotB)
      area.closePath()

      const paint = (dim: boolean) => {
        const grad = ctx.createLinearGradient(0, plotT, 0, plotB)
        grad.addColorStop(0, hexAlpha(stroke, dim ? 0.06 : 0.2))
        grad.addColorStop(1, hexAlpha(stroke, 0))
        ctx.fillStyle = grad
        ctx.fill(area)
        ctx.strokeStyle = dim ? hexAlpha(stroke, 0.35) : stroke
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.stroke(path)
      }

      ctx.save()
      ctx.globalAlpha = alpha
      const clipL = Math.max(plotL, clipX ? clipX[0] : plotL)
      const clipR = Math.min(plotR, revealX, clipX ? clipX[1] : plotR)
      ctx.beginPath(); ctx.rect(clipL, 0, Math.max(0, clipR - clipL), plotB); ctx.clip()
      if (scrubTs != null) {
        const sx = xOf(scrubTs)
        ctx.save(); ctx.beginPath(); ctx.rect(plotL, 0, sx - plotL, plotB); ctx.clip(); paint(false); ctx.restore()
        ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, plotR - sx, plotB); ctx.clip(); paint(true); ctx.restore()
      } else {
        paint(false)
      }
      ctx.restore()
    }
    const prev = prevPointsRef.current
    if (prev) drawSeries(prev, prevAccentRef.current, 1 - fade)
    const pts = pointsRef.current
    const otherList = propsRef.current.others ?? []
    for (const o of otherList) drawSeries(o.points, o.color, fade)
    const zones = propsRef.current.zoneColors
    // Farbe eines Werts: im Bereich `inside`, sonst `outside` — ohne Bereich die Linienfarbe.
    // Mit steps gelten die Grenzen zum Zeitpunkt des Punkts.
    const colorOf = (level: number, ts?: number) => {
      if (!zones) return color
      const lim = zones.steps?.length && ts != null ? limitsAt(zones.steps, ts) : zones
      if (!lim || (lim.lo == null && lim.hi == null && zones.steps?.length)) return zones.neutral ?? color
      return (lim.lo != null && level < lim.lo) || (lim.hi != null && level > lim.hi) ? zones.outside : zones.inside
    }
    if (zones) {
      // In senkrechten Streifen gezeichnet, getrennt dort, wo die Linie eine
      // Grenze kreuzt: Linie und Schleier darunter haben dieselbe Farbe.
      const slice = visibleSlice(pts, view.start, view.end)
      const runs = zones.steps?.length
        ? zoneRunsStepped(slice, zones.steps)
        : zoneRuns(slice, zones.lo, zones.hi).map(r => ({ from: r.from, to: r.to, zone: r.inside ? 'inside' as const : 'outside' as const }))
      for (const run of runs) {
        const x1 = Number.isFinite(run.from) ? xOf(run.from) : plotL
        const x2 = Number.isFinite(run.to) ? xOf(run.to) : plotR
        const c = run.zone === 'inside' ? zones.inside : run.zone === 'outside' ? zones.outside : (zones.neutral ?? color)
        drawSeries(pts, c, fade, [x1, x2])
      }
    } else {
      drawSeries(pts, color, fade)
    }

    // Messpunkte
    if (showDots && reveal >= 1) {
      for (const [list, base] of [...otherList.map(o => [o.points, o.color] as const), [pts, null] as const]) {
        for (const p of visibleSlice(list, view.start, view.end)) {
          if (p.ts < view.start || p.ts > view.end) continue
          const x = xOf(p.ts)
          const y = yOf(p.level)
          const c = base ?? colorOf(p.level, p.ts)
          ctx.fillStyle = surface
          ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = scrubTs != null && p.ts > scrubTs ? hexAlpha(c, 0.45) : c
          ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    // Einnahmezeitpunkte als Ring auf der Kurve
    if (sichtbareEinnahmen.length <= MAX_EINNAHME_LINIEN && reveal >= 1 && !otherList.length) {
      for (const ts of sichtbareEinnahmen) {
        const lv = levelAt(pts, ts)
        if (lv == null) continue
        const x = xOf(ts)
        const y = yOf(lv)
        ctx.fillStyle = surface
        ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = scrubTs != null && ts > scrubTs ? hexAlpha(color, 0.45) : color
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke()
      }
    }

    // Markierungen (manuelle Simulation)
    if (markerList.length && reveal >= 1) {
      ctx.font = `500 10px ${sans}`
      ctx.textBaseline = 'bottom'
      for (const m of markerList) {
        const lv = levelAt(pts, m.ts)
        if (lv == null || m.ts < view.start || m.ts > view.end) continue
        const x = xOf(m.ts)
        const y = yOf(lv)
        ctx.fillStyle = surface
        ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = m.color
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill()
        const w = ctx.measureText(m.label).width
        const lx = Math.min(Math.max(plotL, x - w / 2), plotR - w)
        ctx.fillStyle = muted
        ctx.fillText(m.label, lx, Math.max(plotT + 10, y - 8))
      }
    }

    // Live-Punkt am Ende
    // Live-Punkt am Kurvenende; das Pulsieren liegt als eigenes Element darueber
    // (CSS-Animation, laeuft ohne neues Zeichnen).
    let pulsAn = false
    if (showLive && scrubTs == null && reveal >= 1 && pts.length) {
      const last = pts[pts.length - 1]
      if (last.ts >= view.start && last.ts <= view.end + 60_000) {
        const x = xOf(last.ts)
        const y = yOf(last.level)
        ctx.fillStyle = hexAlpha(color, 0.25)
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = color
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill()
        const puls = pulseRef.current
        // Bei „Bewegung reduzieren“ kein Pulsieren (der Inline-Stil schluege die CSS-Klasse)
        if (puls && !reduced) {
          puls.style.transform = `translate(${x - 9}px, ${y - 9}px)`
          const ring = puls.firstElementChild as HTMLElement | null
          if (ring) ring.style.background = color
          pulsAn = true
        }
      }
    }
    if (pulseRef.current) pulseRef.current.style.display = pulsAn ? 'block' : 'none'

    // Ablese-Linie
    if (scrubTs != null) {
      const lv = levelAt(pts, scrubTs)
      const x = Math.round(xOf(scrubTs)) + 0.5
      const scrubColor = lv != null ? colorOf(lv, scrubTs) : color
      ctx.strokeStyle = label ? scrubColor : muted
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, label ? LABEL_H : plotT - 4); ctx.lineTo(x, plotB + BELOW); ctx.stroke()
      if (label && otherList.length) {
        // Mehrere Linien: Datum, darunter je Linie Name und Wert in ihrer Farbe
        const parts = [{ name: propsRef.current.seriesName ?? '', v: lv, c: color }, ...otherList.map(o => ({ name: o.name, v: levelAt(o.points, scrubTs), c: o.color }))]
          .filter((part): part is { name: string; v: number; c: string } => part.v != null)
          .map(part => ({ text: `${part.name} ${label.value(part.v)}`.trim(), c: part.c }))
        ctx.textBaseline = 'alphabetic'
        ctx.font = `400 13px ${sans}`
        const dateText = label.date(scrubTs)
        const wDate = ctx.measureText(dateText).width
        ctx.font = `500 13px ${sans}`
        const gap = 10
        const widths = parts.map(part => ctx.measureText(part.text).width)
        const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, parts.length - 1)
        const half = Math.max(wDate, total) / 2
        const cx = Math.min(Math.max(x, plotL + half), width - half)
        ctx.textAlign = 'center'
        ctx.fillStyle = cssVar(canvas, '--text', '#e2e8f0')
        ctx.font = `400 13px ${sans}`
        ctx.fillText(dateText, cx, 14)
        ctx.textAlign = 'left'
        ctx.font = `500 13px ${sans}`
        let left = cx - total / 2
        parts.forEach((part, i) => {
          ctx.fillStyle = part.c
          ctx.fillText(part.text, left, 33)
          left += widths[i] + gap
        })
      } else if (label && lv != null) {
        // Schild: Datum, darunter der Wert — mittig ueber der Linie, am Rand angeschlagen.
        const dateText = label.date(scrubTs)
        const valueText = label.value(lv)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.font = `400 13px ${sans}`
        const wDate = ctx.measureText(dateText).width
        ctx.font = `500 16px ${sans}`
        const wValue = ctx.measureText(valueText).width
        const half = Math.max(wDate, wValue) / 2
        const cx = Math.min(Math.max(x, plotL + half), width - half)
        ctx.fillStyle = cssVar(canvas, '--text', '#e2e8f0')
        ctx.font = `400 13px ${sans}`
        ctx.fillText(dateText, cx, 14)
        const note = label.note?.(scrubTs) ?? null
        ctx.font = `500 16px ${sans}`
        if (note) {
          // Wert in Linienfarbe, Zusatz gedaempft dahinter — zusammen mittig
          ctx.font = `400 13px ${sans}`
          // Passt der Zusatz nicht neben den Wert, wird er mit „…" gekuerzt.
          const platz = width - plotL - wValue - 6
          let noteText = `  ${note}`
          if (ctx.measureText(noteText).width > platz) {
            let n = note.length
            while (n > 1 && ctx.measureText(`  ${note.slice(0, n)}…`).width > platz) n--
            noteText = `  ${note.slice(0, n).trimEnd()}…`
          }
          const wNote = ctx.measureText(noteText).width
          const total = wValue + wNote
          const left = Math.min(Math.max(x - total / 2, plotL), width - total)
          ctx.textAlign = 'left'
          ctx.font = `500 16px ${sans}`
          ctx.fillStyle = scrubColor
          ctx.fillText(valueText, left, 33)
          ctx.font = `400 13px ${sans}`
          ctx.fillStyle = muted
          ctx.fillText(noteText, left + wValue, 33)
        } else {
          ctx.fillStyle = scrubColor
          ctx.fillText(valueText, cx, 33)
        }
      }
      for (const [v, c] of [...otherList.map(o => [levelAt(o.points, scrubTs), o.color] as const), [lv, scrubColor] as const]) {
        if (v == null) continue
        const y = yOf(v)
        ctx.fillStyle = surface
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = c
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill()
      }
    }

    if (animating) rafRef.current = requestAnimationFrame(t => drawRef.current(t))
  }, [])
  useLayoutEffect(() => { drawRef.current = draw }, [draw])

  const schedule = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(draw)
  }, [draw])

  // ── Props → Ziel-Ansicht ─────────────────────────────────────────────────
  // Als Text, damit ein neues Array mit gleichen Werten keine Animation ausloest.
  const yIncludeKey = (yInclude ?? []).filter(Number.isFinite).join('|')
  useEffect(() => {
    const domain = yDomainFor(points, start, end, { include: yIncludeKey ? yIncludeKey.split('|').map(Number) : [], percentCap, minSpan, targetTicks: yTicks })
    const nextTarget: View = { start, end, lo: domain.lo, hi: domain.hi }
    domainTicks.set(nextTarget, domain)
    const now = performance.now()
    const seriesChanged = seriesKeyRef.current !== seriesKey
    if (targetViewRef.current && viewRef.current) {
      // Beim Wischen folgt die Zeit dem Finger; nur die Y-Achse gleitet nach.
      fromViewRef.current = panningRef.current
        ? { ...viewRef.current, start, end }
        : { ...viewRef.current }
      animStartRef.current = now
    } else {
      revealStartRef.current = now
    }
    if (seriesChanged && pointsRef.current.length) {
      prevPointsRef.current = pointsRef.current
      prevAccentRef.current = currentAccentRef.current
      fadeStartRef.current = now
    }
    currentAccentRef.current = accent
    seriesKeyRef.current = seriesKey
    pointsRef.current = points
    targetViewRef.current = nextTarget
    schedule()
  }, [points, start, end, seriesKey, accent, schedule, yIncludeKey, percentCap, minSpan, yTicks])

  useEffect(() => { schedule() }, [intakes, markers, height, liveEnd, formatTick, formatValue, xTicks, axisWidth, seriesName, snapTimes, scrubLabel, band, dots, intakeStrip, lanes, others, xBands, xLines, xAxis, syncTs, zoneColors, schedule])
  useThemeRedraw(schedule)

  // Breite
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w !== widthRef.current) {
        widthRef.current = w
        schedule()
      }
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [schedule])

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    if (panFrameRef.current != null) cancelAnimationFrame(panFrameRef.current)
  }, [])

  // ── Ablesen ──────────────────────────────────────────────────────────────
  const gesture = useRef<{ id: number; x: number; y: number; scrubbing: boolean; hold: number | null } | null>(null)

  const scrubAt = useCallback((clientX: number) => {
    const canvas = canvasRef.current
    const view = viewRef.current
    const pts = pointsRef.current
    if (!canvas || !view || !pts.length) return
    const rect = canvas.getBoundingClientRect()
    const axisW = propsRef.current.axisWidth
    const plotW = rect.width - 2 * axisW
    const frac = Math.min(1, Math.max(0, (clientX - rect.left - axisW) / plotW))
    // Ablesbar ist, was eine der Linien abdeckt — nicht nur die Hauptlinie.
    const otherList = propsRef.current.others ?? []
    const first = Math.min(pts[0].ts, ...otherList.filter(o => o.points.length).map(o => o.points[0].ts))
    const last = Math.max(pts[pts.length - 1].ts, ...otherList.filter(o => o.points.length).map(o => o.points[o.points.length - 1].ts))
    let ts = view.start + frac * (view.end - view.start)
    ts = Math.min(Math.max(ts, Math.max(first, view.start)), Math.min(last, view.end))
    // auf den naechsten Datenpunkt einrasten (15-min-Raster) — oder auf einen
    // naeheren Zusatzpunkt wie einen Zyklus-Start oder einen Wert einer anderen Linie
    const i = indexAtOrBefore(pts, ts)
    const a = pts[Math.max(0, i)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    let snap = Math.abs(ts - a.ts) <= Math.abs(b.ts - ts) ? a : b
    for (const extra of propsRef.current.snapTimes ?? []) {
      if (extra < first || extra > last || Math.abs(extra - ts) >= Math.abs(snap.ts - ts)) continue
      const lv = levelAt(pts, extra) ?? otherList.map(o => levelAt(o.points, extra)).find(v => v != null)
      if (lv != null) snap = { ts: extra, level: lv }
    }
    if (scrubTsRef.current === snap.ts) return
    scrubTsRef.current = snap.ts
    const bucket = Math.floor(snap.ts / timeStep(view.start, view.end, plotW))
    if (lastHapticBucketRef.current != null && bucket !== lastHapticBucketRef.current) void hapticTick()
    lastHapticBucketRef.current = bucket
    onScrubRef.current?.(snap)
    schedule()
  }, [schedule])

  const endScrub = useCallback(() => {
    const g = gesture.current
    if (g?.hold != null) window.clearTimeout(g.hold)
    gesture.current = null
    if (scrubTsRef.current == null) return
    scrubTsRef.current = null
    lastHapticBucketRef.current = null
    onScrubRef.current?.(null)
    schedule()
  }, [schedule])

  // Wischen: Fenster verschieben, Finger rechts → Vergangenheit.
  const panState = useRef<{ x: number; end: number; span: number; plotW: number; bucket: number } | null>(null)
  const startPan = (clientX: number) => {
    const view = targetViewRef.current
    const canvas = canvasRef.current
    if (!view || !canvas) return
    const plotW = canvas.getBoundingClientRect().width - 2 * propsRef.current.axisWidth
    const span = view.end - view.start
    panState.current = { x: clientX, end: view.end, span, plotW, bucket: Math.floor(view.end / timeStep(view.start, view.end, plotW)) }
    panningRef.current = true
  }
  const panTo = (clientX: number) => {
    const ps = panState.current
    const p = panRef.current
    if (!ps || !p || ps.plotW <= 0) return
    const shifted = ps.end - ((clientX - ps.x) / ps.plotW) * ps.span
    const next = Math.min(p.max, Math.max(Math.min(p.max, p.min + ps.span), shifted))
    const bucket = Math.floor(next / timeStep(next - ps.span, next, ps.plotW))
    if (bucket !== ps.bucket) { ps.bucket = bucket; void hapticTick() }
    // Hoechstens ein Zustandswechsel je Bild — sonst rendert der Eltern-Graph bei jedem Zeigerereignis.
    pendingPanRef.current = next
    if (panFrameRef.current == null) {
      panFrameRef.current = requestAnimationFrame(() => {
        panFrameRef.current = null
        const end = pendingPanRef.current
        pendingPanRef.current = null
        if (end != null) panRef.current?.onPan(end)
      })
    }
  }
  const endPan = () => {
    if (panFrameRef.current != null) {
      cancelAnimationFrame(panFrameRef.current)
      panFrameRef.current = null
      if (pendingPanRef.current != null) panRef.current?.onPan(pendingPanRef.current)
      pendingPanRef.current = null
    }
    panState.current = null
    // Erst nach dem letzten Bild zuruecksetzen, sonst gleitet der letzte Schritt nach.
    requestAnimationFrame(() => { if (!panState.current) panningRef.current = false })
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointsRef.current.length) return
    // Ein zweiter Finger aendert nichts an der laufenden Geste.
    if (gesture.current && gesture.current.id !== e.pointerId) return
    const canPan = !!panRef.current
    // Ohne Wischen liest die Maus beim Druecken ab; mit Wischen liest sie beim Ueberfahren.
    const startScrub = e.pointerType === 'mouse' && !canPan
    if (e.pointerType === 'mouse' && canPan) {
      if (scrubTsRef.current != null) { scrubTsRef.current = null; onScrubRef.current?.(null); schedule() }
      gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, scrubbing: false, hold: null }
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      startPan(e.clientX)
      return
    }
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, scrubbing: startScrub, hold: null }
    if (startScrub) {
      scrubAt(e.clientX)
      return
    }
    const x = e.clientX
    gesture.current.hold = window.setTimeout(() => {
      const g = gesture.current
      if (!g || g.scrubbing || panState.current) return
      g.scrubbing = true
      try { canvasRef.current?.setPointerCapture(g.id) } catch { /* ignore */ }
      void hapticTick()
      scrubAt(x)
    }, holdMs)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) {
      // Maus ohne Druck ueber einem wischbaren Graph: ablesen
      if (!g && e.pointerType === 'mouse' && panRef.current && e.buttons === 0) scrubAt(e.clientX)
      return
    }
    if (panState.current) { panTo(e.clientX); return }
    if (!g.scrubbing) {
      const dx = Math.abs(e.clientX - g.x)
      const dy = Math.abs(e.clientY - g.y)
      if (dy > DRAG_START_PX && dy > dx) { endScrub(); return }
      if (dx < DRAG_START_PX) return
      if (g.hold != null) window.clearTimeout(g.hold)
      g.hold = null
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      if (panRef.current) { startPan(g.x); panTo(e.clientX); return }
      g.scrubbing = true
    }
    scrubAt(e.clientX)
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gesture.current && gesture.current.id !== e.pointerId) return
    endPan()
    endScrub()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const pts = pointsRef.current
    const view = viewRef.current
    if (!pts.length || !view) return
    if (e.key === 'Escape') { endScrub(); return }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    // Im sichtbaren Fenster bleiben — auch nach dem Zurueckwischen
    const lo = Math.max(view.start, pts[0].ts)
    const hi = Math.min(view.end, pts[pts.length - 1].ts)
    if (hi < lo) return
    const current = scrubTsRef.current ?? hi
    const stepMs = (view.end - view.start) / 48
    const next = Math.min(Math.max(current + (e.key === 'ArrowLeft' ? -stepMs : stepMs), lo), hi)
    const lv = levelAt(pts, next)
    if (lv == null) return
    scrubTsRef.current = next
    onScrubRef.current?.({ ts: next, level: lv })
    schedule()
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={e => { if (e.pointerType === 'mouse' && !panState.current) endScrub() }}
        onKeyDown={onKeyDown}
        onBlur={() => { endPan(); endScrub() }}
        onContextMenu={e => e.preventDefault()}
        style={{
          display: 'block', width: '100%', height,
          touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none', outline: 'none', cursor: 'crosshair',
        }}
      />
      {/* Aussen die Position (per transform aus dem Zeichnen), innen das Pulsieren —
          getrennt, weil die Ping-Animation selbst transform setzt. */}
      <span
        ref={pulseRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-[18px] w-[18px] motion-reduce:hidden"
        style={{ display: 'none' }}
        data-chart-live-pulse
      >
        <span className="absolute inset-0 animate-ping rounded-full opacity-40" />
      </span>
      {pan && end < pan.max - 1000 && (
        <button
          type="button"
          onClick={() => pan.onPan(pan.max)}
          data-chart-jump-now
          className="absolute bottom-7 right-1 min-h-8 rounded-lg px-3 text-xs font-medium"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          {pan.jumpLabel}
        </button>
      )}
    </div>
  )
})

// Ticks gehoeren zur Ziel-Ansicht; beim Gleiten wandern dieselben Linien mit.
const domainTicks = new WeakMap<View, YDomain>()
function targetDomainTicks(view: View): number[] {
  return domainTicks.get(view)?.ticks ?? []
}

/** '#rrggbb' + Deckkraft → rgba(). Andere Farbangaben bleiben, wie sie sind. */
function hexAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
