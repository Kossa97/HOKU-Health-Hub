/**
 * Die bekannten Abzeichen-IDs (Teilprojekt 2b, Spec Abschnitt 4: erster Satz, 39;
 * Titel-Zusatz: Ränge, Sportarten und weitere tragbare Abzeichen, 42 dazu).
 *
 * Dieselbe Liste steht in `supabase-profil-titel.sql` (`profile_badge_ids`,
 * zuerst `supabase-profil-p2b-fortschritt.sql`); `profile_view` gibt anderen nur
 * IDs aus dieser Liste heraus. Ein Test prueft, dass beide gleich sind. Eine ID
 * wird nie umbenannt (verdiente Abzeichen verweisen darauf); neue Abzeichen
 * bekommen neue IDs und brauchen eine Migration.
 *
 * Name, Symbol und Bedingung stehen in `badges.ts`.
 */

/** `rang` ist die Rangleiter des Titels (Spec Titel 2): verdient wie Abzeichen, nie in der Abzeichen-Liste. */
export type BadgeGroup = 'bestaendigkeit' | 'meilensteine' | 'fortschritt' | 'sport' | 'gemeinschaft' | 'rang'

export const BADGE_IDS_BY_GROUP = {
  bestaendigkeit: [
    'streak_7', 'streak_30', 'streak_100', 'streak_365',
    'training_weeks_4', 'training_weeks_12', 'training_weeks_52',
    'intake_all_30', 'weighed_weeks_8',
    // Titel-Zusatz
    'steps_weeks_12', 'journal_30', 'journal_100', 'journal_365', 'sleep_tracked_30',
  ],
  meilensteine: [
    'first_daily_log', 'first_measurement', 'first_bloodwork', 'bloodwork_3',
    'workouts_10', 'workouts_50', 'workouts_100', 'workouts_250',
    'first_cycle_done', 'wearable_connected', 'profile_complete', 'first_progress_photo',
    // Titel-Zusatz
    'entries_1000',
  ],
  fortschritt: [
    'body_fat_5', 'body_fat_10', 'body_fat_20', 'weight_5',
    'first_pr', 'pr_3_month', 'all_markers_in_range', 'resting_hr_5', 'steps_week_10k',
    'progress_10', 'progress_25', 'progress_50',
    // Titel-Zusatz
    'prs_5', 'prs_25', 'prs_100', 'sleep_rested_30', 'sleep_rested_100',
  ],
  sport: [
    'run_10', 'run_50', 'run_150',
    'cycle_10', 'cycle_50', 'cycle_150',
    'swim_10', 'swim_30', 'swim_100',
    'row_10', 'row_30', 'row_100',
    'hike_10', 'hike_25', 'hike_75',
    'hyrox_5', 'hyrox_20', 'hyrox_60',
    'hiit_10', 'hiit_50', 'hiit_150',
    'yoga_10', 'yoga_50', 'yoga_150',
    'allrounder',
  ],
  gemeinschaft: [
    'first_review', 'reviews_5', 'reviews_25', 'profile_shared',
    'first_friend', 'friends_10',
  ],
  rang: ['rank_1', 'rank_2', 'rank_3', 'rank_4', 'rank_5', 'rank_6'],
} as const satisfies Record<BadgeGroup, readonly string[]>

export type BadgeId = typeof BADGE_IDS_BY_GROUP[BadgeGroup][number]

export const BADGE_IDS: readonly BadgeId[] = Object.values(BADGE_IDS_BY_GROUP).flat()

/** Gruppen der Abzeichen-Liste (ohne `rang`). */
export const SHOWN_BADGE_GROUPS: readonly BadgeGroup[] =
  (Object.keys(BADGE_IDS_BY_GROUP) as BadgeGroup[]).filter(g => g !== 'rang')

/** Abzeichen, die als Abzeichen erscheinen (Liste, Profilzeile, Web) — ohne die Ränge. */
export const SHOWN_BADGE_IDS: readonly BadgeId[] = SHOWN_BADGE_GROUPS.flatMap(g => BADGE_IDS_BY_GROUP[g])

export const RANK_IDS: readonly BadgeId[] = BADGE_IDS_BY_GROUP.rang

export const isRankId = (id: BadgeId) => RANK_IDS.includes(id)

/** Brauchen Freunde; verdienbar erst mit Teilprojekt 3. */
export const BADGES_NEED_FRIENDS: readonly BadgeId[] = ['first_friend', 'friends_10']

export const isBadgeId = (v: unknown): v is BadgeId =>
  typeof v === 'string' && (BADGE_IDS as readonly string[]).includes(v)

// ─── Abzeichen im Web (Teilprojekt 2c, Spec 2.1 und 6.1) ──────────────────────
//
// Dieselben Listen stehen in `supabase-profil-p2c-web.sql`
// (`profile_badge_web_sensitive`, `profile_badge_web_borderline`); ein Test
// prueft Gleichheit. Was im Web wirklich erscheint, entscheidet allein
// `profile_view` auf dem Server — die Listen hier dienen der Einstellung.

/** Verraten Blut, Zyklen, Einnahmen oder Koerperwerte: ab Werk aus, mit „verrät Gesundheitsdaten“. */
export const BADGES_WEB_SENSITIVE: readonly BadgeId[] = [
  'first_bloodwork', 'bloodwork_3', 'all_markers_in_range',
  'first_cycle_done',
  'intake_all_30',
  'body_fat_5', 'body_fat_10', 'body_fat_20', 'weight_5', 'resting_hr_5',
  // Titel-Zusatz: wie gut man schläft
  'sleep_rested_30', 'sleep_rested_100',
]

/** Grenzfaelle: ab Werk ebenfalls aus, ohne den Hinweis (Nutzer 04.11., Spec-Frage 7). */
export const BADGES_WEB_BORDERLINE: readonly BadgeId[] = [
  'weighed_weeks_8', 'first_measurement', 'first_progress_photo',
  'wearable_connected', 'steps_week_10k',
  'progress_10', 'progress_25', 'progress_50',
  // Titel-Zusatz: Schlaf überhaupt getrackt (Wearable)
  'sleep_tracked_30',
]

/** `profiles.web_badges`: nur Abweichungen vom Standard (`true` = zeigen, `false` = verbergen). */
export type WebBadgeOverrides = Partial<Record<BadgeId, boolean>>

/** Standard ohne Abweichung: heikle und Grenzfaelle aus, alles andere an. */
export const webBadgeDefault = (id: BadgeId): boolean =>
  !BADGES_WEB_SENSITIVE.includes(id) && !BADGES_WEB_BORDERLINE.includes(id)

/** Wirksam im Web, wie `profile_web_badge_on` in SQL: Abweichung, sonst Standard. */
export function webBadgeOn(id: BadgeId, overrides: WebBadgeOverrides): boolean {
  const v = Object.hasOwn(overrides, id) ? overrides[id] : undefined
  return typeof v === 'boolean' ? v : webBadgeDefault(id)
}

/**
 * Setzt ein Abzeichen fuers Web und haelt dabei nur Abweichungen: Entspricht
 * der neue Wert dem Standard, faellt der Schluessel weg. „Auf Standard
 * zuruecksetzen“ ist `{}`.
 */
export function withWebBadge(overrides: WebBadgeOverrides, id: BadgeId, on: boolean): WebBadgeOverrides {
  const next = { ...overrides }
  if (on === webBadgeDefault(id)) delete next[id]
  else next[id] = on
  return next
}

/**
 * Liest `web_badges` aus der Datenbank: nur bekannte IDs mit `true`/`false`,
 * dabei nur echte Abweichungen (ein Eintrag gleich dem Standard aendert nichts).
 * Alles andere faellt weg — wie `profile_web_badges_ok`, nur nachsichtig.
 */
export function parseWebBadges(raw: unknown): WebBadgeOverrides {
  const out: WebBadgeOverrides = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw)) {
    if (isBadgeId(k) && typeof v === 'boolean' && v !== webBadgeDefault(k)) out[k] = v
  }
  return out
}
