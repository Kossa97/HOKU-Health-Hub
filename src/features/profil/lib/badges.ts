/**
 * Die Abzeichen (Teilprojekt 2b, Spec Abschnitt 4): erster Satz, 39 Stueck;
 * dazu der Titel-Zusatz (Spec Titel 2 und 3): sechs Ränge, Sportarten mit
 * drei Stufen und weitere tragbare Abzeichen. Titelnamen stehen in `titles.ts`.
 *
 * Diese Datei ist zum Pflegen gedacht: je Abzeichen Gruppe, Symbol, Name
 * (de/en) und Bedingung. Die Bedingung ist eine reine Funktion ueber
 * `BadgeFacts` (aus den eigenen Daten, `badgeFacts.ts`) und liefert den Tag,
 * an dem das Abzeichen verdient wurde (oder `null`), dazu den Stand fuer die
 * eigene Sicht („41/100“). IDs kommen aus `badgeIds.ts` und werden nie
 * umbenannt; ein neues Abzeichen braucht eine neue ID und eine Migration.
 *
 * Einmal verdient bleibt verdient (`evaluateBadges`): ein Rueckschritt nimmt
 * nichts weg. Andere sehen nur verdiente Abzeichen.
 */
import { BADGE_IDS, BADGES_NEED_FRIENDS, SHOWN_BADGE_GROUPS, SHOWN_BADGE_IDS, type BadgeGroup, type BadgeId } from './badgeIds'
import type { SessionKind } from '../../training/types'
import { RANKS } from './titles'
import { addDays, weekOf, type BloodReport, type DatedValue, type ProgressHistoryEntry } from './progressScore'

// ─── Fakten ─────────────────────────────────────────────────────────────────

/** Alles, woraus die Bedingungen rechnen. Tage als `yyyy-MM-dd`, aufsteigend. */
export interface BadgeFacts {
  today: string
  /** Tage mit eigenem Eintrag (wie der Streak im Profil), ohne Doppelte. */
  entryDays: string[]
  /** Ein Eintrag je Training. */
  sessionDays: string[]
  weightDays: string[]
  /** Tage mit faelliger Einnahme; `all` = alle selbst bestaetigt. */
  intakeDays: { day: string; all: boolean }[]
  dailyLogDays: string[]
  measurementDays: string[]
  bloodReports: BloodReport[]
  /** Ende abgeschlossener Zyklen (bis heute). */
  cycleEndDays: string[]
  /** Erster Tag mit Daten aus Apple Health / Health Connect (oder Einwilligung). */
  wearableSince: string | null
  /** Profil vollstaendig: erfuellte Punkte von allen. */
  profileChecks: { have: number; need: number }
  photoDays: string[]
  reviewDays: string[]
  /** Seit dem Start (fuer −x % relativ wie die Rechnung). */
  bodyFat: DatedValue[]
  weight: DatedValue[]
  /** Tage neuer Bestleistungen (e1RM ueber allem davor, je Uebung). */
  prDays: string[]
  /** Ruhepuls: Start und jetzt aus der Rechnung (nur mit belastbarer Baseline). */
  restingHr: { start: number; now: number } | null
  /** Schritte je Woche (Montag): Mittel ueber Tage mit Daten. */
  stepWeeks: { week: string; avg: number; days: number }[]
  progressTotal: number | null
  history: ProgressHistoryEntry[]
  // ── Titel-Zusatz ──
  /**
   * Tage mit eigenem Eintrag fuer den Rang: wie `entryDays`, aber ohne Einheiten
   * aus Apple Health / Health Connect (Spec Titel 2: nur eigene Einträge).
   */
  ownEntryDays: string[]
  /** Ein Tag je eigenem Eintrag (Doppelte zaehlen mit), fuer „1.000 Einträge“. */
  entryStamps: string[]
  /** Tage der Einheiten je Art, eigene und eingefuehrte (ohne Doppelte ueber `externalId`). */
  sessionsByKind: Partial<Record<SessionKind, string[]>>
  /** Naechte mit Schlaf (Minuten, auch aus Wearables), je Tag eine. */
  sleepNights: { day: string; min: number }[]
}

/** Ergebnis einer Bedingung. `unit` sagt, wie der Stand gezeigt wird. */
export interface BadgeCheck {
  earnedOn: string | null
  have?: number
  need?: number
  unit?: 'count' | 'percent_drop' | 'percent' | 'bpm_drop' | 'steps'
}

export interface BadgeDef {
  id: BadgeId
  group: BadgeGroup
  icon: string
  name: { de: string; en: string }
  check: (f: BadgeFacts) => BadgeCheck
}

// ─── Bausteine ──────────────────────────────────────────────────────────────

const uniqueSorted = (days: readonly string[]) => [...new Set(days)].sort()

/** Tag, an dem die n-te Sache passierte (Doppelte zaehlen mit). */
function nth(days: readonly string[], n: number): BadgeCheck {
  const sorted = [...days].sort()
  return { earnedOn: sorted.length >= n ? sorted[n - 1] : null, have: Math.min(sorted.length, n), need: n, unit: 'count' }
}

const first = (days: readonly string[]): BadgeCheck => ({ earnedOn: [...days].sort()[0] ?? null })

/**
 * Laengste Folge aufeinanderfolgender Einheiten (Tage: Schritt 1, Wochen:
 * Schritt 7). Verdient am Tag, an dem eine Folge `n` erreicht; Stand = laufende
 * Folge (endet heute/gestern bzw. in dieser/letzter Woche).
 */
function run(units: readonly string[], n: number, step: number, today: string, current: string): BadgeCheck {
  const us = uniqueSorted(units)
  let earnedOn: string | null = null
  let len = 0
  for (let i = 0; i < us.length; i++) {
    len = i > 0 && addDays(us[i - 1], step) === us[i] ? len + 1 : 1
    if (len >= n && earnedOn === null) earnedOn = us[i]
  }
  let now = 0
  if (us.length > 0 && (us[us.length - 1] === current || us[us.length - 1] === addDays(current, -step))) now = len
  return { earnedOn: earnedOn && earnedOn > today ? today : earnedOn, have: Math.min(now, n), need: n, unit: 'count' }
}

const dayRun = (days: readonly string[], n: number, today: string) => run(days, n, 1, today, today)

/** Wochenfolge; verdient am ersten Tag (aus `days`) der Woche, die die Folge vollmacht. */
function weekRun(days: readonly string[], n: number, today: string): BadgeCheck {
  const r = run(days.map(weekOf), n, 7, today, weekOf(today))
  if (r.earnedOn === null) return r
  const week = r.earnedOn
  const day = uniqueSorted(days).find(d => weekOf(d) === week) ?? week
  return { ...r, earnedOn: day > today ? today : day }
}

/** Relative Abnahme seit der ersten Messung (wie die Rechnung, Startmessung ≥ 14 Tage davor). */
function dropBy(points: readonly DatedValue[], pct: number): BadgeCheck {
  const ps = [...points].sort((a, b) => a.day.localeCompare(b.day))
  if (ps.length === 0 || ps[0].value <= 0) return { earnedOn: null, have: 0, need: pct, unit: 'percent_drop' }
  const start = ps[0]
  const drop = (v: number) => (start.value - v) / start.value * 100
  const hit = ps.find(p => p.day >= addDays(start.day, 14) && drop(p.value) >= pct - 1e-9)
  const last = ps[ps.length - 1]
  return { earnedOn: hit?.day ?? null, have: Math.round(Math.max(0, drop(last.value)) * 10) / 10, need: pct, unit: 'percent_drop' }
}

function prsInMonth(prDays: readonly string[], n: number, today: string): BadgeCheck {
  const byMonth = new Map<string, string[]>()
  for (const d of [...prDays].sort()) byMonth.set(d.slice(0, 7), [...(byMonth.get(d.slice(0, 7)) ?? []), d])
  const earned = [...byMonth.values()].find(ds => ds.length >= n)
  return { earnedOn: earned ? earned[n - 1] : null, have: Math.min(byMonth.get(today.slice(0, 7))?.length ?? 0, n), need: n, unit: 'count' }
}

function allMarkers(reports: readonly BloodReport[]): BadgeCheck {
  const rs = [...reports].sort((a, b) => a.day.localeCompare(b.day))
  const hit = rs.find(r => r.of > 0 && r.inRange === r.of)
  const last = rs[rs.length - 1]
  return last
    ? { earnedOn: hit?.day ?? null, have: last.inRange, need: last.of, unit: 'count' }
    : { earnedOn: null }
}

function stepsWeek(f: BadgeFacts, goal: number): BadgeCheck {
  // Eine Woche zaehlt mit mindestens 5 Tagen Daten; verdient an ihrem Sonntag (hoechstens heute).
  const hit = f.stepWeeks.find(w => w.days >= 5 && w.avg >= goal)
  const last = f.stepWeeks[f.stepWeeks.length - 1]
  const sunday = hit ? addDays(hit.week, 6) : null
  return { earnedOn: sunday && sunday > f.today ? f.today : sunday, have: last ? Math.round(last.avg) : 0, need: goal, unit: 'steps' }
}

function totalAtLeast(f: BadgeFacts, pct: number): BadgeCheck {
  const week = f.history.find(e => e.total !== null && e.total >= pct)
  let earnedOn = week ? addDays(week.week, 6) : null
  if (earnedOn === null && f.progressTotal !== null && f.progressTotal >= pct) earnedOn = f.today
  if (earnedOn !== null && earnedOn > f.today) earnedOn = f.today
  return { earnedOn, have: f.progressTotal === null ? 0 : Math.round(f.progressTotal * 10) / 10, need: pct, unit: 'percent' }
}

const never = (): BadgeCheck => ({ earnedOn: null })

/** Einheiten einer oder mehrerer Arten (Yoga und Mobility zaehlen zusammen). */
const sessionsOf = (f: BadgeFacts, ...kinds: SessionKind[]) => kinds.flatMap(k => f.sessionsByKind[k] ?? [])

/** Rang: Tage mit eigenem Eintrag, zusammengezaehlt, Luecken erlaubt. */
const rank = (n: number) => (f: BadgeFacts) => nth(uniqueSorted(f.ownEntryDays), n)

/** Sportarten fuer „Allrounder“ (ohne „Sonstiges“); Yoga und Mobility sind eine, wie in ihrer Leiter. */
const ALLROUNDER_SPORTS: readonly (readonly SessionKind[])[] = [
  ['strength'], ['run'], ['cycle'], ['swim'], ['row'], ['walk'], ['hike'], ['hiit'], ['hyrox'], ['yoga', 'mobility'], ['sport'],
]

/** Fuenf Sportarten mit je mindestens zehn Einheiten; verdient, wenn die fuenfte die zehnte erreicht. */
function allrounder(f: BadgeFacts): BadgeCheck {
  const tenth = ALLROUNDER_SPORTS
    .map(kinds => sessionsOf(f, ...kinds).sort()[9])
    .filter((d): d is string => d !== undefined)
    .sort()
  return { earnedOn: tenth.length >= 5 ? tenth[4] : null, have: Math.min(tenth.length, 5), need: 5, unit: 'count' }
}

/** Woche (Montag) mit mindestens 5 Tagen Daten und Mittel ≥ Ziel. */
const goodStepWeek = (w: BadgeFacts['stepWeeks'][number], goal: number) => w.days >= 5 && w.avg >= goal

/** n Wochen in Folge mit Ø ≥ Ziel; verdient am Sonntag der n-ten (hoechstens heute). */
function stepWeeksRun(f: BadgeFacts, n: number, goal: number): BadgeCheck {
  const r = run(f.stepWeeks.filter(w => goodStepWeek(w, goal)).map(w => w.week), n, 7, f.today, weekOf(f.today))
  if (r.earnedOn === null) return r
  const sunday = addDays(r.earnedOn, 6)
  return { ...r, earnedOn: sunday > f.today ? f.today : sunday }
}

/** Naechte mit 7–9 Stunden Schlaf. */
const restedNights = (f: BadgeFacts) => f.sleepNights.filter(s => s.min >= 7 * 60 && s.min <= 9 * 60).map(s => s.day)

// ─── Die Liste ──────────────────────────────────────────────────────────────

const b = (id: BadgeId, group: BadgeGroup, icon: string, de: string, en: string, check: BadgeDef['check']): BadgeDef =>
  ({ id, group, icon, name: { de, en }, check })

const DEFS: readonly BadgeDef[] = [
  // Beständigkeit
  b('streak_7', 'bestaendigkeit', '🔥', '7 Tage ohne Lücke', '7 days in a row', f => dayRun(f.entryDays, 7, f.today)),
  b('streak_30', 'bestaendigkeit', '🔥', '30 Tage ohne Lücke', '30 days in a row', f => dayRun(f.entryDays, 30, f.today)),
  b('streak_100', 'bestaendigkeit', '🔥', '100 Tage ohne Lücke', '100 days in a row', f => dayRun(f.entryDays, 100, f.today)),
  b('streak_365', 'bestaendigkeit', '🔥', '365 Tage ohne Lücke', '365 days in a row', f => dayRun(f.entryDays, 365, f.today)),
  b('training_weeks_4', 'bestaendigkeit', '🏋️', '4 Wochen Training in Folge', '4 training weeks in a row', f => weekRun(f.sessionDays, 4, f.today)),
  b('training_weeks_12', 'bestaendigkeit', '🏋️', '12 Wochen Training in Folge', '12 training weeks in a row', f => weekRun(f.sessionDays, 12, f.today)),
  b('training_weeks_52', 'bestaendigkeit', '🏋️', '52 Wochen Training in Folge', '52 training weeks in a row', f => weekRun(f.sessionDays, 52, f.today)),
  b('intake_all_30', 'bestaendigkeit', '💊', '30 Tage alle Einnahmen bestätigt', '30 days with all doses confirmed',
    f => dayRun(f.intakeDays.filter(d => d.all).map(d => d.day), 30, f.today)),
  b('weighed_weeks_8', 'bestaendigkeit', '⚖️', '8 Wochen jede Woche gewogen', 'Weighed in 8 weeks in a row', f => weekRun(f.weightDays, 8, f.today)),
  // Meilensteine
  b('first_daily_log', 'meilensteine', '✍️', 'Erster Tageseintrag', 'First daily entry', f => first(f.dailyLogDays)),
  b('first_measurement', 'meilensteine', '📏', 'Erste Umfangsmessung', 'First circumference measurement', f => first(f.measurementDays)),
  b('first_bloodwork', 'meilensteine', '🩸', 'Erstes Blutbild', 'First blood test', f => nth(f.bloodReports.map(r => r.day), 1)),
  b('bloodwork_3', 'meilensteine', '🩸', '3 Blutbilder', '3 blood tests', f => nth(f.bloodReports.map(r => r.day), 3)),
  b('workouts_10', 'meilensteine', '🏋️', '10 Workouts', '10 workouts', f => nth(f.sessionDays, 10)),
  b('workouts_50', 'meilensteine', '🏋️', '50 Workouts', '50 workouts', f => nth(f.sessionDays, 50)),
  b('workouts_100', 'meilensteine', '🏋️', '100 Workouts', '100 workouts', f => nth(f.sessionDays, 100)),
  b('workouts_250', 'meilensteine', '🏋️', '250 Workouts', '250 workouts', f => nth(f.sessionDays, 250)),
  b('first_cycle_done', 'meilensteine', '🔁', 'Erster Zyklus abgeschlossen', 'First cycle completed', f => first(f.cycleEndDays)),
  b('wearable_connected', 'meilensteine', '⌚', 'Wearable verbunden', 'Wearable connected',
    f => ({ earnedOn: f.wearableSince && f.wearableSince > f.today ? f.today : f.wearableSince })),
  b('profile_complete', 'meilensteine', '🪪', 'Profil vollständig', 'Profile complete',
    f => ({ earnedOn: f.profileChecks.need > 0 && f.profileChecks.have >= f.profileChecks.need ? f.today : null, ...f.profileChecks, unit: 'count' })),
  b('first_progress_photo', 'meilensteine', '📸', 'Erstes Fortschrittsfoto', 'First progress photo', f => first(f.photoDays)),
  // Fortschritt
  b('body_fat_5', 'fortschritt', '📉', '−5 % Körperfett', '−5% body fat', f => dropBy(f.bodyFat, 5)),
  b('body_fat_10', 'fortschritt', '📉', '−10 % Körperfett', '−10% body fat', f => dropBy(f.bodyFat, 10)),
  b('body_fat_20', 'fortschritt', '📉', '−20 % Körperfett', '−20% body fat', f => dropBy(f.bodyFat, 20)),
  b('weight_5', 'fortschritt', '⚖️', '−5 % Gewicht', '−5% body weight', f => dropBy(f.weight, 5)),
  b('first_pr', 'fortschritt', '🏆', 'Neue Bestleistung', 'New personal record', f => first(f.prDays)),
  b('pr_3_month', 'fortschritt', '🏆', '3 Bestleistungen in einem Monat', '3 personal records in one month', f => prsInMonth(f.prDays, 3, f.today)),
  b('all_markers_in_range', 'fortschritt', '🎯', 'Alle Blutwerte im Zielbereich', 'All blood markers in range', f => allMarkers(f.bloodReports)),
  b('resting_hr_5', 'fortschritt', '❤️', 'Ruhepuls −5 bpm', 'Resting heart rate −5 bpm', f => {
    const drop = f.restingHr ? Math.round((f.restingHr.start - f.restingHr.now) * 10) / 10 : 0
    return { earnedOn: drop >= 5 ? f.today : null, have: Math.max(0, drop), need: 5, unit: 'bpm_drop' }
  }),
  b('steps_week_10k', 'fortschritt', '🚶', 'Eine Woche Ø 10.000 Schritte', 'A week averaging 10,000 steps', f => stepsWeek(f, 10_000)),
  b('progress_10', 'fortschritt', '📈', 'Gesamtfortschritt +10 %', 'Overall progress +10%', f => totalAtLeast(f, 10)),
  b('progress_25', 'fortschritt', '📈', 'Gesamtfortschritt +25 %', 'Overall progress +25%', f => totalAtLeast(f, 25)),
  b('progress_50', 'fortschritt', '📈', 'Gesamtfortschritt +50 %', 'Overall progress +50%', f => totalAtLeast(f, 50)),
  // Gemeinschaft
  b('first_review', 'gemeinschaft', '📝', 'Erster Erfahrungsbericht', 'First experience report', f => nth(f.reviewDays, 1)),
  b('reviews_5', 'gemeinschaft', '📝', '5 Erfahrungsberichte', '5 experience reports', f => nth(f.reviewDays, 5)),
  b('reviews_25', 'gemeinschaft', '📝', '25 Erfahrungsberichte', '25 experience reports', f => nth(f.reviewDays, 25)),
  // Verdient beim Teilen selbst (`awardBadge`), nicht aus Daten
  b('profile_shared', 'gemeinschaft', '🔗', 'Profil geteilt', 'Profile shared', never),
  b('first_friend', 'gemeinschaft', '👥', 'Erster Freund', 'First friend', never),
  b('friends_10', 'gemeinschaft', '👥', '10 Freunde', '10 friends', never),

  // ── Titel-Zusatz (Spec Titel 3) ──
  b('steps_weeks_12', 'bestaendigkeit', '🚶', '12 Wochen Ø 10.000 Schritte', '12 weeks averaging 10,000 steps', f => stepWeeksRun(f, 12, 10_000)),
  b('journal_30', 'bestaendigkeit', '📔', '30 Tage Tagebuch', '30 journal days', f => nth(uniqueSorted(f.dailyLogDays), 30)),
  b('journal_100', 'bestaendigkeit', '📔', '100 Tage Tagebuch', '100 journal days', f => nth(uniqueSorted(f.dailyLogDays), 100)),
  b('journal_365', 'bestaendigkeit', '📔', '365 Tage Tagebuch', '365 journal days', f => nth(uniqueSorted(f.dailyLogDays), 365)),
  b('sleep_tracked_30', 'bestaendigkeit', '🌙', '30 Nächte Schlaf getrackt', '30 nights of sleep tracked', f => nth(f.sleepNights.map(s => s.day), 30)),
  b('entries_1000', 'meilensteine', '🗂️', '1.000 Einträge', '1,000 entries', f => nth(f.entryStamps, 1000)),
  b('prs_5', 'fortschritt', '🏆', '5 Bestleistungen', '5 personal records', f => nth(f.prDays, 5)),
  b('prs_25', 'fortschritt', '🏆', '25 Bestleistungen', '25 personal records', f => nth(f.prDays, 25)),
  b('prs_100', 'fortschritt', '🏆', '100 Bestleistungen', '100 personal records', f => nth(f.prDays, 100)),
  b('sleep_rested_30', 'fortschritt', '😴', '30 Nächte mit 7–9 Stunden Schlaf', '30 nights with 7–9 hours of sleep', f => nth(restedNights(f), 30)),
  b('sleep_rested_100', 'fortschritt', '😴', '100 Nächte mit 7–9 Stunden Schlaf', '100 nights with 7–9 hours of sleep', f => nth(restedNights(f), 100)),
  // Sportarten: eigene und aus Apple Health / Health Connect eingefuehrte Einheiten
  b('run_10', 'sport', '🏃', '10 Läufe', '10 runs', f => nth(sessionsOf(f, 'run'), 10)),
  b('run_50', 'sport', '🏃', '50 Läufe', '50 runs', f => nth(sessionsOf(f, 'run'), 50)),
  b('run_150', 'sport', '🏃', '150 Läufe', '150 runs', f => nth(sessionsOf(f, 'run'), 150)),
  b('cycle_10', 'sport', '🚴', '10 Radfahrten', '10 rides', f => nth(sessionsOf(f, 'cycle'), 10)),
  b('cycle_50', 'sport', '🚴', '50 Radfahrten', '50 rides', f => nth(sessionsOf(f, 'cycle'), 50)),
  b('cycle_150', 'sport', '🚴', '150 Radfahrten', '150 rides', f => nth(sessionsOf(f, 'cycle'), 150)),
  b('swim_10', 'sport', '🏊', '10 Schwimmeinheiten', '10 swims', f => nth(sessionsOf(f, 'swim'), 10)),
  b('swim_30', 'sport', '🏊', '30 Schwimmeinheiten', '30 swims', f => nth(sessionsOf(f, 'swim'), 30)),
  b('swim_100', 'sport', '🏊', '100 Schwimmeinheiten', '100 swims', f => nth(sessionsOf(f, 'swim'), 100)),
  b('row_10', 'sport', '🚣', '10 Rudereinheiten', '10 rowing sessions', f => nth(sessionsOf(f, 'row'), 10)),
  b('row_30', 'sport', '🚣', '30 Rudereinheiten', '30 rowing sessions', f => nth(sessionsOf(f, 'row'), 30)),
  b('row_100', 'sport', '🚣', '100 Rudereinheiten', '100 rowing sessions', f => nth(sessionsOf(f, 'row'), 100)),
  b('hike_10', 'sport', '🥾', '10 Wanderungen', '10 hikes', f => nth(sessionsOf(f, 'hike'), 10)),
  b('hike_25', 'sport', '🥾', '25 Wanderungen', '25 hikes', f => nth(sessionsOf(f, 'hike'), 25)),
  b('hike_75', 'sport', '🥾', '75 Wanderungen', '75 hikes', f => nth(sessionsOf(f, 'hike'), 75)),
  b('hyrox_5', 'sport', '🏁', '5 Hyrox-Einheiten', '5 Hyrox sessions', f => nth(sessionsOf(f, 'hyrox'), 5)),
  b('hyrox_20', 'sport', '🏁', '20 Hyrox-Einheiten', '20 Hyrox sessions', f => nth(sessionsOf(f, 'hyrox'), 20)),
  b('hyrox_60', 'sport', '🏁', '60 Hyrox-Einheiten', '60 Hyrox sessions', f => nth(sessionsOf(f, 'hyrox'), 60)),
  b('hiit_10', 'sport', '⚡', '10 HIIT-Einheiten', '10 HIIT sessions', f => nth(sessionsOf(f, 'hiit'), 10)),
  b('hiit_50', 'sport', '⚡', '50 HIIT-Einheiten', '50 HIIT sessions', f => nth(sessionsOf(f, 'hiit'), 50)),
  b('hiit_150', 'sport', '⚡', '150 HIIT-Einheiten', '150 HIIT sessions', f => nth(sessionsOf(f, 'hiit'), 150)),
  b('yoga_10', 'sport', '🧘', '10 Yoga- oder Mobility-Einheiten', '10 yoga or mobility sessions', f => nth(sessionsOf(f, 'yoga', 'mobility'), 10)),
  b('yoga_50', 'sport', '🧘', '50 Yoga- oder Mobility-Einheiten', '50 yoga or mobility sessions', f => nth(sessionsOf(f, 'yoga', 'mobility'), 50)),
  b('yoga_150', 'sport', '🧘', '150 Yoga- oder Mobility-Einheiten', '150 yoga or mobility sessions', f => nth(sessionsOf(f, 'yoga', 'mobility'), 150)),
  b('allrounder', 'sport', '🎽', '5 Sportarten mit je 10 Einheiten', '5 sports with 10 sessions each', allrounder),
  // Ränge (Spec Titel 2): Tage mit eigenem Eintrag; erscheinen nie in der Abzeichen-Liste
  ...RANKS.map(r => b(r.id, 'rang', '✦', r.name.de, r.name.en, rank(r.days))),
]

export const BADGE_BY_ID: Readonly<Record<BadgeId, BadgeDef>> =
  Object.fromEntries(DEFS.map(d => [d.id, d])) as Record<BadgeId, BadgeDef>

/** Alle Abzeichen in der Reihenfolge von `BADGE_IDS` (nach Gruppe). */
export const BADGES: readonly BadgeDef[] = BADGE_IDS.map(id => BADGE_BY_ID[id])

/** Gruppen der Abzeichen-Liste, ohne `rang`. */
export const BADGE_GROUPS: readonly BadgeGroup[] = SHOWN_BADGE_GROUPS

export const needsFriends = (id: BadgeId) => BADGES_NEED_FRIENDS.includes(id)

export const badgeName = (id: BadgeId, lang: string) =>
  BADGE_BY_ID[id].name[lang.toLowerCase().startsWith('de') ? 'de' : 'en']

// ─── Auswertung ─────────────────────────────────────────────────────────────

export interface BadgeState extends BadgeCheck {
  id: BadgeId
  /** Verdient (gespeichert oder jetzt erfuellt). */
  earned: boolean
  /** Tag des Erhalts, wenn verdient. */
  on: string | null
}

export interface BadgeEvaluation {
  states: BadgeState[]
  /** Gespeicherte + neu verdiente: ID → Tag. */
  earned: Partial<Record<BadgeId, string>>
  /** Neu verdiente seit dem gespeicherten Stand. */
  added: BadgeId[]
}

/** Rechnet alle Bedingungen; einmal verdient bleibt verdient, mit dem gespeicherten Tag. */
export function evaluateBadges(facts: BadgeFacts, stored: Partial<Record<BadgeId, string>>): BadgeEvaluation {
  const earned: Partial<Record<BadgeId, string>> = { ...stored }
  const added: BadgeId[] = []
  const states = BADGE_IDS.map((id): BadgeState => {
    const check = needsFriends(id) ? { earnedOn: null } : BADGE_BY_ID[id].check(facts)
    const on = stored[id] ?? check.earnedOn
    if (on && !stored[id]) {
      earned[id] = on
      added.push(id)
    }
    return { ...check, id, earned: on !== null, on }
  })
  return { states, earned, added }
}

/** Verdiente Abzeichen, zuletzt verdiente zuerst (Schnappschuss und Profilzeile); ohne Ränge. */
export function earnedOrder(earned: Partial<Record<BadgeId, string>>): BadgeId[] {
  const order = new Map(SHOWN_BADGE_IDS.map((id, i) => [id, i]))
  return (Object.entries(earned) as [BadgeId, string][])
    .filter(([id]) => order.has(id))
    .sort(([a, da], [b2, db]) => db.localeCompare(da) || order.get(b2)! - order.get(a)!)
    .map(([id]) => id)
}
