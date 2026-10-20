/**
 * Auswertung des Tagebuchs: reine Rechnungen, ohne React und ohne Datenbank.
 * Sie zeigen Häufungen in den eigenen Einträgen — keine Ursachen.
 * Gezählt wird je Beobachtung (Chip): ein Eintrag mit „Übelkeit" und
 * „Kopfschmerzen" zählt zwei Nebenwirkungen.
 */
import { addMonths, addWeeks, getISOWeek, startOfMonth, startOfWeek } from 'date-fns'
import { observationGroup, observationsOf, type Observation, type SymptomKind, type SymptomRow } from '../../lib/tagebuch/diary'

export interface StatsRow {
  /** Nur bei älteren Einträgen ohne Chips maßgeblich. */
  type: SymptomKind | null
  severity: number | null
  description: string
  occurred_at: string
  stack_item_id: string | null
  stack_items: { display_name: string } | null
  dose_logs: { logged_at: string } | null
  effect_symptoms?: SymptomRow[] | null
}

export type RangeKey = '4w' | '12w' | 'all'

/** Ab mehr als so vielen Wochen wird pro Monat gezählt — sonst werden die Balken zu dünn. */
export const MAX_WEEK_BUCKETS = 26

export interface Bucket {
  /** Beginn des Zeitraums (lokal). */
  start: Date
  effects: number
  sideEffects: number
  /** Ø Intensität aller Beobachtungen im Zeitraum; `null` ohne. */
  avgSeverity: number | null
}

export interface Timeline {
  unit: 'week' | 'month'
  buckets: Bucket[]
}

/** Erster Tag des Zeitraums (lokal, Montag) — `null` für „alles". */
export function rangeStart(range: RangeKey, now: Date): Date | null {
  if (range === 'all') return null
  const weeks = range === '4w' ? 4 : 12
  return startOfWeek(addWeeks(now, -(weeks - 1)), { weekStartsOn: 1 })
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

/**
 * Einträge pro Woche (oder pro Monat bei langen Zeiträumen), lückenlos vom
 * Beginn bis heute — leere Wochen sind Nullen, keine Lücken.
 */
export function timeline(rows: StatsRow[], from: Date | null, now: Date): Timeline {
  const earliest = rows.reduce<Date | null>((min, row) => {
    const at = new Date(row.occurred_at)
    return !min || at < min ? at : min
  }, null)
  const begin = from ?? earliest
  if (!begin) return { unit: 'week', buckets: [] }

  const weekStart = (date: Date) => startOfWeek(date, { weekStartsOn: 1 })
  let unit: Timeline['unit'] = 'week'
  let first = weekStart(begin)
  const weekCount = Math.round((weekStart(now).getTime() - first.getTime()) / (7 * 86_400_000)) + 1
  if (weekCount > MAX_WEEK_BUCKETS) {
    unit = 'month'
    first = startOfMonth(begin)
  }
  const bucketOf = unit === 'week' ? weekStart : startOfMonth
  const next = (date: Date) => (unit === 'week' ? addWeeks(date, 1) : addMonths(date, 1))

  const groups = new Map<number, { effects: number; sideEffects: number; severities: number[] }>()
  for (let at = first; at <= now; at = next(at)) groups.set(at.getTime(), { effects: 0, sideEffects: 0, severities: [] })
  for (const row of rows) {
    const group = groups.get(bucketOf(new Date(row.occurred_at)).getTime())
    if (!group) continue
    for (const observation of observationsOf(row)) {
      if (observation.kind === 'effect') group.effects += 1
      else group.sideEffects += 1
      group.severities.push(observation.severity)
    }
  }
  return {
    unit,
    buckets: [...groups.entries()].map(([time, group]) => ({
      start: new Date(time),
      effects: group.effects,
      sideEffects: group.sideEffects,
      avgSeverity: mean(group.severities),
    })),
  }
}

export function weekNumber(date: Date): number {
  return getISOWeek(date)
}

export const GAP_BINS = [
  { key: 'tagebuch_bin_0_1', upToHours: 1 },
  { key: 'tagebuch_bin_1_4', upToHours: 4 },
  { key: 'tagebuch_bin_4_12', upToHours: 12 },
  { key: 'tagebuch_bin_12_24', upToHours: 24 },
  { key: 'tagebuch_bin_24', upToHours: Infinity },
] as const

export interface GapBin {
  key: typeof GAP_BINS[number]['key']
  effects: number
  sideEffects: number
}

/**
 * Abstand zwischen Einnahme und Eintrag, nur für verknüpfte Einträge.
 * Dieselbe Minute zählt als 0 (das Formular kennt keine Sekunden).
 * `linked` zählt Einträge, die Fächer zählen Beobachtungen.
 */
export function gapBins(rows: StatsRow[]): { bins: GapBin[]; linked: number } {
  const bins: GapBin[] = GAP_BINS.map(bin => ({ key: bin.key, effects: 0, sideEffects: 0 }))
  let linked = 0
  for (const row of rows) {
    if (!row.dose_logs) continue
    const ms = new Date(row.occurred_at).getTime() - new Date(row.dose_logs.logged_at).getTime()
    if (!Number.isFinite(ms) || ms <= -60_000) continue
    const hours = Math.max(0, ms) / 3_600_000
    const index = GAP_BINS.findIndex(bin => hours < bin.upToHours)
    const bin = bins[index]
    const observations = observationsOf(row)
    if (!observations.length) continue
    for (const observation of observations) {
      if (observation.kind === 'effect') bin.effects += 1
      else bin.sideEffects += 1
    }
    linked += 1
  }
  return { bins, linked }
}

export interface SubstanceStat {
  /** `null`: Einträge ohne Substanz. */
  id: string | null
  name: string | null
  effects: number
  sideEffects: number
  avgSeverity: number
  /** Häufigste Nebenwirkung (gleicher Chip; eigene nach Name, Groß/Klein egal); bei Gleichstand die jüngste. */
  topSideEffect: { text: string; count: number } | null
}

/** `label`: Anzeigename einer Beobachtung in der aktuellen Sprache. */
export function bySubstance(rows: StatsRow[], label: (observation: Observation) => string): SubstanceStat[] {
  type Group = {
    name: string | null; effects: number; sideEffects: number; severities: number[]
    side: Map<string, { text: string; count: number; last: number }>
  }
  const groups = new Map<string | null, Group>()
  for (const row of rows) {
    const observations = observationsOf(row)
    if (!observations.length) continue
    const id = row.stack_item_id
    const group: Group = groups.get(id) ?? {
      name: row.stack_items?.display_name?.trim() || null, effects: 0, sideEffects: 0, severities: [], side: new Map(),
    }
    const at = new Date(row.occurred_at).getTime()
    for (const observation of observations) {
      group.severities.push(observation.severity)
      if (observation.kind === 'effect') { group.effects += 1; continue }
      group.sideEffects += 1
      const text = label(observation).trim()
      if (!text) continue
      const key = observationGroup(observation)
      const entry = group.side.get(key) ?? { text, count: 0, last: at }
      entry.count += 1
      if (at >= entry.last) { entry.last = at; entry.text = text }
      group.side.set(key, entry)
    }
    groups.set(id, group)
  }
  return [...groups.entries()]
    .map(([id, group]) => {
      const top = [...group.side.values()].sort((a, b) => b.count - a.count || b.last - a.last)[0]
      return {
        id,
        name: group.name,
        effects: group.effects,
        sideEffects: group.sideEffects,
        avgSeverity: mean(group.severities) ?? 0,
        topSideEffect: top ? { text: top.text, count: top.count } : null,
      }
    })
    // Meiste Einträge zuerst; „ohne Substanz" ans Ende.
    .sort((a, b) => Number(a.id === null) - Number(b.id === null)
      || (b.effects + b.sideEffects) - (a.effects + a.sideEffects)
      || (a.name ?? '').localeCompare(b.name ?? ''))
}
