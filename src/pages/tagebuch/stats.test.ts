import { describe, expect, it } from 'vitest'
import { symptomLabel, type SymptomRow } from '../../lib/tagebuch/diary'
import { bySubstance, gapBins, rangeStart, timeline, type StatsRow } from './stats'

const label = (observation: Parameters<typeof symptomLabel>[0]) => symptomLabel(observation, 'de')
const chip = (felder: Partial<SymptomRow>): SymptomRow => ({
  symptom_key: 'nausea', custom_label: null, kind: 'side_effect', severity: 3,
  duration_minutes: null, ongoing: false, position: 0, ...felder,
})

// Lokale Zeiten — die Wochen beginnen lokal am Montag.
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()
const NOW = new Date(2026, 8, 30, 12) // Mittwoch, 30.09.2026

function row(felder: Partial<StatsRow>): StatsRow {
  return {
    type: 'effect', severity: 3, description: 'x', occurred_at: local(2026, 9, 30),
    stack_item_id: null, stack_items: null, dose_logs: null, ...felder,
  }
}

describe('Tagebuch-Auswertung', () => {
  it('Zeitraum beginnt am Montag der ersten Woche', () => {
    expect(rangeStart('4w', NOW)).toEqual(new Date(2026, 8, 7))
    expect(rangeStart('12w', NOW)).toEqual(new Date(2026, 6, 13))
    expect(rangeStart('all', NOW)).toBeNull()
  })

  it('Wochen lueckenlos bis heute, mit Anzahlen und Ø Intensitaet', () => {
    const rows = [
      row({ occurred_at: local(2026, 9, 8), severity: 2 }),
      row({ occurred_at: local(2026, 9, 9), type: 'side_effect', severity: 5 }),
      row({ occurred_at: local(2026, 9, 29), type: 'side_effect', severity: 4 }),
    ]
    const { unit, buckets } = timeline(rows, rangeStart('4w', NOW), NOW)
    expect(unit).toBe('week')
    expect(buckets.map(b => b.start)).toEqual([
      new Date(2026, 8, 7), new Date(2026, 8, 14), new Date(2026, 8, 21), new Date(2026, 8, 28),
    ])
    expect(buckets[0]).toMatchObject({ effects: 1, sideEffects: 1, avgSeverity: 3.5 })
    expect(buckets[1]).toMatchObject({ effects: 0, sideEffects: 0, avgSeverity: null })
    expect(buckets[3]).toMatchObject({ effects: 0, sideEffects: 1, avgSeverity: 4 })
  })

  it('„Alles" ueber mehr als 26 Wochen zaehlt pro Monat', () => {
    const rows = [row({ occurred_at: local(2025, 11, 15) }), row({ occurred_at: local(2026, 9, 1) })]
    const { unit, buckets } = timeline(rows, null, NOW)
    expect(unit).toBe('month')
    expect(buckets[0].start).toEqual(new Date(2025, 10, 1))
    expect(buckets.at(-1)!.start).toEqual(new Date(2026, 8, 1))
    expect(buckets).toHaveLength(11)
    expect(buckets.reduce((sum, b) => sum + b.effects, 0)).toBe(2)
  })

  it('ein Eintrag in der Zukunft bekommt eine Woche, wenn das Ende bis zu ihm reicht', () => {
    const rows = [row({ occurred_at: local(2026, 10, 7) })]
    const { buckets } = timeline(rows, rangeStart('4w', NOW), new Date(2026, 9, 7, 12))
    expect(buckets.at(-1)).toMatchObject({ start: new Date(2026, 9, 5), effects: 1 })
  })

  it('ohne Eintraege keine Balken', () => {
    expect(timeline([], null, NOW).buckets).toEqual([])
  })

  it('Abstand zur Einnahme: nur verknuepfte, dieselbe Minute zaehlt als 0', () => {
    const at = (iso: string) => ({ logged_at: iso })
    const { bins, linked } = gapBins([
      row({ occurred_at: '2026-09-28T08:00:00Z', dose_logs: at('2026-09-28T08:00:40Z') }),
      row({ occurred_at: '2026-09-28T10:30:00Z', dose_logs: at('2026-09-28T08:00:00Z'), type: 'side_effect' }),
      row({ occurred_at: '2026-09-29T09:00:00Z', dose_logs: at('2026-09-28T08:00:00Z') }),
      row({ occurred_at: '2026-09-28T07:00:00Z', dose_logs: at('2026-09-28T08:00:00Z') }),
      row({ occurred_at: '2026-09-28T09:00:00Z' }),
    ])
    expect(linked).toBe(3)
    expect(bins.map(b => [b.key, b.effects, b.sideEffects])).toEqual([
      ['tagebuch_bin_0_1', 1, 0],
      ['tagebuch_bin_1_4', 0, 1],
      ['tagebuch_bin_4_12', 0, 0],
      ['tagebuch_bin_12_24', 0, 0],
      ['tagebuch_bin_24', 1, 0],
    ])
  })

  it('pro Substanz: Anzahlen, Ø Intensitaet, haeufigste Nebenwirkung; ohne Substanz zuletzt', () => {
    const bpc = { stack_item_id: 'a', stack_items: { display_name: 'BPC-157' } }
    const stats = bySubstance([
      row({ ...bpc, type: 'side_effect', description: 'Rötung', severity: 2, occurred_at: local(2026, 9, 1) }),
      row({ ...bpc, type: 'side_effect', description: 'rötung ', severity: 4, occurred_at: local(2026, 9, 2) }),
      row({ ...bpc, type: 'side_effect', description: 'Müdigkeit', severity: 3 }),
      row({ ...bpc, type: 'effect', severity: 5 }),
      row({ type: 'effect' }), row({ type: 'effect' }), row({ type: 'effect' }), row({ type: 'effect' }), row({ type: 'effect' }),
    ], label)
    expect(stats.map(s => s.name)).toEqual(['BPC-157', null])
    expect(stats[0]).toMatchObject({ effects: 1, sideEffects: 3, avgSeverity: 3.5, topSideEffect: { text: 'rötung', count: 2 } })
    expect(stats[1]).toMatchObject({ effects: 5, sideEffects: 0, topSideEffect: null })
  })

  it('Chips: jeder Chip zaehlt; gemischter Eintrag zaehlt in beide Arten; Ø ueber die Chips', () => {
    const gemischt = row({
      type: null, severity: 4, occurred_at: local(2026, 9, 29),
      effect_symptoms: [chip({ symptom_key: 'more_energy', kind: 'effect', severity: 2 }), chip({ severity: 4, position: 1 })],
    })
    const { buckets } = timeline([gemischt], rangeStart('4w', NOW), NOW)
    expect(buckets[3]).toMatchObject({ effects: 1, sideEffects: 1, avgSeverity: 3 })

    const linked = { ...gemischt, dose_logs: { logged_at: local(2026, 9, 29, 11) } }
    const { bins, linked: count } = gapBins([linked])
    expect(count).toBe(1)
    expect(bins[1]).toMatchObject({ effects: 1, sideEffects: 1 })
  })

  it('Chips: haeufigste Nebenwirkung nach Chip, eigene nach Name; Titel spielt keine Rolle', () => {
    const bpc = { stack_item_id: 'a', stack_items: { display_name: 'BPC-157' } }
    const stats = bySubstance([
      row({ ...bpc, type: 'side_effect', description: 'Morgens', effect_symptoms: [chip({}), chip({ symptom_key: 'headache', position: 1 })] }),
      row({ ...bpc, type: 'side_effect', description: 'Abends', effect_symptoms: [chip({})] }),
      row({ ...bpc, type: 'side_effect', description: 'x', effect_symptoms: [chip({ symptom_key: null, custom_label: 'Ziehen' }), chip({ symptom_key: null, custom_label: 'ziehen ', position: 1 })] }),
      row({ ...bpc, type: 'side_effect', description: 'y', effect_symptoms: [chip({ symptom_key: null, custom_label: 'Ziehen' })] }),
    ], label)
    expect(stats[0]).toMatchObject({ effects: 0, sideEffects: 6, topSideEffect: { count: 3 } })
    // Übelkeit (2) gegen Ziehen (3, Schreibweise egal): Ziehen gewinnt.
    expect(stats[0].topSideEffect?.text).toMatch(/^ziehen$/i)
    const nurUebelkeit = bySubstance([row({ ...bpc, type: 'side_effect', description: 'Titel', effect_symptoms: [chip({})] })], label)
    expect(nurUebelkeit[0].topSideEffect).toEqual({ text: 'Übelkeit', count: 1 })
  })

  it('aeltere Eintraege ohne Art und ohne Chips zaehlen nicht', () => {
    const { buckets } = timeline([row({ type: null, severity: null })], rangeStart('4w', NOW), NOW)
    expect(buckets.every(bucket => bucket.effects + bucket.sideEffects === 0)).toBe(true)
  })
})
