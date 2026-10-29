import { describe, expect, it } from 'vitest'
import type { TrainingRoutine, TrainingSession } from '../types'
import { weekDays } from './weekStrip'

const session = (startedAt: string, durationS: number, title: string): TrainingSession => ({
  id: title, kind: 'strength', title, startedAt, endedAt: null, durationS, distanceM: null, kcal: null,
  avgHr: null, rpe: null, notes: null, routineId: null, exercises: [], source: 'live', externalId: null,
})
const routine = (name: string, weekdays: number[]): TrainingRoutine => ({
  id: name, name, kind: 'strength', weekdays, exercises: [], sortOrder: 0, folder: null,
})

describe('weekDays', () => {
  // Donnerstag, 29.10.2026, mittags
  const now = new Date(2026, 9, 29, 12)

  it('liefert Montag bis Sonntag der laufenden Woche, heute markiert', () => {
    const days = weekDays(now, [], [])
    expect(days.map(d => d.date.getDate())).toEqual([26, 27, 28, 29, 30, 31, 1])
    expect(days.map(d => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(days.findIndex(d => d.isToday)).toBe(3)
    expect(days.filter(d => d.isPast)).toHaveLength(3)
  })

  it('ordnet Einheiten dem Tag zu, die laengste zuerst', () => {
    const days = weekDays(now, [
      session(new Date(2026, 9, 26, 18).toISOString(), 1800, 'kurz'),
      session(new Date(2026, 9, 26, 7).toISOString(), 3600, 'lang'),
      session(new Date(2026, 9, 19, 7).toISOString(), 3600, 'letzte Woche'),
    ], [])
    expect(days[0].sessions.map(s => s.title)).toEqual(['lang', 'kurz'])
    expect(days.flatMap(d => d.sessions)).toHaveLength(2)
  })

  it('plant nur heute und spaeter', () => {
    const days = weekDays(now, [], [routine('Push', [1, 6]), routine('Beine', [4])])
    expect(days[0].planned).toEqual([])
    expect(days[3].planned.map(r => r.name)).toEqual(['Beine'])
    expect(days[5].planned.map(r => r.name)).toEqual(['Push'])
  })
})
