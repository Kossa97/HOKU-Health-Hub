/**
 * Titel (Profil-Zusatz, Spec `docs/superpowers/specs/2026-11-03-profil-titel-design.md`):
 * genau einer steht unter dem Namen — der Rang (Tage mit eigenem Eintrag) oder
 * ein tragbares Abzeichen. Diese Datei ist zum Pflegen gedacht: Titelnamen
 * (de/en), Leitern mit drei Stufen und die persönlichen Titel mit ihrem Quellfeld.
 *
 * Dieselben Listen stehen in `supabase-profil-titel.sql`
 * (`profile_title_badge_ids`, `profile_title_ladders`, `profile_title_source`);
 * ein Test prüft Gleichheit. Was andere sehen, entscheidet allein `profile_view`:
 * nur verdiente Titel, persönliche nur mit Schalter, Einwilligung und höchstens
 * so sichtbar wie ihr Quellfeld und nie im Web, sonst der höchste Rang.
 */
import { RANK_IDS, type BadgeId } from './badgeIds'
import type { ProfileField } from './profileVisibility'

export type Lang = 'de' | 'en'
export interface TitleName { de: string; en: string }

/** Rangnamen (Spec 2), Schwelle in Tagen mit eigenem Eintrag. */
export const RANKS: readonly { id: BadgeId; days: number; name: TitleName }[] = [
  { id: 'rank_1', days: 1, name: { de: 'Neuling', en: 'Newcomer' } },
  { id: 'rank_2', days: 10, name: { de: 'Entdecker', en: 'Explorer' } },
  { id: 'rank_3', days: 50, name: { de: 'Dranbleiber', en: 'Committed' } },
  { id: 'rank_4', days: 100, name: { de: 'Routinier', en: 'Steady' } },
  { id: 'rank_5', days: 200, name: { de: 'Veteran', en: 'Veteran' } },
  { id: 'rank_6', days: 365, name: { de: 'Legende', en: 'Legend' } },
]

/** Leitern (Spec 3.2): getragen wird die höchste verdiente Stufe, sie steigt von selbst mit. */
export const TITLE_LADDERS = {
  workouts: ['workouts_50', 'workouts_100', 'workouts_250'],
  prs: ['prs_5', 'prs_25', 'prs_100'],
  journal: ['journal_30', 'journal_100', 'journal_365'],
  run: ['run_10', 'run_50', 'run_150'],
  cycle: ['cycle_10', 'cycle_50', 'cycle_150'],
  swim: ['swim_10', 'swim_30', 'swim_100'],
  row: ['row_10', 'row_30', 'row_100'],
  hike: ['hike_10', 'hike_25', 'hike_75'],
  hyrox: ['hyrox_5', 'hyrox_20', 'hyrox_60'],
  hiit: ['hiit_10', 'hiit_50', 'hiit_150'],
  yoga: ['yoga_10', 'yoga_50', 'yoga_150'],
} as const satisfies Record<string, readonly BadgeId[]>

export type LadderId = keyof typeof TITLE_LADDERS

/**
 * Persönliche Titel (Spec 3.3) und ihr Quellfeld: ab Werk aus, Bestätigung je
 * Titel (Einwilligung Art. 9 DSGVO), nie sichtbarer als das Quellfeld.
 */
export const PERSONAL_TITLE_SOURCE = {
  body_fat_5: 'body_fat',
  body_fat_10: 'body_fat',
  body_fat_20: 'body_fat',
  weight_5: 'weight',
  first_bloodwork: 'markers',
  all_markers_in_range: 'in_range',
  resting_hr_5: 'resting_hr',
  intake_all_30: 'adherence',
  first_cycle_done: 'substances',
  first_review: 'reviews',
  sleep_rested_30: 'sleep',
  sleep_rested_100: 'sleep',
  progress_10: 'progress',
  progress_25: 'progress',
  progress_50: 'progress',
} as const satisfies Partial<Record<BadgeId, ProfileField>>

export type PersonalTitleId = keyof typeof PERSONAL_TITLE_SOURCE

/** Titelnamen aller tragbaren Abzeichen (Spec 3.1–3.3, Namen bestätigt 04.11.). */
export const TITLE_NAMES = {
  // 3.1 ohne Stufen
  streak_100: { de: 'Unaufhaltsam', en: 'Unstoppable' },
  streak_365: { de: 'Eiserner Wille', en: 'Iron Will' },
  training_weeks_52: { de: 'Ganzjahres-Athlet', en: 'Year-Round Athlete' },
  friends_10: { de: 'Motivator', en: 'Motivator' },
  steps_weeks_12: { de: 'Schrittmacher', en: 'Pacesetter' },
  entries_1000: { de: 'Datenprofi', en: 'Data Pro' },
  allrounder: { de: 'Allrounder', en: 'All-Rounder' },
  sleep_tracked_30: { de: 'Schlafbeobachter', en: 'Sleep Watcher' },
  // 3.2 Leitern
  workouts_50: { de: 'Fitnessfan', en: 'Fitness Fan' },
  workouts_100: { de: 'Trainingstier', en: 'Workhorse' },
  workouts_250: { de: 'Trainingsmaschine', en: 'Training Machine' },
  prs_5: { de: 'Rekordjäger', en: 'Record Hunter' },
  prs_25: { de: 'Kraftpaket', en: 'Powerhouse' },
  prs_100: { de: 'Kraftmeister', en: 'Strength Master' },
  journal_30: { de: 'Tagebuchschreiber', en: 'Journal Keeper' },
  journal_100: { de: 'Chronist', en: 'Chronicler' },
  journal_365: { de: 'Lebensbuch', en: 'Life Log' },
  run_10: { de: 'Jogger', en: 'Jogger' },
  run_50: { de: 'Läufer', en: 'Runner' },
  run_150: { de: 'Ausdauerläufer', en: 'Endurance Runner' },
  cycle_10: { de: 'Gelegenheitsradler', en: 'Casual Cyclist' },
  cycle_50: { de: 'Radsportler', en: 'Cyclist' },
  cycle_150: { de: 'Kilometerfresser', en: 'Road Warrior' },
  swim_10: { de: 'Schwimmfreund', en: 'Swim Fan' },
  swim_30: { de: 'Schwimmer', en: 'Swimmer' },
  swim_100: { de: 'Bahnenzieher', en: 'Lap Master' },
  row_10: { de: 'Ruderfreund', en: 'Rowing Fan' },
  row_30: { de: 'Ruderer', en: 'Rower' },
  row_100: { de: 'Schlagmann', en: 'Stroke Master' },
  hike_10: { de: 'Wanderfreund', en: 'Trail Friend' },
  hike_25: { de: 'Wanderer', en: 'Hiker' },
  hike_75: { de: 'Gipfelstürmer', en: 'Summit Seeker' },
  hyrox_5: { de: 'Hyrox-Starter', en: 'Hyrox Starter' },
  hyrox_20: { de: 'Hybrid-Athlet', en: 'Hybrid Athlete' },
  hyrox_60: { de: 'Hyrox-Veteran', en: 'Hyrox Veteran' },
  hiit_10: { de: 'Intervall-Starter', en: 'Interval Starter' },
  hiit_50: { de: 'Intervall-Profi', en: 'Interval Pro' },
  hiit_150: { de: 'Pulsjäger', en: 'Pulse Chaser' },
  yoga_10: { de: 'Yoga-Einsteiger', en: 'Yoga Beginner' },
  yoga_50: { de: 'Yogi', en: 'Yogi' },
  yoga_150: { de: 'Zen-Meister', en: 'Zen Master' },
  // 3.3 persönliche
  body_fat_5: { de: 'In Form', en: 'In Shape' },
  body_fat_10: { de: 'Formwandler', en: 'Shape Shifter' },
  body_fat_20: { de: 'Neu geformt', en: 'Reshaped' },
  weight_5: { de: 'Leichter unterwegs', en: 'Lighter Steps' },
  first_bloodwork: { de: 'Werte-Kenner', en: 'Lab Regular' },
  all_markers_in_range: { de: 'Im grünen Bereich', en: 'In the Green' },
  resting_hr_5: { de: 'Ruhepol', en: 'Calm Heart' },
  intake_all_30: { de: 'Konsequent', en: 'Consistent' },
  first_cycle_done: { de: 'Durchgezogen', en: 'Saw It Through' },
  first_review: { de: 'Berichterstatter', en: 'Reporter' },
  sleep_rested_30: { de: 'Ausgeschlafen', en: 'Well Rested' },
  sleep_rested_100: { de: 'Schlafprofi', en: 'Sleep Pro' },
  progress_10: { de: 'Auf Kurs', en: 'On Track' },
  progress_25: { de: 'Im Aufwind', en: 'On the Rise' },
  progress_50: { de: 'Verwandelt', en: 'Transformed' },
} as const satisfies Partial<Record<BadgeId, TitleName>>

export type TitleBadgeId = keyof typeof TITLE_NAMES

/** Tragbare Abzeichen in fester Reihenfolge (wie `profile_title_badge_ids()`). */
export const TITLE_BADGE_IDS = Object.keys(TITLE_NAMES) as TitleBadgeId[]

export const isTitleBadgeId = (v: unknown): v is TitleBadgeId =>
  typeof v === 'string' && Object.hasOwn(TITLE_NAMES, v)

export const isPersonalTitle = (id: BadgeId): id is PersonalTitleId => Object.hasOwn(PERSONAL_TITLE_SOURCE, id)

export const personalTitleSource = (id: BadgeId): ProfileField | null =>
  isPersonalTitle(id) ? PERSONAL_TITLE_SOURCE[id] : null

export function ladderOf(id: BadgeId): LadderId | null {
  for (const [ladder, ids] of Object.entries(TITLE_LADDERS) as [LadderId, readonly BadgeId[]][]) {
    if (ids.includes(id)) return ladder
  }
  return null
}

/** Höchste verdiente Stufe der Leiter von `id`, sonst `id` selbst (wenn verdient) oder null. */
export function wornStage(id: BadgeId, earned: ReadonlySet<BadgeId>): BadgeId | null {
  const ladder = ladderOf(id)
  if (!ladder) return earned.has(id) ? id : null
  const stages = TITLE_LADDERS[ladder] as readonly BadgeId[]
  return [...stages].reverse().find(s => earned.has(s)) ?? null
}

/** Höchster verdienter Rang. */
export function highestRank(earned: ReadonlySet<BadgeId>): BadgeId | null {
  return [...RANK_IDS].reverse().find(id => earned.has(id)) ?? null
}

/** Nächster Rang und wie viele Tage mit Eintrag noch fehlen (eigene Sicht). */
export function nextRank(entryDays: number): { id: BadgeId; missing: number } | null {
  const next = RANKS.find(r => r.days > entryDays)
  return next ? { id: next.id, missing: next.days - entryDays } : null
}

const pick = (name: TitleName, lang: string) => name[lang.toLowerCase().startsWith('de') ? 'de' : 'en']

export function titleName(id: BadgeId, lang: string): string | null {
  const rank = RANKS.find(r => r.id === id)
  if (rank) return pick(rank.name, lang)
  return isTitleBadgeId(id) ? pick(TITLE_NAMES[id], lang) : null
}

/** Was unter dem Namen steht; so liefert es `profile_view`. */
export type ProfileTitle = { kind: 'rank' | 'badge'; id: BadgeId }

export interface TitleSettings {
  /** `profiles.title_choice`: null = Rang tragen. */
  choice: TitleBadgeId | null
  /** `profiles.personal_titles` */
  personalAllowed: boolean
  /** `profiles.title_consents`: persönliche Titel-ID → Tag der Bestätigung. */
  consents: Partial<Record<PersonalTitleId, string>>
}

/**
 * Getragener Titel in der eigenen Sicht — dieselbe Regel wie `profile_view`
 * (dort zusätzlich der Deckel durch das Quellfeld je Betrachter).
 */
export function wornTitle(settings: TitleSettings, earned: ReadonlySet<BadgeId>): ProfileTitle | null {
  const choice = settings.choice
  if (choice) {
    const personalOk = !isPersonalTitle(choice) || (settings.personalAllowed && Object.hasOwn(settings.consents, choice))
    const stage = personalOk ? wornStage(choice, earned) : null
    if (stage) return { kind: 'badge', id: stage }
  }
  const rank = highestRank(earned)
  return rank ? { kind: 'rank', id: rank } : null
}
