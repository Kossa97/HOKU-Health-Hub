import { describe, it, expect } from 'vitest'
import {
  MEASUREMENT_SITES,
  lastMeasurementBefore,
  measurementMetricKey,
  measurementRowsToSave,
  measurementSeries,
  parseCircumference,
  siteFromMetricKey,
} from './measurements'
import type { BodyMeasurementEntry } from '../types'

const entries: BodyMeasurementEntry[] = [
  { measured_on: '2026-10-20', site: 'waist', value_cm: 85 },
  { measured_on: '2026-10-05', site: 'waist', value_cm: 87 },
  { measured_on: '2026-09-01', site: 'waist', value_cm: 90 },
  { measured_on: '2026-10-10', site: 'chest', value_cm: 100 },
  { measured_on: '2026-10-31', site: 'waist', value_cm: 84 },
]

describe('MEASUREMENT_SITES', () => {
  it('hält die neun Stellen in fester Reihenfolge', () => {
    expect(MEASUREMENT_SITES).toEqual([
      'neck', 'chest', 'waist', 'belly', 'hips', 'upper_arm', 'forearm', 'thigh', 'calf',
    ])
  })
})

describe('parseCircumference', () => {
  it('nimmt Komma und Punkt, rundet auf eine Nachkommastelle', () => {
    expect(parseCircumference('84,5')).toBe(84.5)
    expect(parseCircumference(' 84.54 ')).toBe(84.5)
  })
  it('akzeptiert die Grenzen 10 und 250', () => {
    expect(parseCircumference('10')).toBe(10)
    expect(parseCircumference('250')).toBe(250)
  })
  it('lehnt Werte außerhalb 10–250 und Unsinn ab', () => {
    expect(parseCircumference('0')).toBeNull()
    expect(parseCircumference('-3')).toBeNull()
    expect(parseCircumference('9,9')).toBeNull()
    expect(parseCircumference('250,1')).toBeNull()
    expect(parseCircumference('800')).toBeNull()
    expect(parseCircumference('')).toBeNull()
    expect(parseCircumference('abc')).toBeNull()
  })
})

describe('Metrik-Schlüssel', () => {
  it('geht hin und zurück', () => {
    expect(measurementMetricKey('waist')).toBe('umfang:waist')
    for (const site of MEASUREMENT_SITES) {
      expect(siteFromMetricKey(measurementMetricKey(site))).toBe(site)
    }
  })
  it('kennt fremde Schlüssel nicht', () => {
    expect(siteFromMetricKey('weight')).toBeNull()
    expect(siteFromMetricKey('umfang:nose')).toBeNull()
  })
})

describe('measurementSeries', () => {
  it('liefert nur die Stelle im Bereich, aufsteigend', () => {
    expect(measurementSeries(entries, 'waist', { from: '2026-10-01', to: '2026-10-30' })).toEqual([
      { date: '2026-10-05', value: 87 },
      { date: '2026-10-20', value: 85 },
    ])
  })
})

describe('lastMeasurementBefore', () => {
  it('nimmt den jüngsten Eintrag vor dem Datum, nicht am Datum', () => {
    expect(lastMeasurementBefore(entries, 'waist', '2026-10-31')).toBe(85)
    expect(lastMeasurementBefore(entries, 'waist', '2026-10-20')).toBe(87)
  })
  it('gibt null ohne früheren Eintrag', () => {
    expect(lastMeasurementBefore(entries, 'waist', '2026-09-01')).toBeNull()
    expect(lastMeasurementBefore(entries, 'calf', '2026-10-31')).toBeNull()
  })
})

describe('measurementRowsToSave', () => {
  it('speichert nur eingetragene Stellen', () => {
    expect(measurementRowsToSave('u1', '2026-10-31', {})).toEqual([])
    expect(measurementRowsToSave('u1', '2026-10-31', { waist: 84 })).toEqual([
      { user_id: 'u1', measured_on: '2026-10-31', site: 'waist', value_cm: 84 },
    ])
  })
  it('hält die Reihenfolge der Stellen ein', () => {
    const rows = measurementRowsToSave('u1', '2026-10-31', { calf: 38, neck: 40 })
    expect(rows.map(r => r.site)).toEqual(['neck', 'calf'])
  })
})
