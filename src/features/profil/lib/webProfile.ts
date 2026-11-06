/**
 * Web-Seite `/u/<name>` ohne Anmeldung (Teilprojekt 2c, Spec 1.1): reine
 * Darstellungsregeln. Was überhaupt im Web steht, entscheidet allein
 * `profile_view` in der Stufe `web` — hier wird nichts zusätzlich gefiltert,
 * nur sortiert, gekürzt und in Text übersetzt.
 */
import { isRankId, SHOWN_BADGE_IDS, type BadgeId } from './badgeIds'
import type { MemberFor } from './profileView'

/**
 * Reihenfolge der Abzeichen im Web: die schwersten zuerst (Mockup 2c,
 * Abschnitt 3). Maßstab ist der Mindestaufwand: lückenlose Serien vor Summen
 * gleicher Dauer, Ergebnisse vor Menge, Erstes-Mal und Einrichten zuletzt.
 * Heikle stehen mit drin, falls jemand sie freigibt.
 */
export const BADGES_WEB_RANK: readonly BadgeId[] = [
  'streak_365', 'training_weeks_52', 'workouts_250', 'run_150', 'cycle_150', 'hiit_150', 'yoga_150', 'prs_100', 'journal_365',
  'all_markers_in_range', 'progress_50', 'body_fat_20', 'streak_100', 'swim_100', 'row_100', 'sleep_rested_100', 'entries_1000',
  'hike_75', 'hyrox_60', 'reviews_25', 'friends_10', 'workouts_100', 'journal_100', 'body_fat_10', 'training_weeks_12',
  'steps_weeks_12', 'allrounder', 'progress_25', 'prs_25', 'pr_3_month', 'intake_all_30', 'streak_30', 'run_50', 'cycle_50',
  'hiit_50', 'yoga_50', 'sleep_rested_30', 'weight_5', 'swim_30', 'row_30', 'hike_25', 'hyrox_20', 'steps_week_10k',
  'workouts_50', 'weighed_weeks_8', 'journal_30', 'sleep_tracked_30', 'body_fat_5', 'resting_hr_5', 'progress_10',
  'bloodwork_3', 'reviews_5', 'prs_5', 'training_weeks_4', 'run_10', 'cycle_10', 'swim_10', 'row_10', 'hike_10', 'hiit_10',
  'yoga_10', 'hyrox_5', 'streak_7', 'first_pr', 'workouts_10', 'first_cycle_done', 'profile_complete',
  'first_progress_photo', 'first_bloodwork', 'first_review', 'first_friend', 'first_measurement', 'first_daily_log',
  'wearable_connected', 'profile_shared',
]

const RANK = new Map(BADGES_WEB_RANK.map((id, i) => [id, i]))
// Ein neues Abzeichen ohne Platz in der Rangfolge landet hinten, in der Reihenfolge von SHOWN_BADGE_IDS.
const rankOf = (id: BadgeId) => RANK.get(id) ?? BADGES_WEB_RANK.length + SHOWN_BADGE_IDS.indexOf(id)

/** Eine Reihe mit drei Kacheln: bis drei alle offen, sonst zwei offen und „+x“ für den Rest. */
export interface WebBadgeRow {
  open: BadgeId[]
  /** Zahl der übrigen, die verdeckte dritte Kachel eingeschlossen; 0 = keine verdeckte Kachel. */
  more: number
}

export function webBadgeRow(ids: readonly BadgeId[]): WebBadgeRow {
  // Ränge sind kein Abzeichen (sie stehen als Titel unter dem Namen)
  const sorted = [...new Set(ids)].filter(id => !isRankId(id)).sort((a, b) => rankOf(a) - rankOf(b))
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
