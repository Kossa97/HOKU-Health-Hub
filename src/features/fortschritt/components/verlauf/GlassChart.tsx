import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { DateRange } from '../../types'
import type { SeriesPoint } from '../../lib/metrics'
import { assignLanes } from '../../lib/cycleLanes'
import { dayToTsSafe, formatDaySafe, formatNumber } from '../../lib/dates'

/** Ein angewählter Zyklus-Abschnitt als Balken hinter der Kurve. */
export interface ChartBand {
  key: string
  substanceId: string
  name: string
  color: string
  start: string
  /** null: läuft noch */
  end: string | null
}

export interface ScrubState {
  index: number
  /** Name der Substanz, deren Start der Finger gerade getroffen hat */
  startOf: string | null
  date: string
  /** Ablese-Punkt in Bildschirm-Koordinaten (Linie, Mitte des Graphen) — das Licht dahinter tritt zurück */
  clientX: number
  clientY: number
}

interface Props {
  points: SeriesPoint[]
  range: DateRange
  color: string
  bands: ChartBand[]
  /** Substanz, die gerade angewählt wurde — nur ihr Balken blendet auf */
  newBandSubstance: string | null
  ariaLabel: string
  onScrub: (state: ScrubState | null) => void
}

const W = 360
const H = 224
const PT = 8
const PB = 26
const PR = 36
const PLOT_W = W - PR
const Y0 = PT
const Y1 = H - PB
const SNAP_PX = 9

// Achsen wie auf einem Laborbefund: Mono, gedämpft; Gitter als Haarlinie
const AXIS_STYLE: CSSProperties = { fontFamily: 'var(--font-mono)', fill: 'var(--lg-text-3, rgba(235,240,255,0.52))' }
const GRID_STYLE: CSSProperties = { stroke: 'var(--lg-hair, rgba(255,255,255,0.07))' }
const RING_STYLE: CSSProperties = { stroke: 'var(--app-bg, #000)' }

const ts = (iso: string) => dayToTsSafe(iso, 12) ?? 0

export function GlassChart({ points, range, color, bands, newBandSubstance, ariaLabel, onScrub }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<{ x: number; dotX: number; y: number } | null>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const lastSnap = useRef<string | null>(null)

  const geo = useMemo(() => {
    const t0 = ts(range.from)
    const t1 = Math.max(t0 + 86_400_000, ts(range.to))
    const x = (t: number) => ((t - t0) / (t1 - t0)) * PLOT_W
    const values = points.map(p => p.value)
    const min = values.length ? Math.min(...values) : 0
    const max = values.length ? Math.max(...values) : 1
    const span = Math.max(Math.abs(max) * 0.02, 0.5, max - min)
    const lo = min - span * 0.18
    const hi = max + span * 0.14
    const y = (v: number) => Y0 + (1 - (v - lo) / (hi - lo)) * (Y1 - Y0)
    const pts = points.map(p => ({ ...p, t: ts(p.date) }))
    return { t0, t1, x, y, lo, hi, pts }
  }, [points, range])

  // Balken: auf Bahnen verteilt — je mehr gleichzeitig angewählt, desto dünner.
  const laid = useMemo(() => {
    const items = bands
      .map(b => {
        const start = ts(b.start)
        const end = b.end ? ts(b.end) : geo.t1
        return { ...b, startTs: start, x1: geo.x(Math.max(geo.t0, start)), x2: geo.x(Math.min(geo.t1, end)), endTs: end }
      })
      .filter(b => b.x2 > b.x1 - 0.5 && b.endTs >= geo.t0 && b.startTs <= geo.t1)
    const placed = assignLanes(items)
    const lanes = Math.max(1, ...placed.map(b => b.lane + 1))
    const gap = lanes > 1 ? 3 : 0
    const bandH = ((Y1 - Y0) - gap * (lanes - 1)) / lanes
    return placed.map(b => ({ ...b, y: Y0 + b.lane * (bandH + gap), h: bandH }))
  }, [bands, geo])

  const starts = laid.filter(b => b.startTs >= geo.t0 && b.startTs <= geo.t1)

  const { pts, x, y } = geo
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
  const last = pts[pts.length - 1]
  const area = pts.length > 1 ? `${line}L${x(last.t).toFixed(1)},${Y1}L${x(pts[0].t).toFixed(1)},${Y1}Z` : ''
  const grid = [0.2, 0.5, 0.8].map(f => ({ y: Y0 + f * (Y1 - Y0), v: geo.hi - f * (geo.hi - geo.lo) }))
  const mid = new Date((geo.t0 + geo.t1) / 2)
  const midIso = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, '0')}-${String(mid.getDate()).padStart(2, '0')}`
  const showDots = pts.length > 0 && pts.length <= 32

  const scrubAt = (clientX: number) => {
    const el = wrapRef.current
    if (!el || pts.length === 0) return
    const rect = el.getBoundingClientRect()
    const px = Math.min(PLOT_W, Math.max(0, ((clientX - rect.left) / rect.width) * W))
    let t = geo.t0 + (px / PLOT_W) * (geo.t1 - geo.t0)
    let startOf: string | null = null
    let startIso = ''
    for (const s of starts) {
      if (Math.abs(x(s.startTs) - px) <= SNAP_PX) { t = s.startTs; startOf = s.name; startIso = s.start; break }
    }
    if (startOf && startOf !== lastSnap.current) navigator.vibrate?.(8)
    lastSnap.current = startOf
    let best = 0
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i].t - t) < Math.abs(pts[best].t - t)) best = i
    }
    // Linie am Start, Punkt bleibt auf der Kurve beim tatsächlichen Messwert
    const lineX = startOf ? x(t) : x(pts[best].t)
    setCursor({ x: lineX, dotX: x(pts[best].t), y: y(pts[best].value) })
    onScrub({ index: best, startOf, date: startOf ? startIso : pts[best].date, clientX: rect.left + (lineX / W) * rect.width, clientY: rect.top + rect.height / 2 })
  }

  const end = () => {
    setScrubbing(false)
    setCursor(null)
    lastSnap.current = null
    onScrub(null)
  }

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') e.currentTarget.setPointerCapture(e.pointerId)
    setScrubbing(true)
    scrubAt(e.clientX)
  }

  return (
    <div
      ref={wrapRef}
      className="fg-chart"
      role="img"
      aria-label={ariaLabel}
      data-scrubbing={scrubbing}
      onPointerDown={onDown}
      onPointerMove={e => { if (scrubbing || e.pointerType === 'mouse') scrubAt(e.clientX) }}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={e => { if (e.pointerType === 'mouse') end() }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <defs>
          <linearGradient id="fg-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.2" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {laid.map(b => (
          <g key={b.key} className={b.substanceId === newBandSubstance ? 'fg-band-new' : undefined}>
            <rect
              className="fg-band"
              x={b.x1.toFixed(1)}
              y={b.y.toFixed(1)}
              width={Math.max(2, b.x2 - b.x1).toFixed(1)}
              height={b.h.toFixed(1)}
              rx={Math.min(8, b.h / 2)}
              fill={b.color}
              fillOpacity={0.17}
            />
            {b.end && b.endTs < geo.t1 && (
              <line x1={b.x2} x2={b.x2} y1={b.y} y2={b.y + b.h} stroke={b.color} strokeOpacity={0.6} strokeDasharray="2 3" />
            )}
            {b.h >= 15 && b.x2 - b.x1 > 60 && (
              <text x={b.x1 + 8} y={b.y + Math.min(15, b.h / 2 + 4)} fontSize="10" fontWeight="500" fill={b.color} style={{ fontFamily: 'var(--font-sans)' }}>
                {b.name}
              </text>
            )}
          </g>
        ))}

        {grid.map(g => (
          <g key={g.y}>
            <line x1="0" x2={PLOT_W} y1={g.y} y2={g.y} style={GRID_STYLE} />
            <text x={W - 2} y={g.y + 3.5} fontSize="10" textAnchor="end" style={AXIS_STYLE}>
              {formatNumber(Math.round(g.v * 10) / 10)}
            </text>
          </g>
        ))}

        {starts.map(s => (
          <g key={`start-${s.key}`}>
            <line x1={x(s.startTs)} x2={x(s.startTs)} y1={Y0} y2={Y1} stroke={s.color} strokeWidth="1.4" strokeOpacity="0.9" />
            <circle cx={x(s.startTs)} cy={Y1} r="4" fill={s.color} strokeWidth="1.5" style={RING_STYLE} />
          </g>
        ))}

        <g className="fg-chart-body" key={`${range.from}|${range.to}|${color}|${pts.length}`}>
          {area && <path d={area} fill="url(#fg-area)" />}
          {pts.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
          {showDots && pts.map(p => <circle key={p.date} cx={x(p.t)} cy={y(p.value)} r="2.4" fill={color} />)}
          {last && <circle cx={x(last.t)} cy={y(last.value)} r="5" fill={color} strokeWidth="2" style={RING_STYLE} />}
        </g>

        <text x="2" y={H - 7} fontSize="10" style={AXIS_STYLE}>{formatDaySafe(range.from)}</text>
        <text x={PLOT_W / 2} y={H - 7} fontSize="10" textAnchor="middle" style={AXIS_STYLE}>{formatDaySafe(midIso)}</text>
        <text x={PLOT_W} y={H - 7} fontSize="10" textAnchor="end" style={AXIS_STYLE}>{formatDaySafe(range.to)}</text>

        {cursor && (
          <g>
            <line x1={cursor.x} x2={cursor.x} y1={Y0} y2={Y1} stroke="rgba(255,255,255,0.5)" />
            <circle className="fg-scrub-dot" cx={cursor.dotX} cy={cursor.y} r="6.5" fill={color} stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  )
}
