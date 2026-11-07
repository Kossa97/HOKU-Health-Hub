import { describe, expect, it } from 'vitest'
import { activityBonus, activityDayFrom, activityTotal, estimateActiveKcal, goalsFor, parseSources } from './activity'

const day = {
  healthKcal: 320,
  trainings: [{ id: 't', title: 'Push', startedAt: '2026-11-03T17:10:00Z', kcal: 210, estimated: false }],
  logs: [{ id: 'l', label: 'Rad', minutes: 45, kcal: 300 }],
}

describe('activityTotal', () => {
  it('Apple Health enthält Trainings: nur Health plus selbst eingetragen', () => {
    expect(activityTotal(day, ['health', 'training', 'manual'])).toEqual({ kcal: 620, trainingsInHealth: true })
  })
  it('ohne Health zählen Trainings aus der App', () => {
    expect(activityTotal({ ...day, healthKcal: null }, ['health', 'training', 'manual'])).toEqual({ kcal: 510, trainingsInHealth: false })
    expect(activityTotal(day, ['training', 'manual'])).toEqual({ kcal: 510, trainingsInHealth: false })
  })
  it('Health mit 0 kcal gilt als „keine Daten“', () => {
    expect(activityTotal({ ...day, healthKcal: 0 }, ['health', 'training'])).toEqual({ kcal: 210, trainingsInHealth: false })
  })
  it('abgeschaltete Quellen zählen nicht; Trainings ohne kcal zählen 0', () => {
    expect(activityTotal(day, [])).toEqual({ kcal: 0, trainingsInHealth: false })
    expect(activityTotal({ healthKcal: null, logs: [], trainings: [{ ...day.trainings[0], kcal: null }] }, ['training']).kcal).toBe(0)
  })
})

describe('activityBonus', () => {
  it('Defizit: nichts aufs Ziel', () => expect(activityBonus({ activityMode: 'deficit', activityShare: 'full' }, 320)).toBe(0))
  it('Tagesbedarf zur Hälfte oder voll', () => {
    expect(activityBonus({ activityMode: 'budget', activityShare: 'half' }, 321)).toBe(161)
    expect(activityBonus({ activityMode: 'budget', activityShare: 'full' }, 320)).toBe(320)
    expect(activityBonus({ activityMode: 'budget', activityShare: 'full' }, 0)).toBe(0)
  })
})

describe('estimateActiveKcal', () => {
  it('MET 5 ohne Ruheumsatz: 4 × kg × Stunden', () => expect(estimateActiveKcal(45, 80)).toBe(240))
  it('ohne Gewicht oder Dauer keine Schätzung', () => {
    expect(estimateActiveKcal(45, null)).toBeNull()
    expect(estimateActiveKcal(0, 80)).toBeNull()
  })
})

describe('parseSources', () => {
  it('nichts gespeichert = alle; Unbekanntes fällt weg; Reihenfolge fest', () => {
    expect(parseSources(null)).toEqual(['health', 'training', 'manual'])
    expect(parseSources(['manual', 'x', 'health'])).toEqual(['health', 'manual'])
    expect(parseSources([])).toEqual([])
  })
})

describe('goalsFor', () => {
  const g = { kcal: 2000, hideKcal: false }
  it('nur am Tag mit Bonus wächst das Ziel', () => {
    expect(goalsFor(g, { '2026-11-07': 160 }, '2026-11-07').kcal).toBe(2160)
    expect(goalsFor(g, { '2026-11-07': 160 }, '2026-11-06').kcal).toBe(2000)
    expect(goalsFor(g, null, '2026-11-07')).toBe(g)
    expect(goalsFor({ ...g, hideKcal: true }, { '2026-11-07': 160 }, '2026-11-07').kcal).toBe(2000)
  })
})

describe('activityDayFrom', () => {
  it('schätzt Trainings ohne Uhr-Werte, behält gemessene', () => {
    const d = activityDayFrom({ healthKcal: null, logs: [], trainings: [
      { id: 'a', title: 'Push', startedAt: '', durationS: 2700, kcal: null },
      { id: 'b', title: 'Lauf', startedAt: '', durationS: 1800, kcal: 300 },
      { id: 'c', title: 'Ohne Dauer', startedAt: '', durationS: null, kcal: null },
    ] }, 80)
    expect(d.trainings.map(t => [t.kcal, t.estimated])).toEqual([[240, true], [300, false], [null, false]])
  })
})
