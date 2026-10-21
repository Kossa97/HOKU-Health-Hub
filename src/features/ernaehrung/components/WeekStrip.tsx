import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { getDateLocale } from '../../../i18n/dateLocales'
import { type DayTotals, EMPTY_TOTALS, dayAria, weekDays } from '../lib/dayRings'
import type { Goals } from '../lib/nutrition'
import { CARD, MUTED } from '../styles'
import { DayOrb } from './DayOrb'

/**
 * Die Woche (Mo–So) als eine schmale Zeile: Wochentag – Mini-Kugel – Zahl, der
 * gewählte Tag auf grauer Fläche. Den Monat öffnet der Tag oben in der Kugel-Zone.
 * Bewusst ein Wochenschnitt statt Tagesnoten: einzelne Ausreißer zählen
 * weniger, und leere Tage sind einfach leer — kein Streak, keine Lücke, die
 * bestraft wird. Künftige Tage lassen sich nicht wählen.
 */
export function WeekStrip({ date, today, week, goals, onPick }: {
  date: string
  today: string
  week: Record<string, DayTotals>
  goals: Goals
  onPick: (date: string) => void
}) {
  const { t } = useTranslation()
  const locale = getDateLocale()
  const days = weekDays(date)

  return (
    <section aria-labelledby="nutr-week" className={`${CARD} px-1.5 py-1.5`}>
      <h2 id="nutr-week" className="sr-only">{t('nutr_week_calendar')}</h2>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map(d => {
          const selected = d === date
          const future = d > today
          return (
            <button key={d} type="button" onClick={() => onPick(d)} disabled={future} aria-pressed={selected}
              aria-label={dayAria(d, week[d] ?? EMPTY_TOTALS, goals, t)} data-nutr-day={d}
              className={`flex min-w-0 touch-manipulation select-none flex-col items-center gap-1 rounded-[12px] py-1 transition-colors duration-200 disabled:cursor-default ${
                selected ? 'bg-[var(--lg-fill)]' : ''}`}>
              <span className={`text-[10px] font-semibold uppercase leading-none tracking-[0.3px] ${d === today ? 'text-[var(--accent)]' : MUTED}`}>
                {format(parseISO(d), 'EEEEEE', { locale })}
              </span>
              <DayOrb totals={week[d] ?? EMPTY_TOTALS} goals={goals} size={24} dim={future} />
              <span className={`text-[13px] leading-none tabular-nums ${
                d === today ? 'font-bold text-[var(--accent)]' : selected ? 'font-bold text-[var(--lg-text)]' : 'font-medium text-[var(--lg-text)]'
              } ${future ? 'opacity-35' : ''}`}>
                {format(parseISO(d), 'd')}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
