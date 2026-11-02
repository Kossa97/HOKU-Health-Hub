/**
 * Einstellungen des Gesamtfortschritts (`progress_settings`, Teilprojekt 2b):
 * Start, fruehere Starts, Richtung je Wert, Baseline aus Health, Wochenreihe
 * und verdiente Abzeichen. Rein: Parsen und die Schritte „neuer Start“ und
 * „vorherigen Start wieder nutzen“.
 *
 * Ohne gesetzten Start gilt „erste Messung“: der frueheste Tag mit Daten
 * (`implicitStart`); jeder Wert beginnt dann bei seiner eigenen ersten Messung.
 */
import { isBadgeId, type BadgeId } from './badgeIds'
import {
  parseDirections, parseHistory, type Direction, type DirectionOverrides, type MetricId, type ProgressHistoryEntry,
} from './progressScore'

export interface ProgressSettings {
  /** Gesetzter Start (`yyyy-MM-dd`); `null` = erste Messung. */
  startOn: string | null
  /** Fruehere Starts, neuester zuerst. */
  previousStarts: string[]
  directions: DirectionOverrides
  /** Roh; `parseBaselines(raw, start)` liest nur Eintraege fuer den aktuellen Start. */
  baselines: unknown
  history: ProgressHistoryEntry[]
  /** Verdiente Abzeichen: ID → Tag des Erhalts. Einmal verdient bleibt verdient. */
  earnedBadges: Partial<Record<BadgeId, string>>
}

export const EMPTY_PROGRESS_SETTINGS: ProgressSettings = {
  startOn: null, previousStarts: [], directions: {}, baselines: {}, history: [], earnedBadges: {},
}

/** Wie `progress_days_ok` in der Migration: hoechstens 50 fruehere Starts. */
export const PREVIOUS_STARTS_MAX = 50

const DAY = /^\d{4}-\d{2}-\d{2}$/
export const isDay = (v: unknown): v is string =>
  typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v

export function parseEarnedBadges(raw: unknown): Partial<Record<BadgeId, string>> {
  const out: Partial<Record<BadgeId, string>> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (isBadgeId(key) && isDay(value)) out[key] = value
  }
  return out
}

/** Zeile aus `progress_settings` (oder `null`, wenn es noch keine gibt). */
export function parseProgressSettings(row: Record<string, unknown> | null | undefined): ProgressSettings {
  if (!row) return { ...EMPTY_PROGRESS_SETTINGS }
  const start = typeof row.start_on === 'string' ? row.start_on.slice(0, 10) : null
  const previous = Array.isArray(row.previous_starts)
    ? [...new Set(row.previous_starts.filter(isDay))].slice(0, PREVIOUS_STARTS_MAX)
    : []
  return {
    startOn: isDay(start) ? start : null,
    previousStarts: previous,
    directions: parseDirections(row.directions),
    baselines: row.baselines ?? {},
    history: parseHistory(row.history),
    earnedBadges: parseEarnedBadges(row.earned_badges),
  }
}

/** Neuer Start: der bisherige (auch der implizite) kommt nach vorn in die fruehere Liste. */
export function withNewStart(settings: ProgressSettings, newStart: string, currentStart: string): ProgressSettings {
  const previous = [currentStart, ...settings.previousStarts].filter(d => d !== newStart)
  return {
    ...settings,
    startOn: newStart,
    previousStarts: [...new Set(previous)].slice(0, PREVIOUS_STARTS_MAX),
  }
}

/** Frueheren Start wieder nutzen: er tauscht mit dem aktuellen den Platz. */
export function withRestoredStart(settings: ProgressSettings, day: string, currentStart: string): ProgressSettings {
  if (!settings.previousStarts.includes(day)) return settings
  return withNewStart({ ...settings, previousStarts: settings.previousStarts.filter(d => d !== day) }, day, currentStart)
}

/** Richtung setzen; die Standardrichtung wird nicht gespeichert. */
export function withDirection(
  directions: DirectionOverrides, id: MetricId, direction: Direction, standard: Direction,
): DirectionOverrides {
  const next: DirectionOverrides = { ...directions }
  if (direction === standard) delete next[id]
  else next[id] = direction
  return next
}

/** Schreibform fuer `progress_settings` (nur die uebergebenen Teile). */
export function settingsRow(s: Partial<ProgressSettings>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (s.startOn !== undefined) row.start_on = s.startOn
  if (s.previousStarts !== undefined) row.previous_starts = s.previousStarts
  if (s.directions !== undefined) row.directions = s.directions
  if (s.baselines !== undefined) row.baselines = s.baselines
  if (s.history !== undefined) row.history = s.history
  if (s.earnedBadges !== undefined) row.earned_badges = s.earnedBadges
  return row
}
