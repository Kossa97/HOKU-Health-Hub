// Gemeinsame Typen der Erkenntnis-Engine. Reines TypeScript, keine Importe von außen:
// läuft unverändert im Browser, in Vitest und in Deno.

export type FundId = 'H1' | 'E2' | 'W1' | 'T7' | 'R4'
export type Richtung = 'positiv' | 'kritisch' | 'neutral'
export type Datenlage = 'hinweis' | 'deutlich'

export interface Fund {
  id: FundId
  schluessel: string // eindeutig je Nutzer, siehe Detektoren
  bezug: string | null // z. B. Übungs-ID bei R4
  richtung: Richtung
  datenlage: Datenlage
  staerke: number // 0..1, nur zum Sortieren
  zeitraum: { von: string; bis: string } // lokale Tage YYYY-MM-DD
  werte: Record<string, number | string> // alles, was eine Vorlage zeigen darf
}

export interface Training {
  startedAt: string
  kind: string
  exercises: { exerciseId: string; sets: { type?: string; weightKg?: number | null; reps?: number | null }[] }[]
}

export interface Rohdaten {
  health: { day: string; sleep_min: number | null }[]
  tagebuch: { log_date: string; energie: number | null }[] // daily_logs
  effekte: { occurred_at: string }[] // effects
  essen: { log_date: string; protein_g: number; source: string }[] // food_logs
  trainings: Training[] // training_sessions
}

export interface Tag {
  datum: string
  schlafMin: number | null // Nacht, die an diesem Morgen endet (health_daily.day)
  energie: number | null
  proteinG: number | null // null = an dem Tag nichts mit Menge eingetragen
  trainingsStunden: number[] // lokale Startstunde je Einheit
  tagebuch: boolean // daily_logs- oder effects-Eintrag an dem Tag
}
