import type { MeasurementSite } from './lib/measurements'

export type SubstanceMode = 'cycle' | 'ongoing'

export interface DateRange {
  from: string
  to: string
}

export interface CycleRow {
  id: string
  stack_item_id: string
  name: string
  start_date: string
  end_date: string | null
  active: boolean
  stack_items: { display_name: string } | { display_name: string }[] | null
}

export interface CycleSubstance {
  id: string
  name: string
  mode: 'cycle'
  startDate: string
  endDate: string | null
  active: boolean
  color: string
  stackItemId: string
}

export interface OngoingSubstance {
  id: string
  name: string
  mode: 'ongoing'
  startDate: string
  color: string
}

export type ActiveSubstance = CycleSubstance | OngoingSubstance

export interface DailyLogEntry {
  log_date: string
  energie: number | null
  schlaf: number | null
  wohlbefinden: number | null
  libido: number | null
  body_fat_pct: number | null
  /** Fehlt, solange die Spalte (Migration Profil 2a) nicht da ist. */
  muscle_mass_kg?: number | null
}

export interface BodyMeasurementEntry {
  measured_on: string
  site: MeasurementSite
  value_cm: number
}

export interface WeightLogEntry {
  id?: string
  logged_at: string
  weight_kg: number
}

export interface BloodworkEntry {
  id: string
  marker: string
  value: number
  unit: string
  tested_at: string
}

export interface ProgressPhotoEntry {
  id: string
  /** Storage-Pfad (neue Fotos) oder Legacy-Public-URL (alte Fotos) */
  photo_url: string
  /** Anzeigbare URL — signiert für Storage-Pfade, sonst die Legacy-URL */
  display_url: string
  taken_at: string
  weight_kg: number | null
  notes: string | null
}

export interface DoseLogEntry {
  stack_item_id: string | null
  logged_at: string
  taken: boolean | null
}

export type MetricKey =
  | 'weight'
  | 'energie'
  | 'schlaf'
  | 'wohlbefinden'
  | 'libido'
  | 'body_fat'
  | 'muscle_mass'
  | string

export interface MetricChange {
  key: MetricKey
  label: string
  unit: string
  from: number
  to: number
  delta: number
  rank: number
}

export interface OverviewCardData {
  key: 'weight' | 'wellness' | 'adherence' | 'blutwerte' | 'photos' | 'body_fat'
  visible: boolean
}

export interface FortschrittOverviewState {
  loading: boolean
  /** Erster Datenfetch abgeschlossen — verhindert UI-Flackern beim Laden */
  dataReady: boolean
  /** Zeitraum der aktiven Substanzen — Basis für Übersicht/Top-Veränderungen */
  range: DateRange
  /** Volle Historie (älteste Substanz oder ältester Datenpunkt → heute) — Basis für Verlauf „Alles" */
  fullRange: DateRange
  cycleSubstances: CycleSubstance[]
  ongoingSubstances: OngoingSubstance[]
  dailyLogs: DailyLogEntry[]
  weightLogs: WeightLogEntry[]
  bloodwork: BloodworkEntry[]
  measurements: BodyMeasurementEntry[]
  photos: ProgressPhotoEntry[]
  doseLogs: DoseLogEntry[]
  stackItemNames: Map<string, string>
}

export interface ChartNavigation {
  metric?: MetricKey
}
