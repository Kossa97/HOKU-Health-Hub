import { describe, expect, it } from 'vitest'
import type { DailyLogEntry, WeightLogEntry } from '../types'
import {
  bodyFatForDate,
  hasAnyProgressLog,
  hasLogForDate,
  isValidMuscleMass,
  lastBodyFatBefore,
  lastMuscleMassBefore,
  lastWeightBefore,
  loadLogFormValues,
  muscleMassForDate,
  weightForDate,
} from './metricDefaults'

describe('metricDefaults', () => {
  const weightLogs: WeightLogEntry[] = [
    { id: 'w1', logged_at: '2026-07-01T08:00:00', weight_kg: 80 },
    { id: 'w2', logged_at: '2026-07-05T08:00:00', weight_kg: 81.2 },
    { id: 'w3', logged_at: '2026-07-08T09:00:00', weight_kg: 82 },
  ]

  const logs: DailyLogEntry[] = [
    { log_date: '2026-07-03', energie: null, schlaf: null, wohlbefinden: null, libido: null, body_fat_pct: 17.5 },
    { log_date: '2026-07-06', energie: 7, schlaf: null, wohlbefinden: null, libido: null, body_fat_pct: null },
    { log_date: '2026-07-08', energie: null, schlaf: null, wohlbefinden: null, libido: null, body_fat_pct: null },
  ]

  it('finds weight for exact date', () => {
    expect(weightForDate(weightLogs, '2026-07-08')).toEqual({ kg: 82, id: 'w3' })
  })

  it('returns last weight before date when no same-day entry', () => {
    expect(lastWeightBefore(weightLogs, '2026-07-07')).toBe(81.2)
    expect(lastWeightBefore(weightLogs, '2026-07-01')).toBeNull()
  })

  it('finds body fat for exact date', () => {
    expect(bodyFatForDate(logs, '2026-07-03')).toBe(17.5)
    expect(bodyFatForDate(logs, '2026-07-08')).toBeNull()
  })

  it('returns last body fat before date', () => {
    expect(lastBodyFatBefore(logs, '2026-07-08')).toBe(17.5)
    expect(lastBodyFatBefore(logs, '2026-07-03')).toBeNull()
  })

  it('detects whether a date has any logged entry', () => {
    expect(hasLogForDate(logs, weightLogs, '2026-07-08')).toBe(true)
    expect(hasLogForDate(logs, weightLogs, '2026-07-03')).toBe(true)
    expect(hasLogForDate(logs, weightLogs, '2026-07-06')).toBe(true)
    expect(hasLogForDate(logs, weightLogs, '2026-07-07')).toBe(false)
    expect(hasLogForDate([], [], '2026-07-08')).toBe(false)
  })

  it('detects whether any progress was ever saved', () => {
    expect(hasAnyProgressLog(logs, weightLogs)).toBe(true)
    expect(hasAnyProgressLog(logs, [])).toBe(true)
    expect(hasAnyProgressLog([], weightLogs)).toBe(true)
    expect(hasAnyProgressLog([], [])).toBe(false)
    expect(hasAnyProgressLog(
      [{ log_date: '2026-07-01', energie: null, schlaf: null, wohlbefinden: null, libido: null, body_fat_pct: null }],
      [],
    )).toBe(false)
  })

  it('loads saved day values when editing, otherwise last known defaults', () => {
    expect(loadLogFormValues(logs, weightLogs, '2026-07-08')).toEqual({
      energie: null,
      schlaf: null,
      wohlbefinden: null,
      libido: null,
      bodyFat: null,
      muscleMass: null,
      weight: 82,
      weightRowId: 'w3',
    })

    expect(loadLogFormValues(logs, weightLogs, '2026-07-06')).toEqual({
      energie: 7,
      schlaf: null,
      wohlbefinden: null,
      libido: null,
      bodyFat: null,
      muscleMass: null,
      weight: null,
      weightRowId: null,
    })

    expect(loadLogFormValues(logs, weightLogs, '2026-07-07')).toEqual({
      energie: null,
      schlaf: null,
      wohlbefinden: null,
      libido: null,
      bodyFat: 17.5,
      muscleMass: null,
      weight: 81.2,
      weightRowId: null,
    })
  })
  it('prefers the locally saved values for the same date while parent data catches up', () => {
    expect(loadLogFormValues(logs, weightLogs, '2026-07-08', {
      date: '2026-07-08',
      energie: 9,
      schlaf: 8,
      wohlbefinden: 7,
      libido: 6,
      bodyFat: 16.4,
      muscleMass: 38.2,
      weight: 83.5,
      weightRowId: 'w3',
    })).toEqual({
      energie: 9,
      schlaf: 8,
      wohlbefinden: 7,
      libido: 6,
      bodyFat: 16.4,
      muscleMass: 38.2,
      weight: 83.5,
      weightRowId: 'w3',
    })
  })

  describe('Muskelmasse wie KFA', () => {
    const withMuscle: DailyLogEntry[] = [
      { log_date: '2026-07-02', energie: null, schlaf: null, wohlbefinden: null, libido: null, body_fat_pct: null, muscle_mass_kg: 37.8 },
      { log_date: '2026-07-04', energie: 6, schlaf: null, wohlbefinden: null, libido: null, body_fat_pct: null, muscle_mass_kg: null },
    ]

    it('findet den Wert des Tages und den letzten davor', () => {
      expect(muscleMassForDate(withMuscle, '2026-07-02')).toBe(37.8)
      expect(muscleMassForDate(withMuscle, '2026-07-04')).toBeNull()
      expect(lastMuscleMassBefore(withMuscle, '2026-07-05')).toBe(37.8)
      expect(lastMuscleMassBefore(withMuscle, '2026-07-02')).toBeNull()
    })

    it('belegt einen neuen Tag mit dem letzten Wert vor, einen erfassten Tag nicht', () => {
      expect(loadLogFormValues(withMuscle, [], '2026-07-05').muscleMass).toBe(37.8)
      expect(loadLogFormValues(withMuscle, [], '2026-07-04').muscleMass).toBeNull()
    })

    it('zaehlt eine Muskelmasse allein als Eintrag', () => {
      expect(hasLogForDate(withMuscle, [], '2026-07-02')).toBe(true)
      expect(hasAnyProgressLog([withMuscle[0]], [])).toBe(true)
    })

    it('kommt mit Zeilen ohne die Spalte zurecht (vor der Migration)', () => {
      expect(muscleMassForDate(logs, '2026-07-03')).toBeNull()
      expect(loadLogFormValues(logs, weightLogs, '2026-07-07').muscleMass).toBeNull()
    })

    it('prueft die Grenzen 10 bis 150 kg wie die Datenbank', () => {
      expect(isValidMuscleMass(10)).toBe(true)
      expect(isValidMuscleMass(150)).toBe(true)
      expect(isValidMuscleMass(9.9)).toBe(false)
      expect(isValidMuscleMass(150.1)).toBe(false)
      expect(isValidMuscleMass(Number.NaN)).toBe(false)
    })
  })
})
