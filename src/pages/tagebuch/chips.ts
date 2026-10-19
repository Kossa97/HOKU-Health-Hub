/**
 * Chips eines Tagebuch-Eintrags: reine Rechnungen ohne React und Datenbank.
 * Ein Chip ist eine gewählte Wirkung oder Nebenwirkung mit eigener Intensität
 * und Dauer (Tabelle effect_symptoms, supabase-tagebuch-chips.sql).
 */
import {
  SYMPTOMS, fromMinutes, labelIn, symptomLabel, type Symptom, type SymptomKind, type SymptomRow,
} from '../../lib/tagebuch/diary'

export {
  symptomLabel as chipLabel, SYMPTOMS, SYMPTOM_GROUPS, UNIT_MINUTES, WHEEL_MAX, fromMinutes, labelIn, symptomByKey, toMinutes,
} from '../../lib/tagebuch/diary'
export type { Symptom, SymptomKind } from '../../lib/tagebuch/diary'

/** Farbe der Art: grün = Wirkung, orange = Nebenwirkung. */
export const kindColor = (kind: SymptomKind) => kind === 'effect' ? 'var(--lg-good-text)' : 'var(--lg-warn-text)'

type Translate = (key: string, options?: Record<string, unknown>) => string


/** Vorgelesener Text: „Übelkeit, Nebenwirkung, Intensität 3, Dauer 2 Std." — ohne Auswahl nur Name und Art. */
export function chipAria(chip: ChipDraft, selected: boolean, t: Translate, language: string) {
  const parts = [symptomLabel(chip, language), t(chip.kind === 'effect' ? 'wirkung' : 'nebenwirkung')]
  if (selected) {
    parts.push(`${t('tagebuch_intensitaet')} ${chip.severity}`)
    const dur = durationText(chip, t)
    if (dur) parts.push(`${t('dauer')} ${dur}`)
  }
  return parts.join(', ')
}

export type DurationMode = 'set' | 'ongoing' | 'none'

export interface ChipDraft {
  /** Zeilen-ID, wenn der Chip schon gespeichert ist. */
  id?: string
  /** Katalog-Schlüssel; eigene Chips haben stattdessen `customLabel`. */
  key: string | null
  customLabel: string | null
  kind: SymptomKind
  severity: number
  durationMinutes: number | null
  ongoing: boolean
}

export interface ChipRow extends SymptomRow {
  id: string
}

export const chipId = (chip: Pick<ChipDraft, 'key' | 'customLabel' | 'kind'>) =>
  chip.key ? `key:${chip.key}` : `custom:${chip.kind}:${chip.customLabel ?? ''}`

export const fromRow = (row: ChipRow): ChipDraft => ({
  id: row.id, key: row.symptom_key, customLabel: row.custom_label, kind: row.kind,
  severity: row.severity, durationMinutes: row.duration_minutes, ongoing: row.ongoing,
})

/**
 * Chips, wie `save_diary_entry` sie erwartet (supabase-tagebuch-save-rpc.sql):
 * die Funktion ersetzt alle Chips des Eintrags in einer Transaktion, die
 * Reihenfolge der Liste ist die Position. Art und Intensität am Eintrag
 * rechnet sie selbst aus.
 */
export const chipPayload = (chips: readonly ChipDraft[]) => chips.map(chip => ({
  symptom_key: chip.key,
  custom_label: chip.key ? null : (chip.customLabel ?? '').trim(),
  kind: chip.kind,
  severity: chip.severity,
  duration_minutes: chip.ongoing ? null : chip.durationMinutes,
  ongoing: chip.ongoing,
}))

/** Dauer am Chip, z. B. „2 Std.", „hält an" — leer ohne Angabe. */
export function durationText(chip: Pick<ChipDraft, 'durationMinutes' | 'ongoing'>, t: Translate) {
  if (chip.ongoing) return t('tagebuch_haelt_an_kurz')
  if (!chip.durationMinutes) return ''
  const { num, unit } = fromMinutes(chip.durationMinutes)
  return `${num} ${unitLabel(unit, num, t)}`
}

export function unitLabel(unit: number, count: number, t: Translate) {
  return t(['tagebuch_einheit_min', 'tagebuch_einheit_std', 'tagebuch_einheit_tag', 'tagebuch_einheit_woche'][unit], { count })
}

/** Katalog-Chips, deren Name den Suchtext enthält (in der aktuellen Sprache). */
export function matchingSymptoms(term: string, language: string): Symptom[] {
  const needle = term.trim().toLocaleLowerCase(language)
  if (!needle) return [...SYMPTOMS]
  return SYMPTOMS.filter(symptom => labelIn(symptom.label, language).toLocaleLowerCase(language).includes(needle))
}
