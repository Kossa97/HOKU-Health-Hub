import { addDays, format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { getDateLocale } from '../../../i18n/dateLocales'
import { share } from '../lib/nutrition'
import { MACRO_COLORS, card, label, muted } from '../styles'

/**
 * Die letzten 7 Tage. Bewusst ein Wochenschnitt statt Tagesnoten: einzelne
 * Ausreißer zählen weniger, und leere Tage sind einfach leer — kein Streak,
 * keine Lücke, die bestraft wird.
 */
export function WeekStrip({ date, week, goalKcal, goalProtein, hideKcal, onPick }: {
  date: string
  week: Record<string, { kcal: number; protein: number }>
  goalKcal: number
  goalProtein: number
  hideKcal: boolean
  onPick: (date: string) => void
}) {
  const { t } = useTranslation()
  const locale = getDateLocale()
  const days = Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(date), i - 6), 'yyyy-MM-dd'))
  const value = (d: string) => (hideKcal ? week[d]?.protein ?? 0 : week[d]?.kcal ?? 0)
  const goal = hideKcal ? goalProtein : goalKcal
  const logged = days.filter(d => value(d) > 0)
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + value(d), 0) / logged.length) : null

  return (
    <section aria-labelledby="nutr-week" className="p-4" style={card}>
      <div className="flex items-baseline justify-between">
        <h2 id="nutr-week" style={label}>{t('nutr_week')}</h2>
        {avg != null && (
          <span className="text-[0.78rem] font-semibold tabular-nums" style={muted}>
            {t(hideKcal ? 'nutr_week_avg_protein' : 'nutr_week_avg_kcal', { value: avg, days: logged.length })}
          </span>
        )}
      </div>
      <div className="mt-3 flex h-24 items-end gap-1.5">
        {days.map(d => {
          const v = value(d)
          const pct = Math.min(100, share(v, goal) * 100)
          const selected = d === date
          return (
            <button key={d} type="button" onClick={() => onPick(d)} aria-pressed={selected}
              aria-label={`${format(parseISO(d), 'EEEE, d. MMMM', { locale })}: ${Math.round(v)} ${hideKcal ? 'g' : 'kcal'}`}
              className="flex h-full flex-1 touch-manipulation select-none flex-col items-center justify-end gap-1">
              <div className="relative w-full flex-1">
                {/* Ziellinie */}
                <div className="absolute inset-x-0 border-t border-dashed" style={{ bottom: '100%', borderColor: 'var(--border-strong)' }} aria-hidden="true" />
                <div className="absolute inset-x-1 bottom-0 rounded-md"
                  style={{ height: `${pct}%`, minHeight: v > 0 ? 3 : 0, background: hideKcal ? MACRO_COLORS.protein : MACRO_COLORS.kcal, opacity: selected ? 1 : 0.55 }} />
              </div>
              <span className="text-[0.68rem] font-bold" style={{ color: selected ? 'var(--text)' : 'var(--text-muted)' }}>
                {format(parseISO(d), 'EEEEEE', { locale })}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
