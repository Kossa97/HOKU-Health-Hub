/**
 * Aktivitätskalorien: wie viel Bewegung heute zählt und was davon aufs Tagesziel kommt.
 *
 * Quellen, in dieser Reihenfolge:
 * 1. Apple Health (aktive Energie von Uhr und iPhone) — enthält Trainings schon.
 * 2. Trainings aus der App — zählen nur, wenn Apple Health nichts liefert.
 * 3. Selbst eingetragen — zählt immer dazu (Apple Health kennt es nicht).
 */

export type ActivityMode = 'deficit' | 'budget'
export type ActivityShare = 'half' | 'full'
export type ActivitySource = 'health' | 'training' | 'manual'

export const ACTIVITY_SOURCES: readonly ActivitySource[] = ['health', 'training', 'manual']

export interface ActivitySettings {
  activityMode: ActivityMode
  activityShare: ActivityShare
  activitySources: readonly ActivitySource[]
}

export const DEFAULT_ACTIVITY: ActivitySettings = { activityMode: 'deficit', activityShare: 'half', activitySources: ACTIVITY_SOURCES }

/** Ein Training aus der App an diesem Tag. */
export interface ActivityTraining {
  id: string
  title: string
  startedAt: string
  /** Von der Uhr gemessen oder geschätzt; null, wenn weder noch möglich war. */
  kcal: number | null
  estimated: boolean
}

/** Selbst eingetragen. */
export interface ActivityLog {
  id: string
  label: string
  minutes: number | null
  kcal: number
}

export interface ActivityDay {
  /** Aktive Energie aus Apple Health; null = nicht verfügbar (Browser, kein Zugriff, abgeschaltet). */
  healthKcal: number | null
  trainings: readonly ActivityTraining[]
  logs: readonly ActivityLog[]
}

export interface ActivityTotal {
  /** Alles, was heute zählt (kcal). */
  kcal: number
  /** Trainings stecken schon in Apple Health und zählen nicht extra. */
  trainingsInHealth: boolean
}

export function activityTotal(day: ActivityDay, sources: readonly ActivitySource[]): ActivityTotal {
  const on = (s: ActivitySource) => sources.includes(s)
  const manual = on('manual') ? day.logs.reduce((sum, l) => sum + l.kcal, 0) : 0
  const health = on('health') && day.healthKcal !== null && day.healthKcal > 0 ? day.healthKcal : null
  if (health !== null) return { kcal: Math.round(health + manual), trainingsInHealth: true }
  const trainings = on('training') ? day.trainings.reduce((sum, t) => sum + (t.kcal ?? 0), 0) : 0
  return { kcal: Math.round(trainings + manual), trainingsInHealth: false }
}

/** Was aufs Tagesziel kommt: beim Defizit nichts, sonst die Hälfte oder alles. */
export function activityBonus(settings: Pick<ActivitySettings, 'activityMode' | 'activityShare'>, activeKcal: number): number {
  if (settings.activityMode !== 'budget' || activeKcal <= 0) return 0
  return settings.activityShare === 'half' ? Math.round(activeKcal / 2) : Math.round(activeKcal)
}

/**
 * Grobe Schätzung aus Dauer und Gewicht (MET-Methode): kcal = MET × kg × Stunden.
 * Abgezogen wird der Ruheumsatz (1 MET), denn der steckt schon im Grundziel.
 * MET 5 ≈ Krafttraining/zügiges Radfahren, also eine mittlere Belastung.
 */
export function estimateActiveKcal(minutes: number, weightKg: number | null, met = 5): number | null {
  if (!weightKg || weightKg <= 0 || !(minutes > 0)) return null
  return Math.max(1, Math.round((met - 1) * weightKg * (minutes / 60)))
}

/** Liest gespeicherte Quellen; Unbekanntes fällt weg, nichts gesetzt = alle. */
export function parseSources(raw: unknown): ActivitySource[] {
  if (!Array.isArray(raw)) return [...ACTIVITY_SOURCES]
  return ACTIVITY_SOURCES.filter(s => raw.includes(s))
}
