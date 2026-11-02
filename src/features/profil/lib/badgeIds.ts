/**
 * Die bekannten Abzeichen-IDs (Teilprojekt 2b, Spec Abschnitt 4: erster Satz, 39).
 *
 * Dieselbe Liste steht in `supabase-profil-p2b-fortschritt.sql`
 * (`profile_badge_ids`); `profile_view` gibt anderen nur IDs aus dieser Liste
 * heraus. Ein Test prueft, dass beide gleich sind. Eine ID wird nie
 * umbenannt (verdiente Abzeichen verweisen darauf); neue Abzeichen bekommen
 * neue IDs und brauchen eine Migration.
 *
 * Name, Symbol und Bedingung kommen mit Task 5 (`badges.ts`).
 */

export type BadgeGroup = 'bestaendigkeit' | 'meilensteine' | 'fortschritt' | 'gemeinschaft'

export const BADGE_IDS_BY_GROUP = {
  bestaendigkeit: [
    'streak_7', 'streak_30', 'streak_100', 'streak_365',
    'training_weeks_4', 'training_weeks_12', 'training_weeks_52',
    'intake_all_30', 'weighed_weeks_8',
  ],
  meilensteine: [
    'first_daily_log', 'first_measurement', 'first_bloodwork', 'bloodwork_3',
    'workouts_10', 'workouts_50', 'workouts_100', 'workouts_250',
    'first_cycle_done', 'wearable_connected', 'profile_complete', 'first_progress_photo',
  ],
  fortschritt: [
    'body_fat_5', 'body_fat_10', 'body_fat_20', 'weight_5',
    'first_pr', 'pr_3_month', 'all_markers_in_range', 'resting_hr_5', 'steps_week_10k',
    'progress_10', 'progress_25', 'progress_50',
  ],
  gemeinschaft: [
    'first_review', 'reviews_5', 'reviews_25', 'profile_shared',
    'first_friend', 'friends_10',
  ],
} as const satisfies Record<BadgeGroup, readonly string[]>

export type BadgeId = typeof BADGE_IDS_BY_GROUP[BadgeGroup][number]

export const BADGE_IDS: readonly BadgeId[] = Object.values(BADGE_IDS_BY_GROUP).flat()

/** Brauchen Freunde; verdienbar erst mit Teilprojekt 3. */
export const BADGES_NEED_FRIENDS: readonly BadgeId[] = ['first_friend', 'friends_10']

export const isBadgeId = (v: unknown): v is BadgeId =>
  typeof v === 'string' && (BADGE_IDS as readonly string[]).includes(v)
