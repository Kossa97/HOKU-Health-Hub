import { useEffect, useState } from 'react'
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

/**
 * Monatsblatt der Ernährung: je Tag eine Mini-Kalorien-Kugel; die Makros stehen im aria-label.
 * Ein Tipp auf einen Tag wählt ihn und schließt das Blatt. Der laufende Tag
 * kommt aus der Seite (`live`), damit gerade Eingetragenes sofort stimmt.
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

  return (
    <Sheet labelledBy="nutr-month-title" onClose={onClose} tall data-nutr-month>
      <div className="flex items-center justify-between gap-2">
        <h2 id="nutr-month-title" className="lg-title2 min-w-0 truncate" aria-live="polite">
          {format(parseISO(month), 'LLLL yyyy', { locale })}
        </h2>
        <SheetClose onClick={onClose} />
      </div>
      {/* Blättern in eigener Zeile, mit dem Namen des Nachbarmonats: neben dem Titel würde er auf schmalen Geräten abgeschnitten. */}
      <div className="mt-1 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)}
          className="flex min-h-11 items-center gap-0.5 pr-2 text-[15px] font-medium text-[var(--accent)]">
          <ChevronLeft size={20} aria-hidden="true" /><span className="sr-only">{t('prev_month')}: </span>{format(addMonths(parseISO(month), -1), 'LLLL', { locale })}
        </button>
        {!isCurrentMonth && (
          <button type="button" onClick={() => shift(1)}
            className="flex min-h-11 items-center gap-0.5 pl-2 text-[15px] font-medium text-[var(--accent)]">
            <span className="sr-only">{t('next_month')}: </span>{format(addMonths(parseISO(month), 1), 'LLLL', { locale })}<ChevronRight size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center" aria-hidden="true">
        {weekDays(today).map(d => (
          <span key={d} className={`text-[12px] font-semibold ${MUTED}`}>{format(parseISO(d), 'EEEEEE', { locale })}</span>
        ))}
      </div>

      {data === 'error' ? (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3">
          <span className={ERROR_TEXT}>{t('nutr_load_error')}</span>
          <button type="button" data-quiet className="lg-gray-btn shrink-0" onClick={() => { setData(null); setToken(n => n + 1) }}>{t('lab_retry')}</button>
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-7 gap-y-1" aria-busy={!totals}>
          {monthGrid(month).map((d, i) => {
            if (!d) return <span key={`lead-${i}`} />
            const future = d > today
            const selected = d === date
            return (
              // Solange der Monat lädt: nicht wählbar und nur das Datum vorlesen, nie „nichts eingetragen".
              <button key={d} type="button" disabled={future || !totals} aria-pressed={selected} data-nutr-month-day={d}
                aria-label={totals ? dayAria(d, totals[d], goals, t) : format(parseISO(d), 'PPPP', { locale })}
                onClick={() => { onPick(d); onClose() }}
                className="flex min-w-0 touch-manipulation select-none flex-col items-center gap-0.5 rounded-[12px] py-0.5 disabled:cursor-default">
                <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[12px] font-semibold tabular-nums ${
                  selected ? 'bg-[var(--accent)] text-[var(--accent-contrast)]' : d === today ? 'text-[var(--accent)]' : 'text-[var(--lg-text)]'
                } ${future ? 'opacity-35' : ''}`}>
                  {format(parseISO(d), 'd')}
                </span>
                <DayOrb totals={totals?.[d] ?? EMPTY_TOTALS} goals={goals} size={30} dim={future || !totals} />
              </button>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
