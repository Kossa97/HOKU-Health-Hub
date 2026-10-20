import { describe, expect, it } from 'vitest'
import { SYMPTOM_ICONS } from './symptomIcons.data'
import {
  SYMPTOMS, SYMPTOM_GROUPS, durationText, fromMinutes, matchingSymptoms,
  chipPayload, toMinutes, type ChipDraft,
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
  it('schickt die Chips in Reihenfolge; eigene Namen getrimmt, „hält an" ohne Dauer', () => {
    expect(chipPayload([
      chip({ id: 'b', severity: 5, durationMinutes: 120 }),
      chip({ key: null, customLabel: '  Mehr Fokus ', kind: 'effect', ongoing: true, durationMinutes: 30 }),
    ])).toEqual([
      { symptom_key: 'nausea', custom_label: null, kind: 'side_effect', severity: 5, duration_minutes: 120, ongoing: false },
      { symptom_key: null, custom_label: 'Mehr Fokus', kind: 'effect', severity: 3, duration_minutes: null, ongoing: true },
    ])
  })
})
