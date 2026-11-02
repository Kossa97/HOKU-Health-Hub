/**
 * Anzeige der Profilwerte: Zahl, Einheit und Unterzeile je Feld. Rein, damit
 * eigene und fremde Ansicht (Task 7) denselben Text zeigen.
 */
import { catalogExercise } from '../../training/lib/exerciseLookup'
import type { ProfileField } from './profileVisibility'
import type { ProfileViewFields } from './profileView'

export type Translate = (key: string, vars?: Record<string, unknown>) => string

/** App-Sprache der Übungsnamen (Katalog hat nur de/en). */
export const exerciseLang = (locale: string): 'de' | 'en' => (locale.toLowerCase().startsWith('de') ? 'de' : 'en')

/**
 * Übungsname aus dem Schnappschuss in der App-Sprache des Betrachters:
 * Katalog-Übungen neu aufgelöst, sonst der gespeicherte Name (eigene Übung).
 */
export function shownExerciseName(e: { id: string; name: string }, locale: string): string {
  return catalogExercise(e.id)?.name[exerciseLang(locale)] ?? e.name
}

export interface TileText {
  /** Beschriftung über dem Wert */
  label: string
  value: string
  unit?: string
  sub?: string
  /** Langer Text (Umfänge): kleinere Schrift, darf umbrechen */
  long?: boolean
}

/** Echtes Minuszeichen statt Bindestrich. */
const minus = (s: string) => s.replace(/^-/, '−')

export function numberFormat(locale: string, digits = 1) {
  const f = new Intl.NumberFormat(locale, { maximumFractionDigits: digits })
  const signed = new Intl.NumberFormat(locale, { maximumFractionDigits: digits, signDisplay: 'exceptZero' })
  return {
    n: (v: number) => minus(f.format(v)),
    d: (v: number) => minus(signed.format(v)),
  }
}

/** Minuten → „7:12“ */
export const hoursMinutes = (min: number): string => {
  const total = Math.max(0, Math.round(min))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** `YYYY-MM` → „März 2026“ */
export function monthYear(value: string, locale: string): string {
  const [y, m] = value.split('-').map(Number)
  if (!y || !m) return value
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)))
}

/** Text einer Kachel; `null`, wenn das Feld keinen Wert hat (außer den Platzhaltern). */
export function tileText(field: ProfileField, fields: ProfileViewFields, t: Translate, locale: string): TileText | null {
  const { n, d } = numberFormat(locale)
  const label = t(`profil_feld_${field}`)
  const seitStart = (delta: number | undefined, unit: string) =>
    delta === undefined ? undefined : t('profil_seit_start', { wert: `${d(delta)}${unit ? ` ${unit}` : ''}` })

  switch (field) {
    case 'age':
      return fields.age ? { label, value: n(fields.age.v) } : null
    case 'height':
      return fields.height ? { label, value: n(fields.height.v), unit: 'cm' } : null
    case 'weight':
      return fields.weight ? { label, value: n(fields.weight.v), unit: 'kg', sub: seitStart(fields.weight.delta, 'kg') } : null
    case 'body_fat':
      return fields.body_fat ? { label, value: n(fields.body_fat.v), unit: '%', sub: seitStart(fields.body_fat.delta, '%') } : null
    case 'muscle_mass':
      return fields.muscle_mass ? { label, value: n(fields.muscle_mass.v), unit: 'kg', sub: seitStart(fields.muscle_mass.delta, 'kg') } : null
    case 'measurements': {
      const m = fields.measurements
      if (!m) return null
      const value = m.sites.map(s => `${t(`umfang_${s.site}`)} ${n(s.v)}`).join(' · ')
      const deltas = m.sites.filter(s => s.delta !== undefined && s.delta !== 0)
        .map(s => `${t(`umfang_${s.site}`)} ${d(s.delta!)} cm`)
      return { label, value, unit: 'cm', long: true, sub: deltas.length > 0 ? deltas.join(' · ') : undefined }
    }
    case 'adherence':
      return fields.adherence
        ? { label, value: n(Math.round(fields.adherence.pct)), unit: '%', sub: t('profil_adherence_sub', { bestaetigt: fields.adherence.confirmed, verpasst: fields.adherence.missed }) }
        : null
    case 'substances':
      return fields.substances
        ? { label, value: n(fields.substances.count), sub: fields.substances.activeCycles > 0 ? t('profil_substanzen_zyklen', { count: fields.substances.activeCycles }) : undefined }
        : null
    case 'markers':
      return fields.markers ? { label, value: n(fields.markers.count) } : null
    case 'in_range':
      return fields.in_range ? { label, value: n(fields.in_range.inRange), unit: `/ ${n(fields.in_range.of)}` } : null
    case 'steps':
      return fields.steps ? { label, value: n(fields.steps.v), sub: seitStart(fields.steps.delta, '') } : null
    case 'resting_hr':
      return fields.resting_hr ? { label, value: n(fields.resting_hr.v), unit: 'bpm', sub: seitStart(fields.resting_hr.delta, '') } : null
    case 'sleep':
      return fields.sleep ? { label, value: hoursMinutes(fields.sleep.v), unit: 'h', sub: seitStart(fields.sleep.delta, 'min') } : null
    case 'active_kcal':
      return fields.active_kcal ? { label, value: n(fields.active_kcal.v), unit: 'kcal', sub: seitStart(fields.active_kcal.delta, '') } : null
    case 'spo2':
      return fields.spo2 ? { label, value: n(fields.spo2.v), unit: '%' } : null
    case 'blood_pressure':
      return fields.blood_pressure ? { label, value: `${fields.blood_pressure.sys}/${fields.blood_pressure.dia}`, unit: 'mmHg' } : null
    case 'hrv':
    case 'vo2max':
      return { label, value: '–' }
    case 'workouts':
      return fields.workouts
        ? { label, value: t('profil_workouts_wert', { gesamt: n(fields.workouts.total), proWoche: n(fields.workouts.perWeek) }) }
        : null
    case 'routine':
      return fields.routine ? { label, value: fields.routine.name } : null
    case 'favorite_exercise':
      return fields.favorite_exercise ? { label, value: shownExerciseName(fields.favorite_exercise, locale) } : null
    case 'e1rm': {
      const top = fields.e1rm?.top[0]
      return top ? { label, value: `${shownExerciseName(top, locale)} ${n(top.v)}`, unit: 'kg' } : null
    }
    case 'reviews':
      return fields.reviews
        ? { label: t('profil_berichte_anzahl', { count: fields.reviews.count }), value: `★ ${n(fields.reviews.avgRating)}`, sub: t('profil_berichte_sub') }
        : null
    default:
      return null
  }
}
