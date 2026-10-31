import { addDays, format, parseISO } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { type PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getDateLocale } from '../../../i18n/dateLocales'
import { dayKey } from '../../../lib/sharedDay'
import { type DayTotals, EMPTY_TOTALS, dayAria, weekDays } from '../lib/dayRings'
import type { Goals } from '../lib/nutrition'
import { SLOP, project, releaseVelocity, rubber } from '../lib/gesture'
import { usePrefersReducedMotion } from '../lib/orbZone'
import { CARD, MUTED } from '../styles'
import { DayOrb } from './DayOrb'

/** „19.–25. Oktober“ bzw. „October 19 – 25“; ohne formatRange (alte Browser) beide Tage ausgeschrieben. */
function rangeText(from: string, to: string, lang: string): string {
  const f = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' })
  const a = parseISO(from), b = parseISO(to)
  return typeof f.formatRange === 'function' ? f.formatRange(a, b) : `${f.format(a)} – ${f.format(b)}`
}


/**
 * Die Woche (Mo–So), schmal: darüber klein der Zeitraum und der Knopf zum Monat,
 * darunter je Tag Mini-Kugel – Zahl – Wochentag, der gewählte Tag auf grauer Fläche.
 * Bewusst ein Wochenschnitt statt Tagesnoten: einzelne Ausreißer zählen
 * weniger, und leere Tage sind einfach leer — kein Streak, keine Lücke, die
 * bestraft wird. Künftige Tage lassen sich nicht wählen.
 */
export function WeekStrip({ date, today, week, goals, dayLabel, onPick, onWeek, onOpenMonth, dropDay = null }: {
  date: string
  today: string
  week: Record<string, DayTotals>
  goals: Goals
  /** Der gewählte Tag in Worten — für Vorleser bei jedem Wechsel angesagt. */
  dayLabel: string
  onPick: (date: string) => void
  /** Zur vorigen (-1) bzw. nächsten (+1) Woche gewischt. */
  onWeek: (step: -1 | 1) => void
  /** Beim Verschieben: über diesem Tag hält der Finger gerade einen Eintrag. */
  dropDay?: string | null
  onOpenMonth: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = getDateLocale()
  const days = weekDays(date)
  const reduce = usePrefersReducedMotion()
  const weeks = [-7, 0, 7].map(n => weekDays(dayKey(addDays(parseISO(days[0]), n))))
  const canNext = weeks[2][0] <= today

  /**
   * Wischen zwischen den Wochen: drei Wochen liegen nebeneinander, die Leiste folgt dem Finger 1:1,
   * beim Loslassen entscheidet der Schwung (wohin der Wisch ausliefe) und eine Feder bringt sie
   * mit dem Tempo des Fingers an ihren Platz. Hinter heute gibt die Leiste nur zäh nach.
   * Senkrecht bleibt der Seite (touch-action: pan-y); greifen mitten in der Feder fängt sie auf.
   */
  const viewRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const st = useRef({
    x: 0, v: 0, raf: 0, swallowUntil: 0,
    drag: null as null | { id: number; x0: number; y0: number; base: number; dir: 'x' | 'y' | null; hist: { x: number; t: number }[] },
  })
  const pick = useRef({ onWeek, canNext })
  useEffect(() => { pick.current = { onWeek, canNext } })

  const paint = () => {
    const el = trackRef.current
    if (el) el.style.transform = `translate3d(calc(-100% / 3 + ${st.current.x}px), 0, 0)`
  }

  // Neue Woche steht (gewischt oder anders gewählt): die Mitte zeigt sie, ohne Sprung.
  useLayoutEffect(() => {
    const s = st.current
    cancelAnimationFrame(s.raf)
    s.raf = 0
    // Hält der Finger die Leiste gerade, greift er dieselbe Stelle in der neuen Lage.
    if (s.drag) s.drag.base -= s.x
    s.x = 0
    s.v = 0
    paint()
  }, [days[0]]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(st.current.raf), [])

  const settle = (target: number, v0: number) => {
    const s = st.current
    const width = viewRef.current?.clientWidth ?? 0
    const done = () => {
      // Angekommen in der Nachbarwoche: die Seite wechselt sie, der Layout-Effekt setzt zurück auf die Mitte.
      if (target !== 0) pick.current.onWeek(target < 0 ? 1 : -1)
    }
    cancelAnimationFrame(s.raf)
    s.raf = 0
    s.v = v0
    if (reduce || !width) { s.x = target; s.v = 0; paint(); done(); return }
    // Kritisch gedämpft (Antwortzeit 0,38 s): kein Nachschwingen, übernimmt das Tempo des Fingers.
    const k = (2 * Math.PI / 0.38) ** 2
    const c = 2 * Math.sqrt(k)
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.032, Math.max(0, (now - last) / 1000))
      last = now
      s.v += (-k * (s.x - target) - c * s.v) * dt
      s.x += s.v * dt
      if (Math.abs(s.x - target) < 0.5 && Math.abs(s.v) < 10) {
        s.x = target; s.v = 0; s.raf = 0; paint(); done(); return
      }
      paint()
      s.raf = requestAnimationFrame(step)
    }
    s.raf = requestAnimationFrame(step)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const s = st.current
    // Mitten in der Feder gegriffen: von der Stelle weiter, an der die Leiste gerade steht —
    // und dieser Griff wählt keinen Tag (wie Antippen beim Ausrollen einer Liste).
    if (s.raf) s.swallowUntil = performance.now() + 600
    cancelAnimationFrame(s.raf)
    s.raf = 0
    s.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: s.x, dir: null, hist: [{ x: e.clientX, t: e.timeStamp }] }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const s = st.current
    const d = s.drag
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    if (!d.dir) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      d.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (d.dir === 'x') {
        viewRef.current?.setPointerCapture(e.pointerId)
        // Ab der Schwelle weich weiter, statt um die Schwelle zu springen.
        d.x0 += Math.sign(dx) * SLOP
      }
    }
    if (d.dir !== 'x') return
    d.hist.push({ x: e.clientX, t: e.timeStamp })
    if (d.hist.length > 6) d.hist.shift()
    const width = viewRef.current?.clientWidth ?? 0
    const min = pick.current.canNext ? -width : 0
    const raw = d.base + e.clientX - d.x0
    s.x = raw < min ? min + rubber(raw - min, width) : raw > width ? width + rubber(raw - width, width) : raw
    paint()
  }

  const onPointerEnd = (e: ReactPointerEvent) => {
    const s = st.current
    const d = s.drag
    if (!d || d.id !== e.pointerId) return
    s.drag = null
    if (d.dir !== 'x') {
      // Nur getippt oder senkrecht gescrollt — stand die Leiste noch zwischen zwei Wochen: zur nächsten.
      if (s.x !== 0 && !s.raf) {
        const width = viewRef.current?.clientWidth ?? 0
        const near = width ? Math.round(s.x / width) * width : 0
        settle(near < 0 && !pick.current.canNext ? 0 : Math.max(-width, Math.min(width, near)), 0)
      }
      return
    }
    // Der Wisch war kein Tipp: den folgenden Klick auf einen Tag schlucken.
    s.swallowUntil = performance.now() + 400
    const v = e.type === 'pointercancel' ? 0 : releaseVelocity(d.hist, e.timeStamp)
    const width = viewRef.current?.clientWidth ?? 0
    const end = s.x + project(v)
    const target = end < -width / 2 && pick.current.canNext ? -width : end > width / 2 ? width : 0
    settle(target, v)
  }

  return (
    <section aria-labelledby="nutr-week" className={`${CARD} px-2 pb-2 pt-1`}>
      <div className="flex items-center justify-between gap-2 pl-2">
        <h2 id="nutr-week" className={`text-[13px] font-normal tabular-nums ${MUTED}`}>
          <span className="sr-only">{t('nutr_week_calendar')}: </span>{rangeText(days[0], days[6], i18n.language ?? 'de')}
        </h2>
        <button type="button" onClick={onOpenMonth} aria-label={t('nutr_month_open')} aria-haspopup="dialog"
          className="lg-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--lg-text-2)]">
          <CalendarDays size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      {/* Tageswechsel ansagen (die Tage selbst sind keine Live-Bereiche). */}
      <span className="sr-only" aria-live="polite">{dayLabel}</span>
      <div ref={viewRef} className="-mx-2 touch-pan-y [overflow-x:clip]"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
        onClickCapture={e => { if (performance.now() < st.current.swallowUntil) { e.preventDefault(); e.stopPropagation() } }}>
        <div ref={trackRef} className="flex w-[300%] will-change-transform" style={{ transform: 'translate3d(calc(-100% / 3), 0, 0)' }}>
          {weeks.map((list, w) => (
            // Nur die gezeigte Woche ist bedienbar und wird vorgelesen; die Nachbarn sind Vorschau beim Wischen.
            <div key={list[0]} inert={w !== 1} aria-hidden={w !== 1 || undefined} className="grid w-1/3 shrink-0 grid-cols-7 gap-0.5 px-2">
              {list.map(d => {
                const selected = d === date
                const future = d > today
                return (
                  <button key={d} type="button" onClick={() => onPick(d)} disabled={future} aria-pressed={selected}
                    aria-label={dayAria(d, week[d] ?? EMPTY_TOTALS, goals, t)} data-nutr-day={d}
                    className={`flex min-w-0 touch-manipulation select-none flex-col items-center gap-1 rounded-[10px] pb-2 pt-1 transition-colors duration-200 disabled:pointer-events-none disabled:cursor-default ${
                      selected ? 'bg-[var(--lg-fill)]' : ''} ${dropDay === d ? 'scale-110 bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] ring-2 ring-[var(--accent)] transition-transform' : ''}`}>
                    <DayOrb totals={week[d] ?? EMPTY_TOTALS} goals={goals} size={28} dim={future} />
                    <span className={`text-[14px] leading-none tabular-nums ${
                      d === today ? 'font-medium text-[var(--lg-accent-text)]' : selected ? 'font-medium text-[var(--lg-text)]' : 'font-normal text-[var(--lg-text)]'
                    } ${future ? 'opacity-35' : ''}`}>
                      {format(parseISO(d), 'd')}
                    </span>
                    <span className={`text-[11px] leading-none ${d === today ? 'text-[var(--lg-accent-text)]' : MUTED}`}>
                      {format(parseISO(d), 'EEEEEE', { locale })}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
