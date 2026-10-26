import { isValid, parseISO } from 'date-fns'
import { aktiveSprache } from '../../blutwerte/lib/sprache'

export type DayStyle = 'dayMonth' | 'full'

const DAY_FORMATS: Record<DayStyle, Intl.DateTimeFormatOptions> = {
  dayMonth: { day: '2-digit', month: '2-digit' },
  full: { day: '2-digit', month: '2-digit', year: 'numeric' },
}

/**
 * Intl-Formatierer sind teuer im Aufbau, laufen hier aber pro Achsenstrich,
 * beim Ablesen pro Frame und im Gewichtsrad 1600-mal — einer je Sprache und Art.
 * Sprache wie in Blutwerte: die App-Sprache, damit Datum und Zahl überall gleich aussehen.
 */
const formatters = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>()

function dayFormat(style: DayStyle): Intl.DateTimeFormat {
  const key = `day:${style}:${aktiveSprache()}`
  let f = formatters.get(key) as Intl.DateTimeFormat | undefined
  if (!f) {
    f = new Intl.DateTimeFormat(aktiveSprache(), DAY_FORMATS[style])
    formatters.set(key, f)
  }
  return f
}

function numberFormat(fractionDigits: number | null): Intl.NumberFormat {
  const key = `num:${fractionDigits}:${aktiveSprache()}`
  let f = formatters.get(key) as Intl.NumberFormat | undefined
  if (!f) {
    f = new Intl.NumberFormat(aktiveSprache(), fractionDigits == null
      ? { maximumFractionDigits: 2 }
      : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
    formatters.set(key, f)
  }
  return f
}

/**
 * Formatiert yyyy-MM-dd sicher in der App-Sprache — invalid/leer wirft nicht.
 * de: 16.10. / 16.10.2026, en: 10/16 / 10/16/2026.
 */
export function formatDaySafe(iso: string | null | undefined, style: DayStyle = 'dayMonth'): string {
  const d = parseDaySafe(iso)
  if (!d) return '?'
  return dayFormat(style).format(d)
}

/** Zahl in der App-Sprache (82,5 / 82.5); `fractionDigits` fest, sonst bis zu zwei Stellen. */
export function formatNumber(value: number, fractionDigits: number | null = null): string {
  return numberFormat(fractionDigits).format(value)
}

/** Mit Vorzeichen: +1,5 / -1,5 / 0. */
export function formatSignedNumber(value: number): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`
}

export function parseDaySafe(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = parseISO(`${iso.slice(0, 10)}T00:00:00`)
  return isValid(d) ? d : null
}

export function dayToTsSafe(iso: string | null | undefined, hour = 12): number | null {
  const d = parseDaySafe(iso)
  if (!d) return null
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}
