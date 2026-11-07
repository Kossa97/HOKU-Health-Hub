/**
 * Die Flüssigkeit im Fläschchen als Zeichenfläche statt als SVG (Nutzer
 * 07.11.2026: „über WebGL laufen lassen").
 *
 * Gemessen am iPhone: Solange die SVG-Flüssigkeit sich bewegte, malte Safari
 * die ganze Grafik in jedem Bild neu (Pfade, acht Verläufe, Beschnitt) und Hoku
 * fiel auf 66 Bilder/s; stand sie, liefen 120. Die Zeichenfläche zeichnet
 * dieselben Formen mit denselben Verläufen direkt auf die Grafikkarte, ohne
 * dass Safari eine Grafik neu aufbauen muss. Canvas statt WebGL, weil so jede
 * Fläche und jeder Verlauf genau wie im SVG bleibt und ein iPhone nur wenige
 * WebGL-Flächen gleichzeitig erlaubt (Hoku braucht schon eine).
 *
 * Geometrie (liquidGeometry), Maschine (sloshEngine), Sichtbarkeit, Füllstand
 * und Bühnenlicht arbeiten wie in LiquidGraphic; nur das Zeichnen ist neu.
 */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import type { Ref } from 'react'
import { buildLiquid, LIQUID_VB_H, LIQUID_VB_W, type LiquidGeometry } from './liquidGeometry'
import { useSloshSubscribe } from '../../../components/SloshContext'
import { REST_ENERGY, type SloshState } from '../../../components/sloshEngine'
import type { LiquidGraphicHandle } from './LiquidGraphic'
import { LIQUID_BUBBLES, blaseZu } from './liquidBubbles'

/** Wie LiquidGraphic: Ruhewellen unter einem halben Bildpunkt zeichnet ein kleines Vial nicht nach */
const RUHEWELLE_EINHEITEN = 2.3
const RUHEWELLE_MIN_PX = 0.5
const LAGE_PRUEFEN_ALLE_S = 0.3
/** Auflösung: die Flüssigkeit ist weich, mehr als doppelt bringt nichts */
const MAX_DPR = 2

function easeOutCubic(v: number): number {
  return 1 - Math.pow(1 - v, 3)
}
function levelChangeDurationMs(from: number, to: number): number {
  return Math.round(600 + Math.abs(to - from) * 2200)
}

type Stop = readonly [number, string]
const DEPTH: readonly Stop[] = [[0, 'rgba(255,255,255,0.26)'], [0.18, 'rgba(255,255,255,0.05)'], [1, 'rgba(0,0,0,0.58)']]
const SIDE: readonly Stop[] = [[0, 'rgba(255,255,255,0.18)'], [0.3, 'rgba(255,255,255,0)'], [0.72, 'rgba(0,0,0,0.05)'], [1, 'rgba(0,0,0,0.3)']]
const GLOW: readonly Stop[] = [[0, 'rgba(255,255,255,0.58)'], [0.55, 'rgba(255,255,255,0.14)'], [1, 'rgba(255,255,255,0)']]
const REFRACT: readonly Stop[] = [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]
const SURFACE: readonly Stop[] = [[0, 'rgba(255,255,255,0.58)'], [1, 'rgba(255,255,255,0.05)']]
const CAUSTIC: readonly Stop[] = [[0, 'rgba(255,255,255,0.32)'], [0.55, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]
const FLOOR: readonly Stop[] = [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]
const SPEC: readonly Stop[] = [[0, 'rgba(255,255,255,0.95)'], [0.55, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]

function linear(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: readonly Stop[]) {
  const g = c.createLinearGradient(x0, y0, x1, y1)
  for (const [o, f] of stops) g.addColorStop(o, f)
  return g
}

/** Ellipse mit radialem Verlauf von der Mitte zum Rand (wie SVG radialGradient im Umriss der Ellipse) */
function ellipseVerlauf(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, stops: readonly Stop[], alpha: number) {
  if (rx <= 0 || ry <= 0 || alpha <= 0) return
  c.save()
  c.translate(cx, cy); c.scale(rx, ry)
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1)
  for (const [o, f] of stops) g.addColorStop(o, f)
  c.globalAlpha = alpha
  c.fillStyle = g
  c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill()
  c.restore()
}

export interface LiquidCanvasProps {
  fill: number
  tilt?: number
  chamberAspect?: number
  /** Größe des umgebenden Glases (viewBox, preserveAspectRatio none) */
  vbW: number
  vbH: number
  /** Kammer im Glas: dort liegt die Flüssigkeit (viewBox des Glases) */
  x: number
  y: number
  width: number
  height: number
  /** Innenkontur des Glases (Pfad im viewBox des Glases): beschneidet die Flüssigkeit */
  clipPath: string
  color: string
  bubbles?: boolean
  reducedMotion?: boolean
  seedFocus?: number
  seedLightOffset?: number
  handleRef?: Ref<LiquidGraphicHandle>
  className?: string
}

export function LiquidCanvas({
  fill, tilt = 0, chamberAspect, vbW, vbH, x, y, width, height, clipPath, color,
  bubbles = true, reducedMotion = false, seedFocus = 1, seedLightOffset = 0, handleRef, className = '',
}: LiquidCanvasProps) {
  const subscribe = useSloshSubscribe()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef({ focus: seedFocus, lightOffset: seedLightOffset })
  const visibleRef = useRef(typeof IntersectionObserver === 'undefined')
  const lastStateRef = useRef<SloshState>({ tilt, energy: 0, time: 0 })
  const lageGeprueftRef = useRef(-Infinity)
  const ruhewelleSichtbarRef = useRef(true)
  const ruhendGezeichnetRef = useRef(false)
  const previousFillRef = useRef(fill)
  const fillTweenRef = useRef<{ from: number; to: number; start: number; duration: number } | null>(null)
  const pfadRef = useRef<Path2D | null>(null)
  // Bildpunkte der Zeichenfläche je gezeigtem Bildpunkt (für die feste Breite der Wasserlinie)
  const pxJeCssRef = useRef(1)

  /** Zeichenfläche an die gezeigte Größe anpassen (auch unter transform: scale der Bühne) */
  const passeAn = useCallback((): boolean => {
    const cv = canvasRef.current
    if (!cv) return false
    const r = cv.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr))
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; ruhendGezeichnetRef.current = false }
    pxJeCssRef.current = w / r.width
    return true
  }, [])

  const zeichne = useCallback((s: SloshState) => {
    const cv = canvasRef.current
    const c = cv?.getContext('2d')
    if (!cv || !c) return
    let animatedFill = fill
    const tween = fillTweenRef.current
    if (tween) {
      const p = Math.max(0, (performance.now() - tween.start) / tween.duration)
      if (p >= 1) fillTweenRef.current = null
      else animatedFill = tween.from + (tween.to - tween.from) * easeOutCubic(p)
    }
    const g: LiquidGeometry = buildLiquid({ fill: animatedFill, tilt: s.tilt, energy: s.energy, time: s.time, chamberAspect })
    const { focus, lightOffset } = stageRef.current
    const W = cv.width, H = cv.height
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, W, H)
    // Glas-Koordinaten, dann die Kammer: wie die verschachtelten SVG (preserveAspectRatio none)
    const glas = new DOMMatrix().scale(W / vbW, H / vbH)
    const kammer = glas.translate(x, y).scale(width / LIQUID_VB_W, height / LIQUID_VB_H)
    c.save()
    c.setTransform(glas)
    if (!pfadRef.current) pfadRef.current = new Path2D(clipPath)
    c.clip(pfadRef.current)
    c.setTransform(kammer)

    const body = new Path2D(g.body)
    // Körper in der Farbe, Deckkraft 0,8
    c.globalAlpha = 0.8
    c.fillStyle = color
    c.fill(body)
    c.globalAlpha = 1

    // Alles Folgende liegt im Körper (SVG: clipPath aus dem Körperpfad)
    c.save()
    c.clip(body)
    c.fillStyle = linear(c, 0, g.bodyTop, 0, LIQUID_VB_H, DEPTH); c.fill(body)
    c.fillStyle = linear(c, 0, 0, LIQUID_VB_W, 0, SIDE); c.fill(body)
    // Boden: radialer Verlauf, Mitte unten, 70 % der Fläche (Umriss 120 × 34)
    c.save()
    c.beginPath(); c.rect(0, LIQUID_VB_H - 34, LIQUID_VB_W, 34); c.clip()
    ellipseVerlauf(c, LIQUID_VB_W / 2, LIQUID_VB_H, LIQUID_VB_W * 0.7, 34 * 0.7, FLOOR, 1)
    c.restore()
    const f01 = Math.max(0, Math.min(1, fill))
    ellipseVerlauf(c, LIQUID_VB_W / 2, LIQUID_VB_H - 13, 32 + 10 * f01, 10 + 3 * f01, CAUSTIC, 1)
    // Lichtbrechung links und rechts, folgt dem Bühnenlicht
    const rl = 5 + lightOffset * 8, rr = 99 + lightOffset * 5
    c.globalAlpha = 0.46 + focus * 0.22
    c.fillStyle = linear(c, rl, 0, rl + 16, 0, REFRACT); c.fillRect(rl, 0, 16, LIQUID_VB_H)
    c.globalAlpha = 0.14 + focus * 0.16
    c.fillStyle = linear(c, rr, 0, rr + 10, 0, REFRACT); c.fillRect(rr, 0, 10, LIQUID_VB_H)
    c.globalAlpha = 1
    c.fillStyle = linear(c, 0, g.bodyTop, 0, g.glowBottom, GLOW); c.fill(new Path2D(g.glow))
    if (bubbles && !reducedMotion) {
      for (const b of LIQUID_BUBBLES) {
        const z = blaseZu(b, s.time)
        if (z.deckkraft <= 0) continue
        c.globalAlpha = z.deckkraft
        c.fillStyle = 'rgba(255,255,255,0.55)'
        c.beginPath(); c.arc(b.cx, z.y, b.r, 0, Math.PI * 2); c.fill()
      }
      c.globalAlpha = 1
    }
    c.restore()

    // Oberflächenband, Glanz an den Wänden und auf der Oberfläche (nicht im Körper beschnitten)
    c.globalAlpha = 0.4 + focus * 0.14
    c.fillStyle = linear(c, 0, g.surfaceTop, 0, g.surfaceBottom, SURFACE); c.fill(new Path2D(g.surface))
    ellipseVerlauf(c, 4, g.leftWallY, 4.5, 8, SPEC, 0.5)
    ellipseVerlauf(c, LIQUID_VB_W - 4, g.rightWallY, 4.5, 8, SPEC, 0.5)
    const hx = g.highlightX + lightOffset * 10
    ellipseVerlauf(c, hx, g.highlightY, 24, 4.2, SPEC, 0.12 + focus * 0.12 + s.energy * 0.5)
    ellipseVerlauf(c, hx, g.highlightY, 8, 2.8, SPEC, 0.08 + focus * 0.16 + s.energy * 0.6)

    // Wasserlinie: 1,4 px breit, unabhängig von der Größe (SVG: non-scaling-stroke)
    const rim = new Path2D()
    rim.addPath(new Path2D(g.rim), kammer)
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.strokeStyle = 'rgba(255,255,255,0.66)'
    c.lineWidth = 1.4 * pxJeCssRef.current
    c.lineCap = 'round'
    c.stroke(rim)
    c.restore()
  }, [fill, chamberAspect, vbW, vbH, x, y, width, height, clipPath, color, bubbles, reducedMotion])

  const draw = useCallback((s: SloshState) => {
    lastStateRef.current = s
    if (typeof IntersectionObserver !== 'undefined' && s.time - lageGeprueftRef.current >= LAGE_PRUEFEN_ALLE_S) {
      lageGeprueftRef.current = s.time
      const r = canvasRef.current?.getBoundingClientRect() ?? null
      const sichtbar = !!r && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight
      const hoehe = r?.height ?? 0
      ruhewelleSichtbarRef.current = hoehe === 0 || RUHEWELLE_EINHEITEN * (hoehe * (height / vbH) / LIQUID_VB_H) >= RUHEWELLE_MIN_PX
      visibleRef.current = sichtbar
      if (sichtbar) passeAn()
    }
    if (!visibleRef.current) return false
    const ruhig = s.energy < REST_ENERGY && fillTweenRef.current === null
    if (ruhig && !ruhewelleSichtbarRef.current && ruhendGezeichnetRef.current) return false
    ruhendGezeichnetRef.current = ruhig
    zeichne(s)
    return fillTweenRef.current !== null
  }, [zeichne, passeAn, height, vbH])

  // Neu gebaut (Füllstand, Farbe, Größe): sofort einmal ganz zeichnen
  useLayoutEffect(() => {
    pfadRef.current = null
    if (passeAn()) zeichne(lastStateRef.current)
  }, [zeichne, passeAn])

  useEffect(() => {
    if (!subscribe) return
    ruhendGezeichnetRef.current = false
    return subscribe(draw)
  }, [subscribe, draw])

  // Sichtbarkeit wie in LiquidGraphic; wer hereinrollt, zeichnet sich sofort
  const drawRef = useRef(draw)
  useEffect(() => { drawRef.current = draw }, [draw])
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => {
      const sichtbar = entries[entries.length - 1]?.isIntersecting ?? true
      const war = visibleRef.current
      visibleRef.current = sichtbar
      if (sichtbar && !war) { passeAn(); ruhendGezeichnetRef.current = false; drawRef.current(lastStateRef.current) }
    })
    observer.observe(cv)
    return () => observer.disconnect()
  }, [passeAn])

  // Größe ändert sich (Drehen, Bühne): neu anpassen und zeichnen
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { if (passeAn()) zeichne(lastStateRef.current) })
    ro.observe(cv)
    return () => ro.disconnect()
  }, [passeAn, zeichne])

  useEffect(() => {
    const prev = previousFillRef.current
    if (Math.abs(prev - fill) < 0.001) return
    fillTweenRef.current = reducedMotion ? null : { from: prev, to: fill, start: performance.now(), duration: levelChangeDurationMs(prev, fill) }
    previousFillRef.current = fill
  }, [fill, reducedMotion])

  const applyStageLight = useCallback((focus: number, lightOffset: number) => {
    stageRef.current = { focus, lightOffset }
    ruhendGezeichnetRef.current = false
    // Ohne laufende Maschine (Ruhe, Vorschau) sofort nachzeichnen
    if (visibleRef.current) zeichne(lastStateRef.current)
  }, [zeichne])

  useImperativeHandle(handleRef, () => ({ applyStageLight }), [applyStageLight])

  return (
    <canvas
      ref={canvasRef}
      data-vial-detail="liquid-canvas"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`.trim()}
    />
  )
}
