/**
 * Gestapelte Balken im Stil des StocksChart: Werte-Achse links, feines Raster,
 * Ablese-Schild oben (Titel, darunter die Werte in ihren Farben), Ablesen per
 * Ziehen oder Halten, Pfeiltasten, Haptik und ein Wachsen beim ersten Auftritt.
 * Fuer Kategorien statt Zeit (Wochen, Abstand nach der Einnahme).
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { hapticTick } from '../../../lib/haptics'
import { easeOutCubic, niceYDomain } from './stocksChartMath'
import { AXIS_WIDTH } from './StocksChart'
import { useThemeRedraw } from './useThemeRedraw'

export interface BarDatum {
  /** Beschriftung unter dem Balken. */
  label: string
  /** Langform im Ablese-Schild. */
  title: string
  /** Werte von unten nach oben gestapelt, in der Reihenfolge von `stacks`. */
  values: number[]
  /** Zusatz im Schild, z. B. Ø-Intensitaet. */
  note?: string | null
}

interface Props {
  data: BarDatum[]
  /** Je Stapel Name und Farbe (Hex oder CSS-Variable). */
  stacks: Array<{ name: string; color: string }>
  height: number
  ariaLabel: string
}

const AXIS_BOTTOM = 22
const LABEL_H = 40
const PAD_TOP = 10
const HOLD_MS = 180
const DRAG_START_PX = 6
const REVEAL_MS = 650
const FONT = 'ui-sans-serif, system-ui, -apple-system, sans-serif'

function resolveColor(el: Element, color: string): string {
  const m = /^var\((--[^),]+)/.exec(color.trim())
  if (!m) return color
  return getComputedStyle(el).getPropertyValue(m[1]).trim() || '#94a3b8'
}

export const StocksBars = memo(function StocksBars({ data, stacks, height, ariaLabel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const widthRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const revealStartRef = useRef<number | null>(null)
  const activeRef = useRef<number | null>(null)
  const propsRef = useRef({ data, stacks, height })
  useLayoutEffect(() => { propsRef.current = { data, stacks, height } })

  const drawRef = useRef<(now: number) => void>(() => {})
  const draw = useCallback((now: number) => {
    rafRef.current = null
    const canvas = canvasRef.current
    const width = widthRef.current
    if (!canvas || width <= 0) return
    const { data: rows, stacks: layers, height: h } = propsRef.current
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let reveal = 1
    if (revealStartRef.current != null && !reduced) {
      reveal = easeOutCubic(Math.min(1, (now - revealStartRef.current) / REVEAL_MS))
      if (reveal >= 1) revealStartRef.current = null
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

    const style = getComputedStyle(canvas)
    const muted = style.getPropertyValue('--text-muted').trim() || '#8a94a6'
    const text = style.getPropertyValue('--text').trim() || '#e2e8f0'
    const grid = 'rgba(148,163,184,0.16)'
    const colors = layers.map(layer => resolveColor(canvas, layer.color))

    const plotL = AXIS_WIDTH
    // Rechts derselbe Rand wie links: der Graph steht mittig.
    const plotR = width - AXIS_WIDTH
    const plotT = PAD_TOP + LABEL_H
    const plotB = h - AXIS_BOTTOM
    const max = Math.max(1, ...rows.map(row => row.values.reduce((sum, v) => sum + v, 0)))
    const domain = niceYDomain(0, max, 4, { percentCap: false, minSpan: 1 })
    const ticks = domain.ticks.filter(v => Number.isInteger(v))
    const yOf = (v: number) => plotB - (v / Math.max(1e-9, domain.hi)) * (plotB - plotT)

    ctx.font = `500 11px ${FONT}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'right'
    ctx.lineWidth = 1
    for (const tick of ticks) {
      const y = Math.round(yOf(tick)) + 0.5
      ctx.strokeStyle = grid
      ctx.beginPath(); ctx.moveTo(plotL, y); ctx.lineTo(plotR, y); ctx.stroke()
      ctx.fillStyle = muted
      ctx.fillText(String(tick), plotL - 6, y)
    }

    const n = rows.length
    const slot = (plotR - plotL) / Math.max(1, n)
    const barW = Math.min(24, slot * 0.6)
    const active = activeRef.current
    // Beschriftungen: so viele, wie nebeneinander passen
    ctx.font = `500 11px ${FONT}`
    const labelW = Math.max(1, ...rows.map(row => ctx.measureText(row.label).width)) + 8
    const every = Math.max(1, Math.ceil(labelW / slot))
    rows.forEach((row, i) => {
      const cx = plotL + slot * (i + 0.5)
      let base = 0
      row.values.forEach((value, k) => {
        if (value <= 0) return
        const top = base + value * reveal
        const y1 = yOf(base)
        const y2 = yOf(top)
        base = top
        const last = row.values.slice(k + 1).every(v => v <= 0)
        ctx.globalAlpha = active != null && active !== i ? 0.35 : 1
        ctx.fillStyle = colors[k] ?? muted
        ctx.beginPath()
        ctx.roundRect(cx - barW / 2, y2, barW, Math.max(0, y1 - y2 - (last ? 0 : 1.5)), last ? [4, 4, 0, 0] : 0)
        ctx.fill()
        ctx.globalAlpha = 1
      })
      if (i % every === 0 || i === active) {
        ctx.fillStyle = i === active ? text : muted
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(row.label, Math.min(Math.max(cx, plotL + labelW / 2), plotR - labelW / 2), plotB + 6)
      }
    })
    ctx.strokeStyle = grid
    ctx.beginPath(); ctx.moveTo(plotL, plotB + 0.5); ctx.lineTo(plotR, plotB + 0.5); ctx.stroke()

    // Ablese-Schild
    if (active != null && rows[active]) {
      const row = rows[active]
      const cx = plotL + slot * (active + 0.5)
      const parts = layers.map((layer, k) => ({ text: `${layer.name} ${row.values[k] ?? 0}`, color: colors[k] }))
      if (row.note) parts.push({ text: row.note, color: muted })
      ctx.textBaseline = 'alphabetic'
      ctx.font = `600 13px ${FONT}`
      const wTitle = ctx.measureText(row.title).width
      ctx.font = `800 13px ${FONT}`
      const gap = 10
      const widths = parts.map(part => ctx.measureText(part.text).width)
      const total = widths.reduce((sum, w) => sum + w, 0) + gap * (parts.length - 1)
      const half = Math.max(wTitle, total) / 2
      const mid = Math.min(Math.max(cx, plotL + half), width - half)
      ctx.textAlign = 'center'
      ctx.fillStyle = text
      ctx.font = `600 13px ${FONT}`
      ctx.fillText(row.title, mid, 14)
      ctx.textAlign = 'left'
      ctx.font = `800 13px ${FONT}`
      let left = mid - total / 2
      parts.forEach((part, k) => {
        ctx.fillStyle = part.color
        ctx.fillText(part.text, left, 33)
        left += widths[k] + gap
      })
    }

    if (reveal < 1) rafRef.current = requestAnimationFrame(t => drawRef.current(t))
  }, [])
  useLayoutEffect(() => { drawRef.current = draw }, [draw])

  const schedule = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(t => drawRef.current(t))
  }, [])

  // Neue Daten: Balken wachsen von unten
  useEffect(() => {
    revealStartRef.current = performance.now()
    activeRef.current = null
    schedule()
  }, [data, stacks, height, schedule])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w !== widthRef.current) { widthRef.current = w; schedule() }
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [schedule])

  useThemeRedraw(schedule)
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }, [])

  // ── Ablesen ──────────────────────────────────────────────────────────────
  const gesture = useRef<{ id: number; x: number; y: number; reading: boolean; hold: number | null } | null>(null)

  const setActive = useCallback((index: number | null) => {
    if (activeRef.current === index) return
    if (index != null && activeRef.current != null) void hapticTick()
    activeRef.current = index
    schedule()
  }, [schedule])

  const readAt = (clientX: number) => {
    const canvas = canvasRef.current
    const n = propsRef.current.data.length
    if (!canvas || !n) return
    const rect = canvas.getBoundingClientRect()
    const frac = (clientX - rect.left - AXIS_WIDTH) / Math.max(1, rect.width - 2 * AXIS_WIDTH)
    setActive(Math.min(n - 1, Math.max(0, Math.floor(frac * n))))
  }

  const end = () => {
    const g = gesture.current
    if (g?.hold != null) window.clearTimeout(g.hold)
    gesture.current = null
    setActive(null)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!propsRef.current.data.length) return
    const mouse = e.pointerType === 'mouse'
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, reading: mouse, hold: null }
    if (mouse) { readAt(e.clientX); return }
    const x = e.clientX
    gesture.current.hold = window.setTimeout(() => {
      const g = gesture.current
      if (!g || g.reading) return
      g.reading = true
      try { canvasRef.current?.setPointerCapture(g.id) } catch { /* ignore */ }
      void hapticTick()
      readAt(x)
    }, HOLD_MS)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current
    if (!g) {
      if (e.pointerType === 'mouse') readAt(e.clientX)
      return
    }
    if (g.id !== e.pointerId) return
    if (!g.reading) {
      const dx = Math.abs(e.clientX - g.x)
      const dy = Math.abs(e.clientY - g.y)
      if (dy > DRAG_START_PX && dy > dx) { end(); return }
      if (dx < DRAG_START_PX) return
      g.reading = true
      if (g.hold != null) window.clearTimeout(g.hold)
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    }
    readAt(e.clientX)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const n = propsRef.current.data.length
    if (!n) return
    if (e.key === 'Escape') { end(); return }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const current = activeRef.current ?? (e.key === 'ArrowLeft' ? n : -1)
    setActive(Math.min(n - 1, Math.max(0, current + (e.key === 'ArrowLeft' ? -1 : 1))))
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
        onPointerUp={e => { if (e.pointerType !== 'mouse') end(); else if (gesture.current) { gesture.current = null } }}
        onPointerCancel={end}
        onPointerLeave={e => { if (e.pointerType === 'mouse') end() }}
        onKeyDown={onKeyDown}
        onBlur={end}
        onContextMenu={e => e.preventDefault()}
        style={{
          display: 'block', width: '100%', height,
          touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none', outline: 'none', cursor: 'crosshair',
        }}
      />
    </div>
  )
})
