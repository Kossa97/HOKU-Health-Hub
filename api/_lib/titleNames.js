// Titelnamen für die Link-Karte (Spec `docs/superpowers/specs/2026-11-03-profil-titel-design.md`
// 2, 3.1, 3.2 und 5). `api/` kann kein TypeScript laden, daher eine Abschrift aus
// `src/features/profil/lib/titles.ts`; `titleNames.parity.test.js` prüft Gleichheit.
//
// Nur, was das Web zeigen darf: die Ränge und die tragbaren Abzeichen ohne die
// persönlichen Titel (Spec 3.3: im Web und auf der Link-Karte nie). Liefert
// `profile_view` trotzdem eine andere ID, gibt es keinen Chip.

/** Ränge (Spec 2), `rank_1` … `rank_6`. */
export const RANK_TITLE_NAMES = {
  rank_1: { de: 'Neuling', en: 'Newcomer' },
  rank_2: { de: 'Entdecker', en: 'Explorer' },
  rank_3: { de: 'Dranbleiber', en: 'Committed' },
  rank_4: { de: 'Routinier', en: 'Steady' },
  rank_5: { de: 'Veteran', en: 'Veteran' },
  rank_6: { de: 'Legende', en: 'Legend' },
}

/** Tragbare Abzeichen (Spec 3.1, 3.2), ohne persönliche Titel. */
export const BADGE_TITLE_NAMES = {
  streak_100: { de: 'Unaufhaltsam', en: 'Unstoppable' },
  streak_365: { de: 'Eiserner Wille', en: 'Iron Will' },
  training_weeks_52: { de: 'Ganzjahres-Athlet', en: 'Year-Round Athlete' },
  friends_10: { de: 'Motivator', en: 'Motivator' },
  steps_weeks_12: { de: 'Schrittmacher', en: 'Pacesetter' },
  entries_1000: { de: 'Datenprofi', en: 'Data Pro' },
  allrounder: { de: 'Allrounder', en: 'All-Rounder' },
  sleep_tracked_30: { de: 'Schlafbeobachter', en: 'Sleep Watcher' },
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
}

/**
 * `fields.title` aus `profile_view` (`{ kind: 'rank'|'badge', id }`) → Name in
 * `lang` (de, sonst en). Rang nur mit Rang-ID, Abzeichen nur mit tragbarer,
 * nicht persönlicher ID; alles andere → null (kein Chip).
 */
export function webTitleName(raw, lang) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null
  const list = raw.kind === 'rank' ? RANK_TITLE_NAMES : raw.kind === 'badge' ? BADGE_TITLE_NAMES : null
  if (!list || !Object.hasOwn(list, raw.id)) return null
  return list[raw.id][lang === 'de' ? 'de' : 'en']
}
