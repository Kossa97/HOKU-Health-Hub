import { format, parseISO } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getDateLocale } from '../../../i18n/dateLocales'
import { type DayTotals, EMPTY_TOTALS, dayAria, weekDays } from '../lib/dayRings'
import type { Goals } from '../lib/nutrition'
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
export function WeekStrip({ date, today, week, goals, dayLabel, onPick, onOpenMonth }: {
  date: string
  today: string
  week: Record<string, DayTotals>
  goals: Goals
  /** Der gewählte Tag in Worten — für Vorleser bei jedem Wechsel angesagt. */
  dayLabel: string
  onPick: (date: string) => void
  onOpenMonth: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = getDateLocale()
  const days = weekDays(date)

  return (
    <section aria-labelledby="nutr-week" className={`${CARD} px-2 pb-1.5 pt-1`}>
      <div className="flex items-center justify-between gap-2 pl-2">
        <h2 id="nutr-week" className={`text-[12px] font-semibold tabular-nums ${MUTED}`}>
          <span className="sr-only">{t('nutr_week_calendar')}: </span>{rangeText(days[0], days[6], i18n.language ?? 'de')}
        </h2>
        <button type="button" onClick={onOpenMonth} aria-label={t('nutr_month_open')} aria-haspopup="dialog"
          className="lg-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--lg-text-2)]">
          <CalendarDays size={17} aria-hidden="true" />
        </button>
      </div>
      {/* Tageswechsel ansagen (die Tage selbst sind keine Live-Bereiche). */}
      <span className="sr-only" aria-live="polite">{dayLabel}</span>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map(d => {
          const selected = d === date
          const future = d > today
          return (
            <button key={d} type="button" onClick={() => onPick(d)} disabled={future} aria-pressed={selected}
              aria-label={dayAria(d, week[d] ?? EMPTY_TOTALS, goals, t)} data-nutr-day={d}
              className={`flex min-w-0 touch-manipulation select-none flex-col items-center gap-1 rounded-[12px] pb-1.5 pt-1 transition-colors duration-200 disabled:cursor-default ${
                selected ? 'bg-[var(--lg-fill)]' : ''}`}>
              <DayOrb totals={week[d] ?? EMPTY_TOTALS} goals={goals} size={28} dim={future} />
              <span className={`text-[14px] leading-none tabular-nums ${
                d === today ? 'font-bold text-[var(--accent)]' : selected ? 'font-bold text-[var(--lg-text)]' : 'font-medium text-[var(--lg-text)]'
              } ${future ? 'opacity-35' : ''}`}>
                {format(parseISO(d), 'd')}
              </span>
              <span className={`text-[10px] font-semibold uppercase leading-none tracking-[0.3px] ${d === today ? 'text-[var(--accent)]' : MUTED}`}>
                {format(parseISO(d), 'EEEEEE', { locale })}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
