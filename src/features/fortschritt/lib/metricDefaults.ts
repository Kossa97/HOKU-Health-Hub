import type { DailyLogEntry, WeightLogEntry } from '../types'

export function weightForDate(
  weightLogs: WeightLogEntry[],
  date: string,
): { kg: number; id: string } | null {
  const hit = weightLogs
    .filter(w => w.logged_at.slice(0, 10) === date)
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))[0]
  if (!hit || hit.id == null) return null
  return { kg: hit.weight_kg, id: hit.id }
}

export function lastWeightBefore(weightLogs: WeightLogEntry[], date: string): number | null {
  const hit = weightLogs
    .filter(w => w.logged_at.slice(0, 10) < date)
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))[0]
  return hit?.weight_kg ?? null
}

/** Koerperwerte im Tageseintrag, die wie KFA vorbelegt werden. */
type BodyField = 'body_fat_pct' | 'muscle_mass_kg'

function dayValue(logs: DailyLogEntry[], date: string, field: BodyField): number | null {
  return logs.find(l => l.log_date === date)?.[field] ?? null
}

function lastValueBefore(logs: DailyLogEntry[], date: string, field: BodyField): number | null {
  const hit = logs
    .filter(l => l.log_date < date && l[field] != null)
    .sort((a, b) => b.log_date.localeCompare(a.log_date))[0]
  return hit?.[field] ?? null
}

export function bodyFatForDate(logs: DailyLogEntry[], date: string): number | null {
  return dayValue(logs, date, 'body_fat_pct')
}

export function lastBodyFatBefore(logs: DailyLogEntry[], date: string): number | null {
  return lastValueBefore(logs, date, 'body_fat_pct')
}

export function muscleMassForDate(logs: DailyLogEntry[], date: string): number | null {
  return dayValue(logs, date, 'muscle_mass_kg')
}

export function lastMuscleMassBefore(logs: DailyLogEntry[], date: string): number | null {
  return lastValueBefore(logs, date, 'muscle_mass_kg')
}

/** Grenzen wie die Pruefung in der Datenbank (`daily_logs.muscle_mass_kg`). */
export const MUSCLE_MASS_MIN_KG = 10
export const MUSCLE_MASS_MAX_KG = 150

export const isValidMuscleMass = (kg: number): boolean =>
  Number.isFinite(kg) && kg >= MUSCLE_MASS_MIN_KG && kg <= MUSCLE_MASS_MAX_KG

export function hasLogForDate(
  logs: DailyLogEntry[],
  weightLogs: WeightLogEntry[],
  date: string,
): boolean {
  if (weightForDate(weightLogs, date)) return true

  const log = logs.find(l => l.log_date === date)
  if (!log) return false

  return logHasProgressData(log)
}

function logHasProgressData(log: DailyLogEntry): boolean {
  return (
    (log.energie != null && log.energie > 0)
    || (log.schlaf != null && log.schlaf > 0)
    || (log.wohlbefinden != null && log.wohlbefinden > 0)
    || (log.libido != null && log.libido > 0)
    || log.body_fat_pct != null
    || log.muscle_mass_kg != null
  )
}

/** Mindestens ein gespeicherter Fortschrittseintrag (Gewicht, KFA, Muskelmasse oder Wellness). */
export function hasAnyProgressLog(
  logs: DailyLogEntry[],
  weightLogs: WeightLogEntry[],
): boolean {
  if (weightLogs.length > 0) return true
  return logs.some(logHasProgressData)
}

export interface LogFormValues {
  energie: number | null
  schlaf: number | null
  wohlbefinden: number | null
  libido: number | null
  bodyFat: number | null
  muscleMass: number | null
  weight: number | null
  weightRowId: string | null
}

export type SavedLogFormValues = LogFormValues & { date: string }

function wellnessValue(value: number | null | undefined): number | null {
  return value != null && value > 0 ? value : null
}

/** Lädt Tageswerte; „letzte Werte“ nur wenn für das Datum noch kein Eintrag existiert. */
export function loadLogFormValues(
  logs: DailyLogEntry[],
  weightLogs: WeightLogEntry[],
  date: string,
  savedValues?: SavedLogFormValues | null,
): LogFormValues {
  if (savedValues?.date === date) {
    return {
      energie: savedValues.energie,
      schlaf: savedValues.schlaf,
      wohlbefinden: savedValues.wohlbefinden,
      libido: savedValues.libido,
      bodyFat: savedValues.bodyFat,
      muscleMass: savedValues.muscleMass ?? null,
      weight: savedValues.weight,
      weightRowId: savedValues.weightRowId,
    }
  }

  const existing = logs.find(l => l.log_date === date)
  const hasEntry = hasLogForDate(logs, weightLogs, date)
  const dayWeight = weightForDate(weightLogs, date)
  const dayBodyFat = bodyFatForDate(logs, date)
  const dayMuscleMass = muscleMassForDate(logs, date)

  return {
    energie: wellnessValue(existing?.energie),
    schlaf: wellnessValue(existing?.schlaf),
    wohlbefinden: wellnessValue(existing?.wohlbefinden),
    libido: wellnessValue(existing?.libido),
    bodyFat: hasEntry ? dayBodyFat : (dayBodyFat ?? lastBodyFatBefore(logs, date)),
    muscleMass: hasEntry ? dayMuscleMass : (dayMuscleMass ?? lastMuscleMassBefore(logs, date)),
    weight: hasEntry ? (dayWeight?.kg ?? null) : (dayWeight?.kg ?? lastWeightBefore(weightLogs, date)),
    weightRowId: dayWeight?.id ?? null,
  }
}
