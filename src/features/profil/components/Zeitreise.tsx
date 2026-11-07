/**
 * Zeitreise (Teilprojekt 2b, Variante 2): Verlauf des Gesamtfortschritts seit
 * dem Start als Wochenreihe. Mit Finger oder Maus über die Linie fahren setzt
 * Leitzahl und die fünf Bereichswerte auf diese Woche; mit dem fokussierten
 * Diagramm gehen die Pfeiltasten (Pos1/Ende) Woche für Woche. Abzeichen
 * stehen als Ringe in der Woche, in der sie verdient wurden.
 *
 * Nur das Diagramm nimmt den Finger ganz (`touch-action: none`), die Seite
 * scrollt sonst normal. Bei „Bewegung reduzieren“ springt das Fadenkreuz.
 */
import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PROGRESS_AREAS, weekOf, type ProgressHistoryEntry } from '../lib/progressScore'
import { BADGE_BY_ID, badgeName } from '../lib/badges'
import type { BadgeId } from '../lib/badgeIds'
import { AREA_COLOR, areaName, formatDay, formatDayShort, formatPct, formatSigned, niceCeil } from '../lib/progressFormat'

const CW = 340
const CH = 160
const PAD = { l: 30, r: 10, t: 12, b: 22 }

export interface ZeitreiseAbzeichen { id: BadgeId; on: string }

export function Zeitreise({ history, since, badges }: {
  /** Wochen seit dem Start, aufsteigend; die letzte ist die laufende (Stand heute). */
  history: readonly ProgressHistoryEntry[]
  since: string
  badges: readonly ZeitreiseAbzeichen[]
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n?.language || 'de'
  const lang = i18n?.resolvedLanguage ?? locale
  const n = history.length
  const [auswahl, setAuswahl] = useState<number | null>(null)
  const idx = auswahl === null || auswahl >= n ? n - 1 : auswahl
  const svgRef = useRef<SVGSVGElement>(null)
  const gradId = useId()

  const geo = useMemo(() => {
    const totals = history.map(e => e.total).filter((x): x is number => x !== null)
    const hi = niceCeil(Math.max(10, ...totals))
    const minV = Math.min(0, ...totals)
    const lo = minV < 0 ? -niceCeil(-minV) : 0
    const X = (i: number) => (n <= 1 ? (PAD.l + CW - PAD.r) / 2 : PAD.l + (i / (n - 1)) * (CW - PAD.l - PAD.r))
    const Y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (CH - PAD.t - PAD.b)
    // Linie mit Lücken, wo eine Woche noch keinen Gesamtwert hat
    let line = ''
    let area = ''
    let seg: number[] = []
    const flush = () => {
      if (seg.length === 0) return
      const pts = seg.map(i => `${X(i).toFixed(1)},${Y(history[i].total!).toFixed(1)}`)
      line += `M${pts.join(' L')} `
      area += `M${X(seg[0]).toFixed(1)},${Y(0).toFixed(1)} L${pts.join(' L')} L${X(seg[seg.length - 1]).toFixed(1)},${Y(0).toFixed(1)} Z `
      seg = []
    }
    history.forEach((e, i) => { if (e.total === null) flush(); else seg.push(i) })
    flush()
    const ticks = [hi, hi / 2, 0, ...(lo < 0 ? [lo] : [])]
    return { X, Y, line, area, ticks }
  }, [history, n])

  const weekIndex = useMemo(() => new Map(history.map((e, i) => [e.week, i])), [history])
  const punkte = useMemo(() => badges
    .filter(b => b.on >= since && weekIndex.has(weekOf(b.on)))
    .map(b => ({ ...b, i: weekIndex.get(weekOf(b.on))! })), [badges, since, weekIndex])

  if (n === 0) {
    return <p className="text-[14px] text-[var(--lg-text-3)]" data-zeitreise-leer>{t('pf_zeitreise_leer')}</p>
  }

  const e = history[idx]
  const heute = idx === n - 1
  const wann = heute ? t('pf_heute') : t('pf_woche_vom', { datum: formatDay(e.week, locale) })
  const total = e.total

  const ausZeiger = (event: PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return
    const x = ((event.clientX - box.left) / box.width) * CW
    let best = 0
    for (let i = 1; i < n; i++) if (Math.abs(geo.X(i) - x) < Math.abs(geo.X(best) - x)) best = i
    setAuswahl(best)
  }
  const taste = (event: KeyboardEvent<SVGSVGElement>) => {
    const next = { ArrowLeft: idx - 1, ArrowDown: idx - 1, ArrowRight: idx + 1, ArrowUp: idx + 1, Home: 0, End: n - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    setAuswahl(Math.max(0, Math.min(n - 1, next)))
  }

  const dieseWoche = punkte.filter(p => p.i === idx)
  const xs = geo.X(idx)
  const ys = total === null ? null : geo.Y(total)
  const erste = history[0].week < since ? since : history[0].week

  return (
    <div data-zeitreise>
      <div className="flex flex-wrap items-baseline gap-x-2.5" aria-live="polite">
        <span className="text-[44px] font-semibold leading-none tracking-tight tabular-nums text-[var(--lg-text)]" data-zeitreise-total>
          {total === null ? '–' : formatPct(total, locale)}
        </span>
        <span className="text-[14px] text-[var(--lg-text-2)]">
          {total === null ? t('pf_zu_wenig') : t(total < 0 ? 'pf_negativ' : 'pf_positiv')}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] text-[var(--lg-text-3)]" data-zeitreise-wann>{wann}</p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${CW} ${CH}`}
        className="mt-3 block h-auto w-full cursor-crosshair rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lg-accent)]"
        data-zeitreise-plot
        role="slider"
        tabIndex={0}
        aria-label={t('pf_zeitreise_label')}
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={idx}
        aria-valuetext={`${wann}: ${total === null ? t('pf_zu_wenig') : formatPct(total, locale)}`}
        onKeyDown={taste}
        onPointerDown={event => { event.currentTarget.setPointerCapture?.(event.pointerId); ausZeiger(event) }}
        onPointerMove={event => { if (event.buttons > 0 || event.pointerType === 'mouse') ausZeiger(event) }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--lg-accent-text)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--lg-accent-text)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {geo.ticks.map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={CW - PAD.r} y1={geo.Y(v)} y2={geo.Y(v)} stroke={v === 0 ? 'var(--lg-text-4)' : 'var(--lg-hair)'} strokeWidth={1} />
            <text x={PAD.l - 5} y={geo.Y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--lg-text-3)">
              {v === 0 ? '0' : formatSigned(v, locale, 0)}
            </text>
          </g>
        ))}
        <path d={geo.area} fill={`url(#${gradId})`} />
        <path d={geo.line} fill="none" stroke="var(--lg-accent-text)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {punkte.map(p => (
          <circle
            key={p.id}
            cx={geo.X(p.i)}
            cy={geo.Y(history[p.i].total ?? 0)}
            r={5}
            fill="var(--app-bg, #1c1c1e)"
            stroke="var(--pf-badge)"
            strokeWidth={2}
            data-zeitreise-badge={p.id}
          >
            <title>{`${badgeName(p.id, lang)} (${formatDay(p.on, locale)})`}</title>
          </circle>
        ))}
        <g className="motion-safe:transition-transform motion-safe:duration-150" style={{ transform: `translateX(${xs}px)` }} data-zeitreise-cursor>
          <line x1={0} x2={0} y1={PAD.t} y2={CH - PAD.b} stroke="var(--lg-text-2)" strokeWidth={1} />
          {ys !== null && <circle cx={0} cy={ys} r={5} fill="var(--lg-accent-text)" stroke="var(--app-bg, #1c1c1e)" strokeWidth={2} />}
        </g>
        <text x={geo.X(0)} y={CH - 6} fontSize={10} fill="var(--lg-text-3)" textAnchor={n > 1 ? 'start' : 'middle'}>{formatDayShort(erste, locale)}</text>
        {n > 1 && <text x={geo.X(n - 1)} y={CH - 6} fontSize={10} fill="var(--lg-text-3)" textAnchor="end">{t('pf_heute')}</text>}
      </svg>

      <div className="mt-3 grid grid-cols-5 gap-1.5" data-zeitreise-areas>
        {PROGRESS_AREAS.map(a => {
          const v = e.areas[a]
          return (
            <div key={a} className="min-w-0 rounded-[10px] bg-[var(--lg-surface-2)] px-1 py-1.5 text-center" data-zeitreise-area={a}>
              <span aria-hidden="true" className="mx-auto mb-1 block h-[3px] w-5 rounded-full" style={{ background: AREA_COLOR[a] }} />
              <span className="block truncate text-[10.5px] text-[var(--lg-text-3)]">{t(`pf_area_kurz_${a}`)}</span>
              <span className="mt-0.5 block text-[13px] font-semibold tabular-nums text-[var(--lg-text)]" aria-label={`${areaName(a, t)}: ${v === undefined ? t('pf_wartet') : formatPct(v, locale)}`}>
                {v === undefined ? '–' : formatSigned(v, locale)}
              </span>
            </div>
          )
        })}
      </div>

      {dieseWoche.length > 0 && (
        <p className="mt-2 text-[13px] text-[var(--lg-text-2)]" data-zeitreise-week-badges>
          {t('pf_abz_diese_woche')} {dieseWoche.map(p => `${BADGE_BY_ID[p.id].icon} ${badgeName(p.id, lang)}`).join(' · ')}
        </p>
      )}
      <p className="mt-2 text-[12.5px] leading-snug text-[var(--lg-text-3)]">{t('pf_zeitreise_hinweis')}</p>
    </div>
  )
}
