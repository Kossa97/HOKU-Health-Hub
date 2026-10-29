import { observationGroup, observationsOf, type Observation, type SymptomKind, type SymptomRow } from './tagebuch/diary'

export interface EffectRow {
  id: string
  /** Nur bei älteren Einträgen ohne Chips maßgeblich. */
  type: SymptomKind | null
  description: string
  severity: number | null
  stack_item_id: string | null
  occurred_at: string
  stack_items: { display_name: string } | null
  effect_symptoms?: SymptomRow[] | null
}

export interface ReviewRow {
  id: string
  stack_item_id: string
  rating: number
  experience: 'gut' | 'mittel' | 'schlecht'
  /** Bewertungen v2 — bei alten Bewertungen leer. */
  wirkung?: number | null
  vertraeglichkeit?: number | null
  wieder_nehmen?: 'ja' | 'unsicher' | 'nein' | null
  stack_items: { display_name: string }
}

export interface SideEffectStat {
  text: string
  count: number
}

export interface PeptideEffectStat {
  name: string
  effects: number
  sideEffects: number
  avgSeverity: number
}

export interface PeptideReviewStat {
  name: string
  avgRating: number
  count: number
  good: number
  bad: number
  /** Mittel nur ueber Bewertungen, die das Kriterium haben; null ohne. */
  avgWirkung: number | null
  avgVertraeglichkeit: number | null
  /** „Wieder nehmen?" mit Ja — von wie vielen, die es beantwortet haben. */
  wiederJa: number
  wiederBeantwortet: number
}

/** Häufigste Nebenwirkungen über alle Chips; `label` liefert den Namen in der aktuellen Sprache. */
export function topSideEffects(effects: EffectRow[], label: (observation: Observation) => string, limit = 5): SideEffectStat[] {
  const counts = new Map<string, { label: string; count: number }>()
  for (const row of effects) {
    for (const observation of observationsOf(row)) {
      if (observation.kind !== 'side_effect') continue
      const text = label(observation).trim()
      if (!text) continue
      const key = observationGroup(observation)
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { label: text, count: 1 })
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ label, count }) => ({ text: label, count }))
}

/** Je Substanz: Wirkungen und Nebenwirkungen (je Chip gezählt) und Ø Intensität. */
export function effectsByPeptide(effects: EffectRow[]): PeptideEffectStat[] {
  const grouped = new Map<string, { name: string; effects: number; sideEffects: number; severities: number[] }>()
  for (const row of effects) {
    const observations = observationsOf(row)
    if (!observations.length) continue
    const name = row.stack_items?.display_name?.trim() || '—'
    const entry = grouped.get(name) ?? { name, effects: 0, sideEffects: 0, severities: [] }
    for (const observation of observations) {
      if (observation.kind === 'effect') entry.effects += 1
      else entry.sideEffects += 1
      entry.severities.push(observation.severity)
    }
    grouped.set(name, entry)
  }
  return [...grouped.values()]
    .map(entry => ({
      name: entry.name,
      effects: entry.effects,
      sideEffects: entry.sideEffects,
      avgSeverity: entry.severities.length > 0
        ? Math.round((entry.severities.reduce((sum, value) => sum + value, 0) / entry.severities.length) * 10) / 10
        : 0,
    }))
    .sort((a, b) => (b.effects + b.sideEffects) - (a.effects + a.sideEffects))
}

export function reviewsByPeptide(reviews: ReviewRow[]): PeptideReviewStat[] {
  const grouped = new Map<string, {
    name: string; ratings: number[]; good: number; bad: number
    wirkung: number[]; vertraeglichkeit: number[]; wiederJa: number; wiederBeantwortet: number
  }>()
  for (const row of reviews) {
    const name = row.stack_items?.display_name?.trim() || '—'
    const entry = grouped.get(name) ?? { name, ratings: [], good: 0, bad: 0, wirkung: [], vertraeglichkeit: [], wiederJa: 0, wiederBeantwortet: 0 }
    entry.ratings.push(row.rating)
    if (row.experience === 'gut') entry.good += 1
    else if (row.experience === 'schlecht') entry.bad += 1
    if (row.wirkung) entry.wirkung.push(row.wirkung)
    if (row.vertraeglichkeit) entry.vertraeglichkeit.push(row.vertraeglichkeit)
    if (row.wieder_nehmen) {
      entry.wiederBeantwortet += 1
      if (row.wieder_nehmen === 'ja') entry.wiederJa += 1
    }
    grouped.set(name, entry)
  }
  const mittel = (werte: number[]) => werte.length > 0
    ? Math.round((werte.reduce((sum, value) => sum + value, 0) / werte.length) * 10) / 10
    : null
  return [...grouped.values()]
    .map(entry => ({
      name: entry.name,
      avgRating: mittel(entry.ratings) ?? 0,
      count: entry.ratings.length,
      good: entry.good,
      bad: entry.bad,
      avgWirkung: mittel(entry.wirkung),
      avgVertraeglichkeit: mittel(entry.vertraeglichkeit),
      wiederJa: entry.wiederJa,
      wiederBeantwortet: entry.wiederBeantwortet,
    }))
    .sort((a, b) => b.count - a.count)
}
