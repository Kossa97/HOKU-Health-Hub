/**
 * Workouts aus Apple Health / Health Connect in Einheiten uebersetzen.
 *
 * Rein: kein Plugin-Zugriff, kein Speichern. Das Lesen steckt in
 * `src/lib/health.ts` (`getWorkouts`), das Schreiben macht die Datenschicht.
 */
import type { HealthWorkout } from '../../../lib/health'
import type { SessionKind, SessionSource, TrainingSession } from '../types'

export type HealthImportPlatform = 'ios' | 'android'

export type ImportedSession = Omit<TrainingSession, 'id'>

/** Klein, ohne Leer-/Sonderzeichen: 'Traditional Strength Training' == 'traditionalStrengthTraining'. */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const TEAM_AND_RACKET_SPORTS = [
  'americanfootball', 'australianfootball', 'badminton', 'baseball', 'basketball',
  'cricket', 'curling', 'discsports', 'handball', 'hockey', 'lacrosse', 'pickleball',
  'racquetball', 'rugby', 'soccer', 'softball', 'squash', 'tabletennis', 'tennis',
  'volleyball', 'waterpolo',
]

const OTHER_SPORTS = [
  'boxing', 'kickboxing', 'martialarts', 'wrestling', 'fencing', 'climbing',
  'gymnastics', 'golf', 'skatingsports', 'snowsports', 'downhillskiing',
  'crosscountryskiing', 'snowboarding', 'surfingsports', 'paddlesports',
  'trackandfield', 'equestriansports',
]

/** HKWorkoutActivityType — normalisierter Name → Art. */
const HEALTHKIT_KIND: Record<string, SessionKind> = {
  running: 'run',
  wheelchairrunpace: 'run',
  cycling: 'cycle',
  handcycling: 'cycle',
  swimming: 'swim',
  rowing: 'row',
  walking: 'walk',
  wheelchairwalkpace: 'walk',
  hiking: 'hike',
  traditionalstrengthtraining: 'strength',
  functionalstrengthtraining: 'strength',
  coretraining: 'strength',
  highintensityintervaltraining: 'hiit',
  crosstraining: 'hiit',
  mixedmetaboliccardiotraining: 'hiit',
  mixedcardio: 'hiit',
  jumprope: 'hiit',
  yoga: 'yoga',
  mindandbody: 'yoga',
  pilates: 'mobility',
  barre: 'mobility',
  taichi: 'mobility',
  flexibility: 'mobility',
  preparationandrecovery: 'mobility',
  cooldown: 'mobility',
  ...Object.fromEntries(TEAM_AND_RACKET_SPORTS.map(name => [name, 'sport' as const])),
  ...Object.fromEntries(OTHER_SPORTS.map(name => [name, 'sport' as const])),
}

/**
 * Das HealthKit-Plugin kennt nur die Typen bis iOS 13 beim Namen und meldet
 * neuere (und Cricket) als 'Other'. Fuer die faellt die Zuordnung auf
 * HKWorkoutActivityType.rawValue zurueck.
 */
const HEALTHKIT_KIND_BY_ID: Record<number, SessionKind> = {
  10: 'sport',    // cricket
  79: 'sport',    // pickleball
  80: 'mobility', // cooldown
}

/** Health Connect ExerciseSessionRecord.EXERCISE_TYPE_* → Name (wie EXERCISE_TYPE_INT_TO_STRING_MAP). */
const HEALTH_CONNECT_TYPE_NAMES: Record<number, string> = {
  0: 'other_workout', 2: 'badminton', 4: 'baseball', 5: 'basketball', 8: 'biking',
  9: 'biking_stationary', 10: 'boot_camp', 11: 'boxing', 13: 'calisthenics',
  14: 'cricket', 16: 'dancing', 25: 'elliptical', 26: 'exercise_class', 27: 'fencing',
  28: 'football_american', 29: 'football_australian', 31: 'frisbee_disc', 32: 'golf',
  33: 'guided_breathing', 34: 'gymnastics', 35: 'handball',
  36: 'high_intensity_interval_training', 37: 'hiking', 38: 'ice_hockey',
  39: 'ice_skating', 44: 'martial_arts', 46: 'paddling', 47: 'paragliding',
  48: 'pilates', 50: 'racquetball', 51: 'rock_climbing', 52: 'roller_hockey',
  53: 'rowing', 54: 'rowing_machine', 55: 'rugby', 56: 'running',
  57: 'running_treadmill', 58: 'sailing', 59: 'scuba_diving', 60: 'skating',
  61: 'skiing', 62: 'snowboarding', 63: 'snowshoeing', 64: 'soccer', 65: 'softball',
  66: 'squash', 68: 'stair_climbing', 69: 'stair_climbing_machine',
  70: 'strength_training', 71: 'stretching', 72: 'surfing',
  73: 'swimming_open_water', 74: 'swimming_pool', 75: 'table_tennis', 76: 'tennis',
  78: 'volleyball', 79: 'walking', 80: 'water_polo', 81: 'weightlifting',
  82: 'wheelchair', 83: 'yoga',
}

/** Health Connect — normalisierter Name → Art. */
const HEALTH_CONNECT_KIND: Record<string, SessionKind> = {
  running: 'run',
  runningtreadmill: 'run',
  biking: 'cycle',
  bikingstationary: 'cycle',
  swimmingpool: 'swim',
  swimmingopenwater: 'swim',
  rowing: 'row',
  rowingmachine: 'row',
  walking: 'walk',
  hiking: 'hike',
  snowshoeing: 'hike',
  strengthtraining: 'strength',
  weightlifting: 'strength',
  calisthenics: 'strength',
  highintensityintervaltraining: 'hiit',
  bootcamp: 'hiit',
  yoga: 'yoga',
  pilates: 'mobility',
  stretching: 'mobility',
  ...Object.fromEntries([
    'badminton', 'baseball', 'basketball', 'cricket', 'footballamerican',
    'footballaustralian', 'frisbeedisc', 'handball', 'icehockey', 'racquetball',
    'rollerhockey', 'rugby', 'soccer', 'softball', 'squash', 'tabletennis', 'tennis',
    'volleyball', 'waterpolo', 'boxing', 'martialarts', 'fencing', 'golf',
    'gymnastics', 'rockclimbing', 'iceskating', 'skating', 'skiing', 'snowboarding',
    'surfing', 'paddling',
  ].map(name => [name, 'sport' as const])),
}

function healthKitKind(w: HealthWorkout): SessionKind {
  const kind = HEALTHKIT_KIND[normalize(w.activityType)]
  if (kind) return kind
  if (typeof w.activityId === 'number') return HEALTHKIT_KIND_BY_ID[w.activityId] ?? 'other'
  return 'other'
}

function healthConnectKind(w: HealthWorkout): SessionKind {
  // Zahl ('56'), Konstante ('EXERCISE_TYPE_RUNNING') oder Name ('running').
  const raw = w.activityType.trim()
  const id = /^\d+$/.test(raw) ? Number(raw) : raw === '' ? w.activityId ?? null : null
  const name = id !== null ? HEALTH_CONNECT_TYPE_NAMES[id] ?? '' : raw.replace(/^exercise_type_/i, '')
  return HEALTH_CONNECT_KIND[normalize(name)] ?? 'other'
}

/** Plattform-Aktivitaetstyp → Art der Einheit. Unbekannt → 'other'. */
export function mapActivityType(w: HealthWorkout, platform: HealthImportPlatform): SessionKind {
  return platform === 'ios' ? healthKitKind(w) : healthConnectKind(w)
}

function roundedOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

/** Ein Plattform-Workout als Einheit. Der Titel bleibt leer, den Namen setzt die UI. */
export function mapHealthWorkout(w: HealthWorkout, platform: HealthImportPlatform): ImportedSession {
  const source: SessionSource = platform === 'ios' ? 'healthkit' : 'health_connect'
  const durationS = w.durationS > 0
    ? w.durationS
    : (w.endDate.getTime() - w.startDate.getTime()) / 1000

  return {
    kind: mapActivityType(w, platform),
    title: '',
    startedAt: w.startDate.toISOString(),
    endedAt: w.endDate.toISOString(),
    durationS: roundedOrNull(durationS),
    distanceM: roundedOrNull(w.distanceM),
    kcal: roundedOrNull(w.kcal),
    avgHr: roundedOrNull(w.avgHr),
    rpe: null,
    notes: null,
    routineId: null,
    exercises: [],
    source,
    externalId: w.externalId,
  }
}

/** Ab diesem Anteil gilt ein Plattform-Workout als dieselbe Einheit wie eine in der App erfasste. */
export const OVERLAP_THRESHOLD = 0.5

interface Interval { start: number; end: number }

function intervalOf(s: Pick<TrainingSession, 'startedAt' | 'endedAt' | 'durationS'>): Interval | null {
  const start = Date.parse(s.startedAt)
  if (Number.isNaN(start)) return null
  const end = s.endedAt ? Date.parse(s.endedAt) : s.durationS ? start + s.durationS * 1000 : NaN
  if (Number.isNaN(end) || end <= start) return null
  return { start, end }
}

/**
 * Ueberlappung bezogen auf die LAENGERE der beiden Einheiten. So zaehlt ein
 * 5-Minuten-Auslaufen nicht als Doppel einer 90-Minuten-Einheit, in der es liegt;
 * beide muessen zu mehr als der Haelfte deckungsgleich sein.
 */
export function overlapRatio(a: Interval, b: Interval): number {
  const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start)
  if (overlap <= 0) return 0
  return overlap / Math.max(a.end - a.start, b.end - b.start)
}

export interface HealthEnrichment {
  /** Einheit in der App, die die Uhr parallel aufgezeichnet hat. */
  id: string
  /** Zu setzender Wert; null = Feld nicht anfassen (fehlt in der Uhr oder ist schon gesetzt). */
  kcal: number | null
  avgHr: number | null
}

export interface DedupeResult {
  /** Neu anzulegende Einheiten. */
  create: ImportedSession[]
  /** In der App erfasste Einheiten, denen nur kcal/Puls der Uhr fehlen. */
  enrich: HealthEnrichment[]
  /** Verworfen: schon importiert oder Doppel einer in der App erfassten Einheit. */
  skipped: number
}

const LOGGED_IN_APP: ReadonlySet<SessionSource> = new Set(['manual', 'live'])

/**
 * Trennt neue Plattform-Workouts von bereits bekannten.
 *
 * - Gleiche `externalId` wie eine vorhandene (oder eine fruehere im selben
 *   Stapel): verworfen.
 * - Gleiche Art und > 50 % zeitliche Ueberlappung mit einer manuell/live
 *   erfassten Einheit: nicht angelegt; stattdessen ergaenzt sie dort kcal und
 *   Durchschnittspuls, wo diese noch fehlen. Werte, die der Nutzer selbst
 *   eingetragen hat, werden nie ueberschrieben.
 */
export function dedupeAgainst(existing: TrainingSession[], incoming: ImportedSession[]): DedupeResult {
  const knownIds = new Set(existing.map(s => s.externalId).filter((id): id is string => !!id))
  const logged = existing
    .filter(s => LOGGED_IN_APP.has(s.source))
    .map(s => ({ session: s, interval: intervalOf(s) }))
    .filter((x): x is { session: TrainingSession; interval: Interval } => x.interval !== null)

  const create: ImportedSession[] = []
  const enrichById = new Map<string, HealthEnrichment>()
  let skipped = 0

  for (const item of incoming) {
    if (item.externalId && knownIds.has(item.externalId)) {
      skipped++
      continue
    }
    if (item.externalId) knownIds.add(item.externalId)

    const interval = intervalOf(item)
    let best: { session: TrainingSession; ratio: number } | null = null
    if (interval) {
      for (const candidate of logged) {
        if (candidate.session.kind !== item.kind) continue
        const ratio = overlapRatio(interval, candidate.interval)
        if (ratio > OVERLAP_THRESHOLD && (!best || ratio > best.ratio)) {
          best = { session: candidate.session, ratio }
        }
      }
    }

    if (!best) {
      create.push(item)
      continue
    }

    skipped++
    const target = best.session
    const previous = enrichById.get(target.id)
    const kcal = target.kcal == null ? previous?.kcal ?? item.kcal : null
    const avgHr = target.avgHr == null ? previous?.avgHr ?? item.avgHr : null
    if (kcal != null || avgHr != null) enrichById.set(target.id, { id: target.id, kcal, avgHr })
  }

  return { create, enrich: [...enrichById.values()], skipped }
}
