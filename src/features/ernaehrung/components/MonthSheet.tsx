import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { addMonths, format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Panel'
import { SheetClose } from '../../../components/ui/SheetClose'
import { getDateLocale } from '../../../i18n/dateLocales'
import { type DayTotals, EMPTY_TOTALS, dayAria, monthGrid, monthRange, weekDays } from '../lib/dayRings'
import type { Goals } from '../lib/nutrition'
import { loadRange } from '../services/nutritionStore'
import { ERROR_TEXT, MUTED } from '../styles'
import { DayOrb } from './DayOrb'

/** Größte Mini-Kugel; ist der Bildschirm niedriger, rechnet das Raster herunter. */
const ORB_MAX = 30
/** Datum über der Kugel (18 px) samt Abstand und Innenabstand der Zelle. */
const NUM_H = 24
/** Zeilenabstand des Rasters (gap-y-1). */
const ROW_GAP = 4

/**
 * Monatsblatt der Ernährung: je Tag eine Mini-Kalorien-Kugel; die Makros stehen im aria-label.
 * Ein Tipp auf einen Tag wählt ihn und schließt das Blatt. Der laufende Tag
 * kommt aus der Seite (`live`), damit gerade Eingetragenes sofort stimmt.
 * Das Blatt passt immer ganz unter die Kugel, ohne Scrollen: Die Kugeln werden
 * so groß, wie die Höhe es zulässt; wird es eng, steht das Datum auf der Kugel.
 */
export function MonthSheet({ userId, date, today, goals, live, onPick, onClose }: {
  userId: string
  date: string
  today: string
  goals: Goals
  live: DayTotals
  onPick: (date: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = getDateLocale()
  const [month, setMonth] = useState(() => `${date.slice(0, 7)}-01`)
  const [data, setData] = useState<{ month: string; totals: Record<string, DayTotals> } | 'error' | null>(null)
  const [token, setToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    const { from, to } = monthRange(month)
    loadRange(userId, from, to)
      .then(totals => { if (!cancelled) setData({ month, totals }) })
      .catch(() => { if (!cancelled) setData('error') })
    return () => { cancelled = true }
  }, [userId, month, token])

  const totals = data && data !== 'error' && data.month === month ? { ...data.totals, [date]: live } : null
  const isCurrentMonth = month.slice(0, 7) >= today.slice(0, 7)
  const shift = (n: number) => { setData(null); setMonth(m => format(addMonths(parseISO(m), n), 'yyyy-MM-dd')) }
  const cells = monthGrid(month)
  const rows = Math.ceil(cells.length / 7)

  // Platz fürs Raster: von seiner Oberkante (bei Seitenanfang) bis zum Bildschirmrand, abzüglich allem,
  // was darunter noch kommt — Rand des Blatts und der Seite, Abstand unten samt sicherem Bereich.
  const areaRef = useRef<HTMLDivElement>(null)
  const [space, setSpace] = useState<{ h: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area) return
    const measure = () => {
      // Lage aus dem Layout (offsetTop), nicht aus dem Bildschirm: ein Einblenden per transform würde sonst mitgemessen.
      let top = 0
      for (let el: HTMLElement | null = area; el; el = el.offsetParent as HTMLElement | null) top += el.offsetTop
      const page = area.closest('[data-app-modal]')?.parentElement
      const main = area.closest('main')
      const below = (page ? page.getBoundingClientRect().bottom - area.getBoundingClientRect().bottom : 0) + (main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0)
      setSpace({ h: window.innerHeight - top - below, w: area.clientWidth })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(area)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  const rowH = space ? (space.h - (rows - 1) * ROW_GAP) / rows : Infinity
  // Datum über der Kugel, solange die Kugel dann noch gut erkennbar ist; sonst auf der Kugel.
  const stacked = rowH >= NUM_H + 22
  const orb = Math.floor(Math.max(16, Math.min(ORB_MAX, (space ? space.w / 7 : 44) - 6, stacked ? rowH - NUM_H : rowH)))
  const fits = !!space && orb <= (stacked ? rowH - NUM_H : rowH)

  // Passt das Blatt, steht die Seite still: kein Scrollen, kein Nachfedern. Unter dem Inhalt liegt sonst
  // noch der sichere Bereich (Polster am body), um den die Seite sich verschieben ließe.
  useEffect(() => {
    if (!fits) return
    const root = document.documentElement
    const before = [root.style.overflow, root.style.overscrollBehavior, document.body.style.overflow]
    window.scrollTo({ top: 0 })
    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'
    document.body.style.overflow = 'hidden'
    return () => { [root.style.overflow, root.style.overscrollBehavior, document.body.style.overflow] = before }
  }, [fits])

  return (
    <Sheet labelledBy="nutr-month-title" onClose={onClose} tall data-nutr-month>
      {/* Vormonat links neben dem Titel, Folgemonat als Pfeil dahinter: eine Zeile statt zwei. */}
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => shift(-1)}
          className="-ml-1 flex min-h-11 shrink-0 items-center gap-0.5 pr-1.5 text-[15px] font-medium text-[var(--accent)]">
          <ChevronLeft size={20} aria-hidden="true" /><span className="sr-only">{t('prev_month')}: </span>{format(addMonths(parseISO(month), -1), 'LLLL', { locale })}
        </button>
        <h2 id="nutr-month-title" className="min-w-0 truncate text-[19px] font-bold leading-tight text-[var(--lg-text)]" aria-live="polite">
          {format(parseISO(month), 'LLLL yyyy', { locale })}
        </h2>
        {!isCurrentMonth && (
          <button type="button" onClick={() => shift(1)}
            aria-label={`${t('next_month')}: ${format(addMonths(parseISO(month), 1), 'LLLL', { locale })}`}
            className="grid min-h-11 min-w-10 shrink-0 place-items-center text-[var(--accent)]">
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        )}
        <span className="ml-auto shrink-0"><SheetClose onClick={onClose} /></span>
      </div>

      <div className="mt-2 grid grid-cols-7 text-center" aria-hidden="true">
        {weekDays(today).map(d => (
          <span key={d} className={`text-[12px] font-semibold ${MUTED}`}>{format(parseISO(d), 'EEEEEE', { locale })}</span>
        ))}
      </div>

      <div ref={areaRef}>
      {data === 'error' ? (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3">
          <span className={ERROR_TEXT}>{t('nutr_load_error')}</span>
          <button type="button" data-quiet className="lg-gray-btn shrink-0" onClick={() => { setData(null); setToken(n => n + 1) }}>{t('lab_retry')}</button>
        </div>
      ) : (
        <div className="mt-0.5 grid grid-cols-7 gap-y-1" aria-busy={!totals}>
          {cells.map((d, i) => {
            if (!d) return <span key={`lead-${i}`} />
            const future = d > today
            const selected = d === date
            return (
              // Solange der Monat lädt: nicht wählbar und nur das Datum vorlesen, nie „nichts eingetragen".
              <button key={d} type="button" disabled={future || !totals} aria-pressed={selected} data-nutr-month-day={d}
                aria-label={totals ? dayAria(d, totals[d], goals, t) : format(parseISO(d), 'PPPP', { locale })}
                onClick={() => { onPick(d); onClose() }}
                className={`relative flex min-w-0 touch-manipulation select-none flex-col items-center rounded-[12px] disabled:cursor-default ${stacked ? 'gap-0.5 py-0.5' : 'justify-center'}`}>
                <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[12px] font-semibold tabular-nums ${
                  selected ? 'bg-[var(--accent)] text-[var(--accent-contrast)]' : d === today ? 'text-[var(--accent)]' : 'text-[var(--lg-text)]'
                } ${future ? 'opacity-35' : ''} ${stacked ? '' : 'absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2'}`}>
                  {format(parseISO(d), 'd')}
                </span>
                <DayOrb totals={totals?.[d] ?? EMPTY_TOTALS} goals={goals} size={orb} dim={future || !totals} />
              </button>
            )
          })}
        </div>
      )}
      </div>
    </Sheet>
  )
}
