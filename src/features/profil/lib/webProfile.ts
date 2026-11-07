/**
 * Web-Seite `/u/<name>` ohne Anmeldung (Teilprojekt 2c, Spec 1.1): reine
 * Darstellungsregeln. Was überhaupt im Web steht, entscheidet allein
 * `profile_view` in der Stufe `web` — hier wird nichts zusätzlich gefiltert,
 * nur sortiert, gekürzt und in Text übersetzt.
 */
import { BADGE_IDS, type BadgeId } from './badgeIds'
import type { MemberFor } from './profileView'

/**
 * Reihenfolge der Abzeichen im Web: die schwersten zuerst (Mockup 2c,
 * Abschnitt 3). Maßstab ist der Mindestaufwand: lückenlose Serien vor Summen
 * gleicher Dauer, Ergebnisse vor Menge, Erstes-Mal und Einrichten zuletzt.
 * Heikle stehen mit drin, falls jemand sie freigibt.
 */
export const BADGES_WEB_RANK: readonly BadgeId[] = [
  'streak_365', 'training_weeks_52', 'workouts_250', 'all_markers_in_range', 'progress_50', 'body_fat_20', 'streak_100',
  'reviews_25', 'friends_10', 'workouts_100', 'body_fat_10', 'training_weeks_12', 'progress_25', 'pr_3_month', 'intake_all_30',
  'streak_30', 'weight_5', 'steps_week_10k', 'workouts_50', 'weighed_weeks_8', 'body_fat_5', 'resting_hr_5', 'progress_10',
  'bloodwork_3', 'reviews_5', 'training_weeks_4', 'streak_7', 'first_pr', 'workouts_10', 'first_cycle_done', 'profile_complete',
  'first_progress_photo', 'first_bloodwork', 'first_review', 'first_friend', 'first_measurement', 'first_daily_log',
  'wearable_connected', 'profile_shared',
]

const RANK = new Map(BADGES_WEB_RANK.map((id, i) => [id, i]))
// Ein neues Abzeichen ohne Platz in der Rangfolge landet hinten, in der Reihenfolge von BADGE_IDS.
const rankOf = (id: BadgeId) => RANK.get(id) ?? BADGES_WEB_RANK.length + BADGE_IDS.indexOf(id)

/** Eine Reihe mit drei Kacheln: bis drei alle offen, sonst zwei offen und „+x“ für den Rest. */
export interface WebBadgeRow {
  open: BadgeId[]
  /** Zahl der übrigen, die verdeckte dritte Kachel eingeschlossen; 0 = keine verdeckte Kachel. */
  more: number
}

export function webBadgeRow(ids: readonly BadgeId[]): WebBadgeRow {
  const sorted = [...new Set(ids)].sort((a, b) => rankOf(a) - rankOf(b))
  if (sorted.length <= 3) return { open: sorted, more: 0 }
  return { open: sorted.slice(0, 2), more: sorted.length - 2 }
}

/** Übersetzungsschlüssel und Zahl für „Seit … dabei“; die Dauer kommt fertig vom Server. */
export function memberForText(m: MemberFor): { key: string; count: number } {
  if (m.unit === 'days' && m.n === 0) return { key: 'web_seit_heute', count: 0 }
  return { key: `web_seit_${m.unit}`, count: m.n }
}

/** Vorname für „Mara trackt 9 Werte“: erstes Wort des Anzeigenamens, sonst der Nutzername. */
export function firstName(displayName: string | null, username: string): string {
  const first = displayName?.trim().split(/\s+/)[0]
  return first || username
}
