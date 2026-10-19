/**
 * Tagebuch ohne React und ohne Datenbank — von Formular, Auswertung,
 * Protokoll und PDF gemeinsam genutzt. Ein Eintrag besteht aus Chips
 * (Tabelle effect_symptoms); jeder Chip ist eine Beobachtung.
 */
import { SYMPTOMS, SYMPTOM_GROUPS, type Symptom, type SymptomKind } from './symptomCatalog.data'

export { SYMPTOMS, SYMPTOM_GROUPS }
export type { Symptom, SymptomKind }

const BY_KEY = new Map(SYMPTOMS.map(symptom => [symptom.key, symptom]))

export const symptomByKey = (key: string): Symptom | undefined => BY_KEY.get(key)

/** Deutsch für de, sonst Englisch — die übrigen Sprachen folgen später. */
export const labelIn = (label: { de: string; en: string }, language: string) =>
  language.startsWith('de') ? label.de : label.en

/** Name eines Chips; ein unbekannter Schlüssel zeigt sich selbst statt zu verschwinden. */
export const symptomLabel = (chip: { key: string | null; customLabel: string | null }, language: string) =>
  chip.key ? labelIn(symptomByKey(chip.key)?.label ?? { de: chip.key, en: chip.key }, language) : chip.customLabel ?? ''

/** Einheiten des Picker-Rads: Minuten, Stunden, Tage, Wochen. */
export const UNIT_MINUTES = [1, 60, 1440, 10080] as const
export const WHEEL_MAX = 59

export const toMinutes = (num: number, unit: number) => num * UNIT_MINUTES[unit]

/** Zahl und Einheit zu gespeicherten Minuten — die größte Einheit, die glatt aufgeht. */
export function fromMinutes(minutes: number): { num: number; unit: number } {
  for (let unit = UNIT_MINUTES.length - 1; unit >= 0; unit--) {
    const num = minutes / UNIT_MINUTES[unit]
    if (Number.isInteger(num) && num >= 1 && num <= WHEEL_MAX) return { num, unit }
  }
  // Kommt vom Rad nicht vor (z. B. 90 Min.): auf die größte passende Einheit runden.
  const unit = Math.max(0, UNIT_MINUTES.findLastIndex(size => minutes >= size))
  return { num: Math.min(WHEEL_MAX, Math.max(1, Math.round(minutes / UNIT_MINUTES[unit]))), unit }
}

/** Ein Chip, wie ihn die Datenbank einbettet (`effect_symptoms(...)`). */
export interface SymptomRow {
  symptom_key: string | null
  custom_label: string | null
  kind: SymptomKind
  severity: number
  duration_minutes: number | null
  ongoing: boolean
  position: number
}

/** Eine Beobachtung: ein Chip, oder ein älterer Eintrag ohne Chips als Ganzes. */
export interface Observation {
  key: string | null
  customLabel: string | null
  kind: SymptomKind
  severity: number
  durationMinutes: number | null
  ongoing: boolean
}

/**
 * Die Beobachtungen eines Eintrags in Chip-Reihenfolge. Ältere Einträge ohne
 * Chips zählen einmal mit Art, Intensität und Titel; ohne Art keine.
 */
export function observationsOf(entry: {
  type: SymptomKind | null
  severity: number | null
  description: string
  effect_symptoms?: SymptomRow[] | null
}): Observation[] {
  const rows = entry.effect_symptoms ?? []
  if (rows.length) {
    return [...rows].sort((a, b) => a.position - b.position).map(row => ({
      key: row.symptom_key, customLabel: row.custom_label, kind: row.kind, severity: row.severity,
      durationMinutes: row.ongoing ? null : row.duration_minutes, ongoing: row.ongoing,
    }))
  }
  if (!entry.type || !entry.severity) return []
  return [{ key: null, customLabel: entry.description.trim(), kind: entry.type, severity: entry.severity, durationMinutes: null, ongoing: false }]
}

/** Katalog-Namen (de und en, ohne Groß/Klein) zum Schlüssel. */
const KEY_BY_LABEL = new Map(SYMPTOMS.flatMap(symptom =>
  [symptom.label.de, symptom.label.en].map(label => [label.toLowerCase(), symptom.key] as const)))

/**
 * Gleiche Beobachtung erkennen: Katalog-Schlüssel; ein eigener Name, der wie
 * ein Katalog-Chip heißt („Rötung"), zählt zu diesem — sonst der Name ohne Groß/Klein.
 */
export function observationGroup(observation: Pick<Observation, 'key' | 'customLabel'>) {
  if (observation.key) return `key:${observation.key}`
  const name = (observation.customLabel ?? '').trim().toLowerCase()
  const key = KEY_BY_LABEL.get(name)
  return key ? `key:${key}` : `custom:${name}`
}

/** Spalten für `effect_symptoms(...)` in Abfragen, die Beobachtungen brauchen. */
export const SYMPTOM_COLUMNS = 'symptom_key, custom_label, kind, severity, duration_minutes, ongoing, position'
