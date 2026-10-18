import { EXERCISE_CATALOG } from '../data/exercises'
import type { CatalogExercise, CustomExercise, Equipment, ExerciseCategory, MuscleGroup, TrackingMode } from '../types'

/**
 * Eine Uebung nachschlagen — egal ob aus dem Katalog oder selbst angelegt.
 * Saetze verweisen auf `bench_press_barbell` (Katalog) oder `custom:<uuid>`.
 */

export interface ExerciseInfo {
  id: string
  name: string
  category: ExerciseCategory
  equipment: Equipment
  tracking: TrackingMode
  primary: MuscleGroup[]
  secondary: MuscleGroup[]
  custom: boolean
}

export const CUSTOM_PREFIX = 'custom:'

const CATALOG_BY_ID = new Map<string, CatalogExercise>(EXERCISE_CATALOG.map(ex => [ex.id, ex]))

/** Kleinbuchstaben, ohne Akzente und Satzzeichen — fuer Suche und CSV-Abgleich. */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const CATALOG_BY_NAME = new Map<string, string>()
for (const ex of EXERCISE_CATALOG) {
  for (const name of [ex.name.de, ex.name.en, ...(ex.aliases ?? [])]) {
    const key = normalizeName(name)
    if (!CATALOG_BY_NAME.has(key)) CATALOG_BY_NAME.set(key, ex.id)
  }
}

export function catalogExercise(id: string): CatalogExercise | undefined {
  return CATALOG_BY_ID.get(id)
}

export function exerciseInfo(
  id: string,
  lang: 'de' | 'en',
  custom: readonly CustomExercise[],
): ExerciseInfo | null {
  if (id.startsWith(CUSTOM_PREFIX)) {
    const own = custom.find(ex => ex.id === id.slice(CUSTOM_PREFIX.length))
    if (!own) return null
    return { ...own, id, custom: true }
  }
  const ex = CATALOG_BY_ID.get(id)
  if (!ex) return null
  return {
    id: ex.id, name: ex.name[lang], category: ex.category, equipment: ex.equipment,
    tracking: ex.tracking, primary: ex.primary, secondary: ex.secondary, custom: false,
  }
}

/** Erfassungsart einer Uebung, unabhaengig von der Sprache; null = unbekannt. */
export function exerciseTracking(id: string, custom: readonly CustomExercise[]): TrackingMode | null {
  return exerciseInfo(id, 'en', custom)?.tracking ?? null
}

/** Anzeigename; unbekannte Kennungen (geloeschte eigene Uebung) bleiben lesbar. */
export function exerciseName(id: string, lang: 'de' | 'en', custom: readonly CustomExercise[]): string {
  const info = exerciseInfo(id, lang, custom)
  if (info) return info.name
  if (id.startsWith('unknown:')) return id.slice('unknown:'.length)
  return id.startsWith(CUSTOM_PREFIX) ? '—' : id.replace(/_/g, ' ')
}

/** Fuer den CSV-Import: Katalog-Kennung zu einem Namen aus Hevy/Strong, oder eine eigene Uebung gleichen Namens. */
export function resolveExerciseName(name: string, custom: readonly CustomExercise[]): string | null {
  const key = normalizeName(name)
  const fromCatalog = CATALOG_BY_NAME.get(key)
  if (fromCatalog) return fromCatalog
  const own = custom.find(ex => normalizeName(ex.name) === key)
  return own ? CUSTOM_PREFIX + own.id : null
}

/** Alle Uebungen fuer die Auswahl, eigene zuerst. */
export function allExercises(lang: 'de' | 'en', custom: readonly CustomExercise[]): ExerciseInfo[] {
  const own = custom.map(ex => ({ ...ex, id: CUSTOM_PREFIX + ex.id, custom: true }))
  const catalog = EXERCISE_CATALOG.map(ex => ({
    id: ex.id, name: ex.name[lang], category: ex.category, equipment: ex.equipment,
    tracking: ex.tracking, primary: ex.primary, secondary: ex.secondary, custom: false,
  }))
  return [...own, ...catalog.sort((a, b) => a.name.localeCompare(b.name, lang))]
}

/** Suche ueber Namen beider Sprachen und Aliase; jedes Wort muss vorkommen. */
export function matchesSearch(id: string, query: string, lang: 'de' | 'en', custom: readonly CustomExercise[]): boolean {
  const words = normalizeName(query).split(' ').filter(Boolean)
  if (words.length === 0) return true
  const ex = CATALOG_BY_ID.get(id)
  const haystack = normalizeName(ex
    ? [ex.name.de, ex.name.en, ...(ex.aliases ?? [])].join(' ')
    : exerciseName(id, lang, custom))
  return words.every(word => haystack.includes(word))
}

/** Gewicht spielt eine Rolle (Spalte kg/lb)? */
export function usesWeight(tracking: TrackingMode): boolean {
  return tracking === 'weight_reps' || tracking === 'bodyweight_reps' || tracking === 'assisted_reps'
    || tracking === 'weight_duration' || tracking === 'weight_distance'
}

export function usesReps(tracking: TrackingMode): boolean {
  return tracking === 'weight_reps' || tracking === 'bodyweight_reps' || tracking === 'assisted_reps' || tracking === 'reps'
}

export function usesDuration(tracking: TrackingMode): boolean {
  return tracking === 'duration' || tracking === 'weight_duration' || tracking === 'distance_duration'
}

export function usesDistance(tracking: TrackingMode): boolean {
  return tracking === 'distance_duration' || tracking === 'weight_distance'
}
