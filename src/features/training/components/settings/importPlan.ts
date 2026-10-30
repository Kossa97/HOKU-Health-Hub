import {
  UNKNOWN_EXERCISE_PREFIX,
  parseCsv,
  type CsvFormat,
  type ImportedSession,
  type ParseWorkoutCsvResult,
} from '../../lib/csvImport'
import { CUSTOM_PREFIX, normalizeName } from '../../lib/exerciseLookup'
import type { CustomExercise, ExerciseCategory, TrackingMode, TrainingSet } from '../../types'

/**
 * Reine Logik hinter dem Import in den Einstellungen: Vorschau zusammenfassen,
 * unbekannte Uebungen als eigene anlegen und ihre `unknown:<Name>`-Kennungen
 * durch `custom:<id>` ersetzen. Kein React, kein Supabase — dafuer Tests.
 */

export interface ImportPreview {
  format: CsvFormat
  sessionCount: number
  setCount: number
  /** Frueheste und spaeteste Startzeit (ISO), null ohne Einheiten. */
  firstAt: string | null
  lastAt: string | null
  /** Namen ohne Treffer, je normalisiertem Namen nur einmal. */
  unknownExercises: string[]
  /** Anzahl der Parser-Meldungen. Die Texte selbst sind deutsch und gehen nicht in die UI. */
  issueCount: number
}

export function summarizeImport(format: CsvFormat, result: ParseWorkoutCsvResult): ImportPreview {
  let firstAt: string | null = null
  let lastAt: string | null = null
  let firstMs = Infinity
  let lastMs = -Infinity
  let setCount = 0
  for (const session of result.sessions) {
    const ms = Date.parse(session.startedAt)
    if (Number.isFinite(ms)) {
      if (ms < firstMs) { firstMs = ms; firstAt = session.startedAt }
      if (ms > lastMs) { lastMs = ms; lastAt = session.startedAt }
    }
    for (const exercise of session.exercises) setCount += exercise.sets.length
  }
  return {
    format,
    sessionCount: result.sessions.length,
    setCount,
    firstAt,
    lastAt,
    unknownExercises: uniqueNames(result.unknownExercises),
    issueCount: result.errors.length,
  }
}

function uniqueNames(names: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    const key = normalizeName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/**
 * Strong schreibt die Gewichtseinheit nicht in jede Datei. Nur wenn sie fehlt,
 * muss der Nutzer sie waehlen.
 */
export function strongNeedsWeightUnit(text: string): boolean {
  const [header] = parseCsv(text, undefined, 1)
  if (!header) return false
  const keys = new Set(header.fields.map(f => f.trim().toLowerCase().replace(/\s+/g, ' ')))
  if (!keys.has('weight')) return false
  return !['weight (kg)', 'weight (lbs)', 'weight (lb)', 'weight unit'].some(k => keys.has(k))
}

/** Saetze einer Uebung aus allen Einheiten — fuer die Erfassungsart einer neu angelegten Uebung. */
function setsOf(sessions: readonly ImportedSession[], name: string): TrainingSet[] {
  const key = normalizeName(name)
  const sets: TrainingSet[] = []
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const id = exercise.exerciseId
      if (id.startsWith(UNKNOWN_EXERCISE_PREFIX) && normalizeName(id.slice(UNKNOWN_EXERCISE_PREFIX.length)) === key) {
        sets.push(...exercise.sets)
      }
    }
  }
  return sets
}

/**
 * Erfassungsart aus den importierten Saetzen ableiten, damit z. B. ein Lauf
 * nicht als kg × Wdh. angelegt wird und Strecke/Zeit im Logger verschwinden.
 * Ohne eindeutige Daten: kg × Wdh.
 */
export function inferTracking(sets: readonly TrainingSet[]): { tracking: TrackingMode; category: ExerciseCategory } {
  const has = (pick: (s: TrainingSet) => number | null | undefined) => sets.some(s => (pick(s) ?? 0) > 0)
  const weight = has(s => s.weightKg)
  const reps = has(s => s.reps)
  const distance = has(s => s.distanceM)
  const duration = has(s => s.durationS)
  if (distance && !reps) {
    return weight
      ? { tracking: 'weight_distance', category: 'strength' }
      : { tracking: 'distance_duration', category: 'cardio' }
  }
  if (duration && !reps) {
    return { tracking: weight ? 'weight_duration' : 'duration', category: 'strength' }
  }
  return { tracking: 'weight_reps', category: 'strength' }
}

/** Entwurf fuer eine eigene Uebung aus einem unbekannten Namen der Datei. */
export function customExerciseDraft(name: string, sessions: readonly ImportedSession[] = []): Omit<CustomExercise, 'id'> {
  const { tracking, category } = inferTracking(setsOf(sessions, name))
  return {
    name: name.trim().slice(0, 80),
    category,
    equipment: 'other',
    tracking,
    primary: [],
    secondary: [],
  }
}

/**
 * Legt fuer jeden unbekannten Namen eine eigene Uebung an — nacheinander, damit
 * ein Fehler mittendrin nichts doppelt anlegt. `created` (normalisierter Name →
 * ID) ueberlebt einen Fehlversuch: beim zweiten Anlauf wird nichts erneut angelegt.
 */
export async function ensureCustomExercises(
  names: readonly string[],
  created: Map<string, string>,
  create: (name: string) => Promise<Pick<CustomExercise, 'id'>>,
): Promise<Map<string, string>> {
  for (const name of uniqueNames(names)) {
    const key = normalizeName(name)
    if (created.has(key)) continue
    const saved = await create(name)
    created.set(key, saved.id)
  }
  return created
}

/**
 * `unknown:<Name>` durch `custom:<id>` ersetzen. `idByName` ist nach
 * normalisiertem Namen geschluesselt; was dort fehlt, bleibt unveraendert.
 */
export function replaceUnknownExercises(
  sessions: readonly ImportedSession[],
  idByName: ReadonlyMap<string, string>,
): ImportedSession[] {
  return sessions.map(session => {
    let changed = false
    const exercises = session.exercises.map(exercise => {
      if (!exercise.exerciseId.startsWith(UNKNOWN_EXERCISE_PREFIX)) return exercise
      const id = idByName.get(normalizeName(exercise.exerciseId.slice(UNKNOWN_EXERCISE_PREFIX.length)))
      if (!id) return exercise
      changed = true
      return { ...exercise, exerciseId: CUSTOM_PREFIX + id }
    })
    return changed ? { ...session, exercises } : session
  })
}

/** Dateiname fuer den Export, z. B. `HOKU-Training-2026-10-18.csv`. */
export function exportFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `HOKU-Training-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`
}
