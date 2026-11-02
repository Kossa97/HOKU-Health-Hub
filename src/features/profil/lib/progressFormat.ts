/**
 * Texte und Zahlen des Gesamtfortschritts (Karte, Zeitreise, Aufschluesselung).
 * Rein bis auf `t`, damit Karte und Seite dieselben Worte zeigen.
 */
import type { MeasurementSite } from '../../fortschritt/lib/measurements'
import type { Translate } from './profileFormat'
import type { BaselineState, MetricId, ProgressArea, ProgressValueResult } from './progressScore'
import type { BadgeCheck } from './badges'

const minus = (s: string) => s.replace(/^-/, '−')

/** „+28,3 %“, „−4,1 %“, „±0 %“ — immer mit Vorzeichen. */
export function formatPct(v: number, locale: string, digits = 1): string {
  const r = Math.round(v * 10 ** digits) / 10 ** digits
  if (r === 0) return '±0 %'
  const f = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: 'always' })
  return `${minus(f.format(r)).replace(/^-/, '−')} %`
}

/** Ohne Prozentzeichen, fuer schmale Felder („+7,7“). */
export function formatSigned(v: number, locale: string, digits = 1): string {
  const r = Math.round(v * 10 ** digits) / 10 ** digits
  if (r === 0) return '±0'
  const f = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: 'always' })
  return f.format(r).replace(/^-/, '−')
}

/** `yyyy-MM-dd` → „14.03.2026“ (Schreibweise der Sprache). */
export function formatDay(day: string, locale: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)))
}

/** `yyyy-MM-dd` → „14.03.“ (Achse der Zeitreise). */
export function formatDayShort(day: string, locale: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)))
}

export const areaName = (area: ProgressArea, t: Translate) => t(`pf_area_${area}`)

export function metricName(id: MetricId, t: Translate, exerciseNames: Record<string, string> = {}): string {
  if (id.startsWith('e1rm:')) {
    const exercise = id.slice('e1rm:'.length)
    return t('pf_wert_e1rm', { name: exerciseNames[exercise] ?? exercise })
  }
  if (id.startsWith('circ_')) return t(`umfang_${id.slice('circ_'.length) as MeasurementSite}`)
  return t(`pf_wert_${id}`)
}

const UNIT: Partial<Record<string, string>> = {
  weight: 'kg', body_fat: '%', muscle_mass: 'kg', adherence: '%', active_kcal: 'kcal', resting_hr: 'bpm', bp_sys: 'mmHg', hrv: 'ms',
}

function unitOf(id: MetricId): string {
  if (id.startsWith('circ_')) return 'cm'
  if (id.startsWith('e1rm:')) return 'kg'
  return UNIT[id] ?? ''
}

/** Start- oder Jetzt-Wert: „84,2 kg“, „12/24“, „6.140“. `null` ohne Wert. */
export function metricValue(v: ProgressValueResult, which: 'start' | 'now', locale: string): string | null {
  const of = which === 'start' ? v.startOf : v.nowOf
  if (of) return `${of.n}/${of.of}`
  const x = which === 'start' ? v.start : v.now
  if (x == null) return null
  if (v.id === 'markers_in_range' || v.id === 'sleep_nights') return `${Math.round(x * 100)} %`
  const digits = v.id === 'steps' || v.id === 'active_kcal' ? 0 : 1
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(x)
  const unit = unitOf(v.id)
  return unit ? `${minus(n)} ${unit}` : minus(n)
}

/** „84,2 → 81 kg“ bzw. „12/24 → 19/24“. */
export function startToNow(v: ProgressValueResult, locale: string): string | null {
  const start = metricValue(v, 'start', locale)
  const now = metricValue(v, 'now', locale)
  if (start === null) return null
  if (now === null) return start
  const unit = unitOf(v.id)
  // Einheit nur einmal am Ende („84,2 → 81 kg“)
  const bare = unit && start.endsWith(` ${unit}`) ? start.slice(0, -unit.length - 1) : start
  return `${bare} → ${now}`
}

/** „sammelt Baseline: 9 von 14 Tagen“ */
export function baselineText(b: BaselineState, t: Translate): string | null {
  if (b.status !== 'collecting') return null
  return t('pf_sammelt', { have: b.have, need: b.need, einheit: t(`pf_einheit_${b.unit}`) })
}

/** Nette Skala fuer die Balken: 10, 15, 20, 25, 30, 40, 50, 60, 80, 100 … */
export function niceCeil(x: number): number {
  if (x <= 10) return 10
  const p = 10 ** Math.floor(Math.log10(x))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= x) return m * p
  return 10 * p
}

/**
 * Skala der Bereichsbalken um die Nulllinie: rechts bis zum groessten Wert
 * (mindestens +10), links bis zum kleinsten (oder ein kleiner Rest, damit die
 * Nulllinie nicht am Rand klebt). Waechst mit; kein Maximum.
 */
export function barScale(values: readonly number[]): { lo: number; hi: number } {
  const hi = niceCeil(Math.max(10, ...values.map(v => Math.max(0, v))))
  const minV = Math.min(0, ...values)
  const lo = minV < 0 ? -niceCeil(-minV) : -hi / 6
  return { lo, hi }
}

/** Stand eines nicht verdienten Abzeichens: „41/100“, „−18,6 %“, „9.840“. */
export function badgeProgressText(c: BadgeCheck, locale: string): string | null {
  if (c.have === undefined || c.need === undefined) return null
  const n = (x: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(x)
  switch (c.unit) {
    case 'percent_drop': return c.have > 0 ? formatPct(-c.have, locale) : null
    case 'percent': return formatPct(c.have, locale)
    case 'bpm_drop': return c.have > 0 ? `−${n(c.have, 1)} bpm` : null
    case 'steps': return c.have > 0 ? n(c.have) : null
    default: return `${n(c.have)}/${n(c.need)}`
  }
}

/** Farbe je Bereich (CSS-Variablen in index.css; helle Stufen bei hellem Look). */
export const AREA_COLOR: Record<ProgressArea, string> = {
  koerper: 'var(--pf-koerper)', blut: 'var(--pf-blut)', training: 'var(--pf-training)',
  einnahmen: 'var(--pf-einnahmen)', erholung: 'var(--pf-erholung)',
}
