import { describe, expect, it } from 'vitest'
import { SYMPTOM_ICONS } from './symptomIcons.data'
import {
  SYMPTOMS, SYMPTOM_GROUPS, durationText, entrySummary, fromMinutes, matchingSymptoms,
  planChipSave, toMinutes, type ChipDraft, type ChipRow,
} from './chips'

const t = (key: string, options?: Record<string, unknown>) =>
  options && 'count' in options ? `${options.count}|${key}` : key

const chip = (over: Partial<ChipDraft>): ChipDraft => ({
  key: 'nausea', customLabel: null, kind: 'side_effect', severity: 3,
  durationMinutes: null, ongoing: false, ...over,
})

describe('Chip-Katalog', () => {
  it('hat eindeutige Schlüssel, die zur Datenbank-Regel passen', () => {
    const keys = SYMPTOMS.map(symptom => symptom.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) expect(key).toMatch(/^[a-z][a-z0-9_]{1,47}$/)
  })

  it('ordnet jeden Chip einer Gruppe derselben Art zu', () => {
    const groups = new Map(SYMPTOM_GROUPS.map(group => [group.key, group]))
    for (const symptom of SYMPTOMS) expect(groups.get(symptom.group)?.kind).toBe(symptom.kind)
  })

  it('hat zu jedem Chip ein Symbol und einen Namen in de und en', () => {
    for (const symptom of SYMPTOMS) {
      expect(SYMPTOM_ICONS[symptom.key], symptom.key).toBeDefined()
      expect(symptom.label.de.trim()).not.toBe('')
      expect(symptom.label.en.trim()).not.toBe('')
    }
  })

  it('findet Chips über den Namen in der jeweiligen Sprache', () => {
    expect(matchingSymptoms('übel', 'de').map(s => s.key)).toEqual(['nausea'])
    expect(matchingSymptoms('sleep', 'en').map(s => s.key)).toContain('trouble_falling_asleep')
    expect(matchingSymptoms('  ', 'de')).toHaveLength(SYMPTOMS.length)
  })
})

describe('Dauer', () => {
  it('rechnet Zahl und Einheit in Minuten und zurück', () => {
    expect(toMinutes(2, 1)).toBe(120)
    expect(fromMinutes(120)).toEqual({ num: 2, unit: 1 })
    expect(fromMinutes(10080 * 3)).toEqual({ num: 3, unit: 3 })
    expect(fromMinutes(90)).toEqual({ num: 2, unit: 1 })
    expect(fromMinutes(45)).toEqual({ num: 45, unit: 0 })
  })

  it('zeigt die Dauer am Chip', () => {
    expect(durationText(chip({ durationMinutes: 120 }), t)).toBe('2 2|tagebuch_einheit_std')
    expect(durationText(chip({ ongoing: true }), t)).toBe('tagebuch_haelt_an_kurz')
    expect(durationText(chip({}), t)).toBe('')
  })
})

describe('Speichern', () => {
  const row = (id: string, fields: Partial<ChipRow>): ChipRow => ({
    id, symptom_key: 'nausea', custom_label: null, kind: 'side_effect', severity: 3,
    duration_minutes: null, ongoing: false, position: 0, ...fields,
  })

  it('löscht entfernte, aktualisiert geänderte und legt neue Chips an', () => {
    const plan = planChipSave([row('a', { symptom_key: 'headache' }), row('b', { position: 1 })], [
      chip({ id: 'b', severity: 5 }),
      chip({ key: null, customLabel: '  Mehr Fokus ', kind: 'effect', ongoing: true, durationMinutes: 30 }),
    ], 'e1', 'u1')
    expect(plan.remove).toEqual(['a'])
    expect(plan.update).toEqual([expect.objectContaining({ id: 'b', severity: 5, position: 0 })])
    expect(plan.insert).toEqual([{
      effect_id: 'e1', user_id: 'u1', symptom_key: null, custom_label: 'Mehr Fokus', kind: 'effect',
      severity: 3, duration_minutes: null, ongoing: true, position: 1,
    }])
  })

  it('lässt unveränderte Chips aus', () => {
    const plan = planChipSave([row('a', {}), row('b', { position: 1, severity: 2 })], [
      chip({ id: 'a' }), chip({ id: 'b', severity: 2 }),
    ], 'e1', 'u1')
    expect(plan).toEqual({ remove: [], update: [], insert: [] })
    // Nur die Reihenfolge geändert: beide bekommen ihre neue Position.
    expect(planChipSave([row('a', {}), row('b', { position: 1 })], [chip({ id: 'b' }), chip({ id: 'a' })], 'e1', 'u1').update)
      .toEqual([expect.objectContaining({ id: 'b', position: 0 }), expect.objectContaining({ id: 'a', position: 1 })])
  })

  it('fasst Art und stärkste Intensität für den Eintrag zusammen', () => {
    expect(entrySummary([chip({ severity: 2 }), chip({ severity: 4 })])).toEqual({ type: 'side_effect', severity: 4 })
    expect(entrySummary([chip({}), chip({ kind: 'effect', severity: 1 })])).toEqual({ type: null, severity: 3 })
    expect(entrySummary([])).toEqual({ type: null, severity: null })
  })
})
