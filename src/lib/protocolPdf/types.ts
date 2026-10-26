// Datenmodell für den PDF-Protokoll-Generator.
// Bewusst entkoppelt von den UI-Typen in Protokoll.tsx: der Generator lädt
// seine Daten eigenständig (loadProtocolData) und braucht mehr Spalten
// (Dosis/Methode/Frequenz der Zyklen), als die Dashboard-Ansicht selbst nutzt.

export type PdfLang = 'de' | 'en'

export interface PdfDateRange {
  from: string // yyyy-MM-dd
  to: string   // yyyy-MM-dd
}

export interface PdfProfile {
  display_name: string | null
  username: string | null
  /** Aus dem Geburtsdatum berechnet; sonst die alte Angabe `profiles.age`. */
  age: number | null
  /** Alte Freitext-Angabe (`profiles.gender`), nur wenn bio_sex fehlt. */
  gender: string | null
  /** Biologisches Geschlecht — dieselbe Angabe wie bei den Blutwerten. */
  bio_sex?: 'male' | 'female' | null
  height_cm: number | null
  weight_kg: number | null
}

export interface PdfCycle {
  id: string
  name: string
  stack_item_name: string | null
  dose: number | null
  unit: string | null
  method: string | null
  frequency: string | null
  start_date: string
  end_date: string | null
  active: boolean
}

export interface PdfDoseLog {
  stack_item_id: string | null
  logged_at: string
  taken: boolean | null
}

export interface PdfWeightLog {
  logged_at: string
  weight_kg: number
}

export interface PdfBloodwork {
  tested_at: string
  marker: string
  value: number | string
  unit: string | null
}

/** Eine Zeile je Beobachtung (Chip); ältere Einträge ohne Chips als Ganzes. */
export interface PdfEffect {
  type: 'effect' | 'side_effect'
  /** Titel des Eintrags. */
  description: string
  severity: number
  stack_item_name: string | null
  occurred_at: string
  /** Chip: Katalog-Schlüssel oder eigener Name — fehlen beide, gilt der Titel. */
  symptom_key?: string | null
  custom_label?: string | null
  duration_minutes?: number | null
  ongoing?: boolean
}

export interface PdfReview {
  stack_item_name: string | null
  rating: number
  experience: 'gut' | 'mittel' | 'schlecht' | null
  /** Bewertungen v2 — bei alten Bewertungen leer. */
  wirkung?: number | null
  vertraeglichkeit?: number | null
  wieder_nehmen?: 'ja' | 'unsicher' | 'nein' | null
}

export interface PdfDailyLog {
  log_date: string
  energie: number | null
  schlaf: number | null
  /** Die Metrik, nach der die Sektion heisst — und die bis jetzt fehlte. */
  wohlbefinden: number | null
  libido: number | null
}

/** Alles, was der Renderer für ein vollständiges Protokoll braucht. */
export interface ProtocolData {
  profile: PdfProfile | null
  cycles: PdfCycle[]           // aktive + abgeschlossene, aktive zuerst
  doseLogs: PdfDoseLog[]
  weightLogs: PdfWeightLog[]
  bloodwork: PdfBloodwork[]
  effects: PdfEffect[]
  reviews: PdfReview[]
  dailyLogs: PdfDailyLog[]
  stackItemNames: Map<string, string> // stack_item_id -> display_name (für Adherence pro Substanz)
}

export type SectionId =
  | 'personal'
  | 'summary'
  | 'cycles'
  | 'adherence'
  | 'bloodwork'
  | 'weight'
  | 'wellness'
  | 'effects'
  | 'reviews'
  | 'notes'

export type PdfPresetKind = 'arzt' | 'coach' | 'forum' | 'custom'

export interface PdfBuildOptions {
  lang: PdfLang
  range: PdfDateRange
  sections: SectionId[]   // vom Nutzer gewählte Reihenfolge ist fix (siehe SECTION_ORDER)
  note: string            // Freitext für die "Notizen / Fragen"-Sektion
  /** Steuert Abschnitte und Texte — das visuelle Layout ist für alle Presets gleich. */
  preset?: PdfPresetKind
}
