import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { DotRenderer, drawSphere, orbPalette, qAxis, qMat, qMul } from '../lib/orbDraw'
import { type FoodOrbValues, macroMix } from '../lib/foodOrb'
import { usePrefersReducedMotion } from '../lib/orbZone'

/** Lage wie die Tageskugel: leicht von oben, `yaw` dreht um die senkrechte Achse. */
const view = (yaw: number) => qMat(qMul(qAxis(1, 0, 0, 0.22), qAxis(0, 1, 0, 0.6 + yaw)))
/** Eigendrehung in rad/s — das ruhige Grundtempo der Tageskugel. */
const SPIN = 0.16

export interface FoodOrbHandle {
  /** Die Punkte verlassen die Kugel von oben nach unten (Flug in die Tageskugel), danach füllt sie sich wieder. */
  pour: (leaveMs: number, backAfterMs: number) => void
  /** Mitte und Radius der gezeichneten Kugel in Bildschirm-Pixeln — Startpunkt der Flüge. */
  origin: () => { x: number; y: number; r: number } | null
}

/**
 * Kugel eines Essens: 1 Punkt = 1 kcal, gleiche Punktdichte wie die Tageskugel —
 * der Radius wächst mit √kcal, ein ganzer Tag (`goalKcal`) füllt `fullFrac` der
 * Fläche. Farben gemischt nach Makro-Anteil. Canvas 2D; in Listen still (dort sind
 * es viele), mit `spin` dreht sie sich wie die Tageskugel (Portion). Rein grafisch;
 * Zahlen stehen daneben.
 */
export const FoodOrb = forwardRef<FoodOrbHandle, { values: FoodOrbValues; goalKcal: number; size: number; fullFrac?: number; spin?: boolean }>(
  function FoodOrb({ values, goalKcal, size, fullFrac = 0.46, spin = false }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const keep = useRef(1)
    const raf = useRef(0)
    const reduce = usePrefersReducedMotion()
    const turning = spin && !reduce
    /** Drehwinkel und Zeit des letzten Bildes; Ausgießen: Start und Dauern. */
    const anim = useRef<{ yaw: number; last: number; pour: { t0: number; leave: number; back: number } | null; turning: boolean; reduce: boolean }>({ yaw: 0, last: 0, pour: null, turning, reduce })
    anim.current.turning = turning
    anim.current.reduce = reduce
    const geo = useRef<{ R: number; n: number } | null>(null)
    const renderer = useRef<DotRenderer | null>(null)
    const { kcal, protein, carbs, fat } = values

    const draw = useRef<() => void>(() => {})
    useEffect(() => {
      draw.current = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
        const W = Math.round(size * dpr)
        if (canvas.width !== W) { canvas.width = W; canvas.height = W }
        // Ein Zeichner je Kugel (Canvas 2D), nicht je Bild — beim Ausgießen wird 60-mal je Sekunde gezeichnet.
        if (!renderer.current) {
          renderer.current = new DotRenderer(canvas, { webgl: false })
          renderer.current.setPalette(orbPalette(canvas.parentElement ?? document.documentElement))
        }
        const r = renderer.current
        if (!r.mode) return
        const full = Math.max(1, Math.min(goalKcal || 2000, 4000))
        const R = Math.min(W * 0.46, W * fullFrac * Math.sqrt(Math.max(0, kcal) / full))
        // Kleine Kugeln zeichnen weniger Punkte: gleiches Bild, weniger Arbeit.
        const n = Math.max(12, Math.min(1500, Math.round(kcal), Math.round(4 * R * R / (dpr * dpr) * 1.4)))
        geo.current = { R: R / dpr, n }
        const left = Math.round(n * keep.current)
        const M = view(anim.current.yaw)
        r.begin()
        if (kcal > 0) {
          drawSphere(r, n, { filled: left, extra: 0 }, {
            M, HM: M, cx: W / 2, cy: W / 2, R: Math.max(2 * dpr, R),
            px: Math.max(1.6, Math.min(4.4, R / dpr / 5)) * dpr, color: 1, mix: macroMix(values),
            now: anim.current.last, live: anim.current.turning,
          })
        }
        r.end()
      }
    })
    useEffect(() => { draw.current() }, [kcal, protein, carbs, fat, goalKcal, size, fullFrac])

    /** Eine Schleife für Drehen und Ausgießen; sie läuft nur, solange eins von beiden ansteht. */
    const loop = useRef<(ts: number) => void>(() => {})
    loop.current = (ts: number) => {
      const a = anim.current
      const dt = a.last ? Math.min(0.1, (ts - a.last) / 1000) : 0
      a.last = ts
      if (a.turning) a.yaw += dt * SPIN
      if (a.pour) {
        const t = performance.now() - a.pour.t0
        // Erst leeren (Punkte gehen von oben), am Ende weich wieder füllen.
        if (t < a.pour.leave) keep.current = 1 - t / a.pour.leave
        else if (t < a.pour.back) keep.current = 0
        else { const u = Math.min(1, (t - a.pour.back) / 380); keep.current = u * u * (3 - 2 * u) }
        if (t >= a.pour.back + 380) { keep.current = 1; a.pour = null }
      }
      draw.current()
      raf.current = a.turning || a.pour ? requestAnimationFrame(t2 => loop.current(t2)) : 0
    }
    const run = () => {
      if (raf.current) return
      anim.current.last = 0
      raf.current = requestAnimationFrame(t => loop.current(t))
    }
    useEffect(() => {
      if (turning) run()
    }, [turning])
    useEffect(() => () => { cancelAnimationFrame(raf.current); raf.current = 0; renderer.current?.destroy(); renderer.current = null }, [])

    useImperativeHandle(ref, () => ({
      origin: () => {
        const c = canvasRef.current
        if (!c || !geo.current) return null
        const b = c.getBoundingClientRect()
        return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: geo.current.R }
      },
      pour: (leaveMs, backAfterMs) => {
        // „Bewegung reduzieren“: nichts fließt, die Kugel bleibt voll.
        if (anim.current.reduce) {
          keep.current = 1
          draw.current()
          return
        }
        anim.current.pour = { t0: performance.now(), leave: leaveMs, back: backAfterMs }
        run()
      },
    }), [])

    return <canvas ref={canvasRef} aria-hidden="true" className="block shrink-0" style={{ width: size, height: size }} />
  },
)
