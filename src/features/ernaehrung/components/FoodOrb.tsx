import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { DotRenderer, drawSphere, orbPalette, qAxis, qMat, qMul } from '../lib/orbDraw'
import { type FoodOrbValues, macroMix } from '../lib/foodOrb'

const VIEW = qMat(qMul(qAxis(1, 0, 0, 0.22), qAxis(0, 1, 0, 0.6)))

export interface FoodOrbHandle {
  /** Die Punkte verlassen die Kugel von oben nach unten (Flug in die Tageskugel), danach füllt sie sich wieder. */
  pour: (leaveMs: number, backAfterMs: number) => void
  /** Mitte und Radius der gezeichneten Kugel in Bildschirm-Pixeln — Startpunkt der Flüge. */
  origin: () => { x: number; y: number; r: number } | null
}

/**
 * Kugel eines Essens: 1 Punkt = 1 kcal, gleiche Punktdichte wie die Tageskugel —
 * der Radius wächst mit √kcal, ein ganzer Tag (`goalKcal`) füllt `fullFrac` der
 * Fläche. Farben gemischt nach Makro-Anteil. Canvas 2D und still: Listen haben
 * viele davon. Rein grafisch; Zahlen stehen daneben.
 */
export const FoodOrb = forwardRef<FoodOrbHandle, { values: FoodOrbValues; goalKcal: number; size: number; fullFrac?: number }>(
  function FoodOrb({ values, goalKcal, size, fullFrac = 0.46 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const keep = useRef(1)
    const raf = useRef(0)
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
        r.begin()
        if (kcal > 0) {
          drawSphere(r, n, { filled: left, extra: 0 }, {
            M: VIEW, HM: VIEW, cx: W / 2, cy: W / 2, R: Math.max(2 * dpr, R),
            px: Math.max(1.6, Math.min(4.4, R / dpr / 5)) * dpr, color: 1, mix: macroMix(values), now: 0, live: false,
          })
        }
        r.end()
      }
    })
    useEffect(() => { draw.current() }, [kcal, protein, carbs, fat, goalKcal, size, fullFrac])
    useEffect(() => () => { cancelAnimationFrame(raf.current); renderer.current?.destroy(); renderer.current = null }, [])

    useImperativeHandle(ref, () => ({
      origin: () => {
        const c = canvasRef.current
        if (!c || !geo.current) return null
        const b = c.getBoundingClientRect()
        return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: geo.current.R }
      },
      pour: (leaveMs, backAfterMs) => {
        cancelAnimationFrame(raf.current)
        // „Bewegung reduzieren“: nichts fließt, die Kugel bleibt voll.
        if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
          keep.current = 1
          draw.current()
          return
        }
        const t0 = performance.now()
        const step = () => {
          const t = performance.now() - t0
          // Erst leeren (Punkte gehen von oben), am Ende weich wieder füllen.
          if (t < leaveMs) keep.current = 1 - t / leaveMs
          else if (t < backAfterMs) keep.current = 0
          else { const u = Math.min(1, (t - backAfterMs) / 380); keep.current = u * u * (3 - 2 * u) }
          draw.current()
          if (t < backAfterMs + 380) raf.current = requestAnimationFrame(step)
          else keep.current = 1
        }
        raf.current = requestAnimationFrame(step)
      },
    }), [])

    return <canvas ref={canvasRef} aria-hidden="true" className="block shrink-0" style={{ width: size, height: size }} />
  },
)
