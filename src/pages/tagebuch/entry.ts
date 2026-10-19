import type { ChipRow, SymptomKind } from './chips'
import type { IntakeOption } from './intake'

/** Ein Tagebuch-Eintrag mit seinen Chips, wie die Liste ihn lädt. */
export interface DiaryEntry {
  id: string
  /** Titel (Pflicht). */
  description: string
  /** Nur noch für ältere Einträge ohne Chips und als Zusammenfassung. */
  type: SymptomKind | null
  severity: number | null
  duration: string | null
  occurred_at: string
  notes: string | null
  stack_item_id: string | null
  stack_items: { display_name: string } | null
  dose_log_id: string | null
  dose_logs: Omit<IntakeOption, 'id'> | null
  effect_symptoms: ChipRow[]
}

export const ENTRY_SELECT =
  '*, stack_items(display_name), dose_logs(dose, unit, logged_at), effect_symptoms(id, symptom_key, custom_label, kind, severity, duration_minutes, ongoing, position)'

export const sortedChips = (entry: Pick<DiaryEntry, 'effect_symptoms'>) =>
  [...(entry.effect_symptoms ?? [])].sort((a, b) => a.position - b.position)
