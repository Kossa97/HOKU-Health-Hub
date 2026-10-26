export interface BloodworkEntry {
  id: string
  user_id: string
  tested_at: string
  marker: string
  value: number | string
  unit: string
  notes: string | null
  created_at: string | null
  /** Verweist auf den Befund, aus dem der Wert stammt. Null bei Einzelwerten. */
  report_id: string | null
  /** Referenz-Untergrenze des Labors, falls im Befund angegeben. */
  ref_min: number | null
  /** Referenz-Obergrenze des Labors, falls im Befund angegeben. */
  ref_max: number | null
  /**
   * Nur Oestradiol, LH, FSH bei Frauen: vor ('pre') oder nach ('post') den
   * Wechseljahren zum Zeitpunkt der Messung. Null = nicht angegeben.
   */
  menopause?: 'pre' | 'post' | null
}

export interface BloodworkReport {
  id: string
  user_id: string
  tested_at: string
  lab_name: string | null
  source: 'manual' | 'import'
  created_at: string | null
}
