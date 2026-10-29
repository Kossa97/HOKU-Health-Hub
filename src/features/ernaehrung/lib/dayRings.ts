import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import type { TFunction } from 'i18next'
import { getDateLocale } from '../../../i18n/dateLocales'
import { dayKey } from '../../../lib/sharedDay'
import type { Goals } from './nutrition'

/** Summen eines Tages für Wochenleiste und Monatsblatt. */
export interface DayTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export const EMPTY_TOTALS: DayTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

export function addTotals(a: DayTotals, b: DayTotals, sign: 1 | -1 = 1): DayTotals {
  return {
    kcal: a.kcal + sign * b.kcal,
    protein: a.protein + sign * b.protein,
    carbs: a.carbs + sign * b.carbs,
    fat: a.fat + sign * b.fat,
  }
}

/** Montag bis Sonntag der Woche, in der `date` liegt. */
export function weekDays(date: string): string[] {
  const start = startOfWeek(parseISO(date), { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(start, i)))
}

/**
 * Monatsraster ab Montag: führende Lücken als `null`, damit der 1. unter dem
 * richtigen Wochentag steht. Kein Auffüllen mit Nachbarmonaten.
 */
export function monthGrid(month: string): (string | null)[] {
  const first = startOfMonth(parseISO(month))
  const lead = (first.getDay() + 6) % 7
  const days = Number(format(endOfMonth(first), 'd'))
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => dayKey(addDays(first, i))),
  ]
}

/** Erster und letzter Tag, die für ein Monatsraster geladen werden müssen. */
export function monthRange(month: string): { from: string; to: string } {
  const first = startOfMonth(parseISO(month))
  return { from: dayKey(first), to: dayKey(endOfMonth(first)) }
}

/** Erster und letzter Tag der Woche von `date`. */
export function weekRange(date: string): { from: string; to: string } {
  const d = parseISO(date)
  return { from: dayKey(startOfWeek(d, { weekStartsOn: 1 })), to: dayKey(endOfWeek(d, { weekStartsOn: 1 })) }
}

/** Vorlesetext eines Tages: Datum und Summen; ohne Kalorien, wenn sie ausgeblendet sind. */
export function dayAria(date: string, totals: DayTotals | undefined, goals: Goals, t: TFunction): string {
  const label = format(parseISO(date), 'PPPP', { locale: getDateLocale() })
  if (!totals || (totals.kcal <= 0 && totals.protein <= 0 && totals.carbs <= 0 && totals.fat <= 0)) {
    return t('nutr_day_empty', { date: label })
  }
  const r = (v: number) => Math.round(v)
  return goals.hideKcal
    ? t('nutr_day_macros', { date: label, protein: r(totals.protein), carbs: r(totals.carbs), fat: r(totals.fat) })
    : t('nutr_day_totals', { date: label, kcal: r(totals.kcal), protein: r(totals.protein), carbs: r(totals.carbs), fat: r(totals.fat) })
}
