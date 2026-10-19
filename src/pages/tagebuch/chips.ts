/**
 * Chips eines Tagebuch-Eintrags: reine Rechnungen ohne React und Datenbank.
 * Ein Chip ist eine gewählte Wirkung oder Nebenwirkung mit eigener Intensität
 * und Dauer (Tabelle effect_symptoms, supabase-tagebuch-chips.sql).
 */
import { SYMPTOMS, SYMPTOM_GROUPS, type Symptom, type SymptomKind } from './symptomCatalog.data'

export { SYMPTOMS, SYMPTOM_GROUPS }
export type { Symptom, SymptomKind }

const BY_KEY = new Map(SYMPTOMS.map(symptom => [symptom.key, symptom]))

/** Farbe der Art: grün = Wirkung, orange = Nebenwirkung. */
export const kindColor = (kind: SymptomKind) => kind === 'effect' ? 'var(--lg-good-text)' : 'var(--lg-warn-text)'

export const symptomByKey = (key: string): Symptom | undefined => BY_KEY.get(key)

/** Deutsch für de, sonst Englisch — die übrigen Sprachen folgen später. */
export const labelIn = (label: { de: string; en: string }, language: string) =>
  language.startsWith('de') ? label.de : label.en

type Translate = (key: string, options?: Record<string, unknown>) => string

/** Name eines Chips; ein unbekannter Schlüssel zeigt sich selbst statt zu verschwinden. */
export const chipLabel = (chip: Pick<ChipDraft, 'key' | 'customLabel'>, language: string) =>
  chip.key ? labelIn(symptomByKey(chip.key)?.label ?? { de: chip.key, en: chip.key }, language) : chip.customLabel ?? ''

/** Vorgelesener Text: „Übelkeit, Nebenwirkung, Intensität 3, Dauer 2 Std." — ohne Auswahl nur Name und Art. */
export function chipAria(chip: ChipDraft, selected: boolean, t: Translate, language: string) {
  const parts = [chipLabel(chip, language), t(chip.kind === 'effect' ? 'wirkung' : 'nebenwirkung')]
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

export interface ChipRow {
  id: string
  symptom_key: string | null
  custom_label: string | null
  kind: SymptomKind
  severity: number
  duration_minutes: number | null
  ongoing: boolean
  position: number
}

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

export const chipId = (chip: Pick<ChipDraft, 'key' | 'customLabel' | 'kind'>) =>
  chip.key ? `key:${chip.key}` : `custom:${chip.kind}:${chip.customLabel ?? ''}`

export const fromRow = (row: ChipRow): ChipDraft => ({
  id: row.id, key: row.symptom_key, customLabel: row.custom_label, kind: row.kind,
  severity: row.severity, durationMinutes: row.duration_minutes, ongoing: row.ongoing,
})

const toRow = (chip: ChipDraft, position: number) => ({
  symptom_key: chip.key,
  custom_label: chip.key ? null : (chip.customLabel ?? '').trim(),
  kind: chip.kind,
  severity: chip.severity,
  duration_minutes: chip.ongoing ? null : chip.durationMinutes,
  ongoing: chip.ongoing,
  position,
})

const ROW_FIELDS = ['symptom_key', 'custom_label', 'kind', 'severity', 'duration_minutes', 'ongoing', 'position'] as const

/**
 * Was beim Speichern geschieht: entfernte Chips löschen, geänderte
 * aktualisieren, neue anlegen. Gelöscht wird zuerst, damit ein entfernter
 * und wieder gewählter Katalog-Chip nicht an der Eindeutigkeit scheitert.
 */
export function planChipSave(saved: readonly ChipRow[], drafts: readonly ChipDraft[], effectId: string, userId: string) {
  const byId = new Map(saved.map(row => [row.id, row]))
  const keep = new Set(drafts.map(chip => chip.id).filter((id): id is string => !!id))
  return {
    remove: saved.filter(row => !keep.has(row.id)).map(row => row.id),
    update: drafts.flatMap((chip, position) => {
      const before = chip.id ? byId.get(chip.id) : undefined
      if (!before) return []
      const row = toRow(chip, position)
      return ROW_FIELDS.every(field => row[field] === before[field]) ? [] : [{ id: before.id, ...row }]
    }),
    insert: drafts.flatMap((chip, position) => chip.id && byId.has(chip.id)
      ? [] : [{ effect_id: effectId, user_id: userId, ...toRow(chip, position) }]),
  }
}

/**
 * Art und Intensität am Eintrag selbst — für Sortierung und die bisherige
 * Auswertung: die stärkste Intensität; die Art nur, wenn alle Chips sie teilen.
 */
export function entrySummary(chips: readonly Pick<ChipDraft, 'kind' | 'severity'>[]) {
  if (!chips.length) return { type: null, severity: null }
  const kinds = new Set(chips.map(chip => chip.kind))
  return {
    type: kinds.size === 1 ? chips[0].kind : null,
    severity: Math.max(...chips.map(chip => chip.severity)),
  }
}

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
