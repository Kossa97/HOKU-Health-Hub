import { format, parseISO } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getDateLocale } from '../../../i18n/dateLocales'
import { type DayTotals, EMPTY_TOTALS, dayAria, weekDays } from '../lib/dayRings'
import type { Goals } from '../lib/nutrition'
import { CARD, MUTED } from '../styles'
import { DayOrb } from './DayOrb'

/**
 * Die Woche (Mo–So) mit einer Mini-Kalorien-Kugel je Tag; Reihenfolge
 * Kugel – Zahl – Wochentag, der gewählte Tag auf grauer Fläche.
 * Bewusst ein Wochenschnitt statt Tagesnoten: einzelne Ausreißer zählen
 * weniger, und leere Tage sind einfach leer — kein Streak, keine Lücke, die
 * bestraft wird. Künftige Tage lassen sich nicht wählen.
 */
export function WeekStrip({ date, today, week, goals, onPick, onOpenMonth }: {
  date: string
  today: string
  week: Record<string, DayTotals>
  goals: Goals
  onPick: (date: string) => void
  onOpenMonth: () => void
}) {
  const { t } = useTranslation()
  const locale = getDateLocale()
  const days = weekDays(date)
  const value = (d: string) => (goals.hideKcal ? week[d]?.protein ?? 0 : week[d]?.kcal ?? 0)
  const logged = days.filter(d => value(d) > 0)
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + value(d), 0) / logged.length) : null

  return (
    <section aria-labelledby="nutr-week" className={`${CARD} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="nutr-week" className="text-[17px] font-semibold text-[var(--lg-text)]">{t('nutr_week_calendar')}</h2>
          {avg != null && (
            <p className={`text-[13px] tabular-nums ${MUTED}`}>
              {t(goals.hideKcal ? 'nutr_week_avg_protein' : 'nutr_week_avg_kcal', { value: avg, days: logged.length, count: logged.length })}
            </p>
          )}
        </div>
        <button type="button" onClick={onOpenMonth} aria-label={t('nutr_month_open')} aria-haspopup="dialog"
          className="lg-glass lg-icon-btn lg-press shrink-0">
          <CalendarDays size={20} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {days.map(d => {
          const selected = d === date
          const future = d > today
          return (
            <button key={d} type="button" onClick={() => onPick(d)} disabled={future} aria-pressed={selected}
              aria-label={dayAria(d, week[d] ?? EMPTY_TOTALS, goals, t)} data-nutr-day={d}
              className={`flex min-w-0 touch-manipulation select-none flex-col items-center gap-1.5 rounded-[16px] pb-2 pt-1.5 transition-colors duration-200 disabled:cursor-default ${
                selected ? 'bg-[var(--lg-fill)]' : ''}`}>
              <DayOrb totals={week[d] ?? EMPTY_TOTALS} goals={goals} size={38} dim={future} />
              <span className={`text-[17px] leading-none tabular-nums ${
                d === today ? 'font-bold text-[var(--accent)]' : selected ? 'font-bold text-[var(--lg-text)]' : 'font-medium text-[var(--lg-text)]'
              } ${future ? 'opacity-35' : ''}`}>
                {format(parseISO(d), 'd')}
              </span>
              <span className={`text-[11px] font-semibold uppercase leading-none tracking-[0.4px] ${d === today ? 'text-[var(--accent)]' : MUTED}`}>
                {format(parseISO(d), 'EEEEEE', { locale })}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
