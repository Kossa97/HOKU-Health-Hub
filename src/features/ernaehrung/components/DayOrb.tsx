import { useEffect, useRef } from 'react'
import type { DayTotals } from '../lib/dayRings'
import type { Goals } from '../lib/nutrition'
import { fill } from '../lib/orb'
import { DotRenderer, drawSphere, orbPalette, qAxis, qMat, qMul } from '../lib/orbDraw'

const DOTS = 150
const VIEW = qMat(qMul(qAxis(1, 0, 0, 0.22), qAxis(0, 1, 0, 0.6)))

/**
 * Schlichte Mini-Kugel für den Kalender: nur Kalorien (ausgeblendet: Eiweiß),
 * still, ohne Hülle. Canvas 2D statt WebGL — ein Monat hätte sonst 30
 * WebGL-Kontexte, mehr als ein Browser erlaubt. Rein grafisch; die Werte
 * stehen im aria-label des Knopfes drumherum.
 */
export function DayOrb({ totals, goals, size, dim = false }: { totals: DayTotals; goals: Goals; size: number; dim?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const share = goals.hideKcal
    ? (goals.proteinG > 0 ? totals.protein / goals.proteinG : 0)
    : (goals.kcal > 0 ? totals.kcal / goals.kcal : 0)
  const { filled } = fill(DOTS, share)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
    const px = Math.round(size * dpr)
    canvas.width = px
    canvas.height = px
    const r = new DotRenderer(canvas, { webgl: false })
    if (!r.mode) return
    r.setPalette(orbPalette(canvas.parentElement ?? document.documentElement))
    r.begin()
    drawSphere(r, DOTS, { filled, extra: 0 }, {
      M: VIEW, HM: VIEW, cx: px / 2, cy: px / 2, R: px * 0.42, px: 2.3 * dpr * (size / 40),
      color: goals.hideKcal ? 2 : 1, now: 0, live: false, dim,
    })
    r.end()
  }, [filled, size, dim, goals.hideKcal])

  return <canvas ref={ref} aria-hidden="true" className="block" style={{ width: size, height: size }} />
}
