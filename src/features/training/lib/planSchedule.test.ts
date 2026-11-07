import { describe, expect, it } from 'vitest'
import type { TrainingRoutine, TrainingSession } from '../types'
import { intervalDaysInWeek, normalizeSchedule, scheduleStatus } from './planSchedule'

const workout = (id: string): TrainingRoutine => ({ id, name: id, kind: 'strength', exercises: [], weekdays: [], sortOrder: 0, folder: 'PPL' })
const session = (routineId: string, startedAt: string): TrainingSession => ({
  id: startedAt, kind: 'strength', title: '', startedAt, endedAt: null, durationS: 3600, distanceM: null, kcal: null,
  avgHr: null, rpe: null, notes: null, routineId, source: 'live', externalId: null, exercises: [],
} as unknown as TrainingSession)

const plan = [workout('push'), workout('pull'), workout('legs')]
// Mittwoch, 4.11.2026, 10 Uhr
const now = new Date(2026, 10, 4, 10)

describe('normalizeSchedule', () => {
  it('faellt auf Wochentage zurueck und begrenzt Zahlen', () => {
    expect(normalizeSchedule(null)).toEqual({ mode: 'weekdays' })
    expect(normalizeSchedule({ mode: 'per_week', perWeek: 12 })).toEqual({ mode: 'per_week', perWeek: 7 })
    expect(normalizeSchedule({ mode: 'interval', everyDays: 0 })).toEqual({ mode: 'interval', everyDays: 1 })
    expect(normalizeSchedule({ mode: 'interval' })).toEqual({ mode: 'interval', everyDays: 2 })
  })
})

describe('X-mal pro Woche', () => {
  it('ist dran, solange das Wochenziel offen ist', () => {
    const s = scheduleStatus({ mode: 'per_week', perWeek: 3 }, plan, [session('push', '2026-11-02T17:00:00')], now)
    expect(s).toMatchObject({ dueToday: true, doneThisWeek: 1 })
  })
  it('heute schon trainiert: morgen', () => {
    const s = scheduleStatus({ mode: 'per_week', perWeek: 3 }, plan, [session('push', '2026-11-04T08:00:00')], now)
    expect(s.dueToday).toBe(false)
    expect(s.nextDate).toEqual(new Date(2026, 10, 5))
  })
  it('Ziel erreicht: ab Montag', () => {
    const done = ['2026-11-02T08:00:00', '2026-11-03T08:00:00'].map(t => session('pull', t))
    const s = scheduleStatus({ mode: 'per_week', perWeek: 2 }, plan, done, now)
    expect(s.dueToday).toBe(false)
    expect(s.nextDate).toEqual(new Date(2026, 10, 9))
  })
  it('zaehlt nur Einheiten aus dem Plan', () => {
    const s = scheduleStatus({ mode: 'per_week', perWeek: 1 }, plan, [session('other', '2026-11-03T08:00:00')], now)
    expect(s).toMatchObject({ dueToday: true, doneThisWeek: 0 })
  })
})

describe('alle X Tage', () => {
  it('zaehlt ab der letzten Einheit', () => {
    const s = scheduleStatus({ mode: 'interval', everyDays: 3 }, plan, [session('push', '2026-11-03T18:00:00')], now)
    expect(s.dueToday).toBe(false)
    expect(s.nextDate).toEqual(new Date(2026, 10, 6))
    expect(intervalDaysInWeek(s, 3, now)).toEqual([4])
  })
  it('ueberfaellig oder noch nie: heute', () => {
    expect(scheduleStatus({ mode: 'interval', everyDays: 2 }, plan, [session('push', '2026-10-20T18:00:00')], now).dueToday).toBe(true)
    expect(scheduleStatus({ mode: 'interval', everyDays: 2 }, plan, [], now).dueToday).toBe(true)
  })
  it('heute trainiert: in X Tagen wieder', () => {
    const s = scheduleStatus({ mode: 'interval', everyDays: 2 }, plan, [session('legs', '2026-11-04T07:00:00')], now)
    expect(s).toMatchObject({ dueToday: false, trainedToday: true })
    expect(s.nextDate).toEqual(new Date(2026, 10, 6))
    expect(intervalDaysInWeek(s, 2, now)).toEqual([4, 6])
  })
})
