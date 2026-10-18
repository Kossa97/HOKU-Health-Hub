import { describe, expect, it } from 'vitest'
import type { TrainingSession } from '../types'
import { computeReadiness, loadRatio } from './readiness'

const now = new Date('2026-10-18T07:00:00Z')

function run(daysAgo: number, minutes: number, rpe: number | null = null): TrainingSession {
  return {
    id: `r${daysAgo}`, kind: 'run', title: '', startedAt: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
    endedAt: null, durationS: minutes * 60, distanceM: null, kcal: null, avgHr: null, rpe, notes: null,
    routineId: null, exercises: [], source: 'manual', externalId: null,
  }
}

describe('computeReadiness', () => {
  it('gibt ohne einen einzigen Faktor keinen Wert', () => {
    expect(computeReadiness({ now })).toBeNull()
    expect(computeReadiness({ now, sleepHours: { today: 7, history: [7, 7] } })).toBeNull()
  })

  it('liegt bei normalem Schlaf und Puls im normalen Bereich', () => {
    const r = computeReadiness({
      now,
      sleepHours: { today: 7.5, history: [7.5, 7.4, 7.6, 7.5] },
      restingHr: { today: 55, history: [55, 56, 54, 55] },
    })
    expect(r?.level).toBe('normal')
    expect(r?.score).toBe(70)
  })

  it('sinkt bei kurzem Schlaf und erhoehtem Ruhepuls', () => {
    const r = computeReadiness({
      now,
      sleepHours: { today: 5, history: [7.5, 7.5, 7.5, 7.5] },
      restingHr: { today: 62, history: [55, 55, 55, 55] },
    })
    expect(r?.level).toBe('low')
    expect(r?.factors.find(f => f.key === 'resting_hr')?.points).toBeLessThan(0)
  })

  it('nimmt die Tagesform nur, wenn die Uhr keinen Schlaf liefert', () => {
    const withWatch = computeReadiness({
      now, sleepHours: { today: 8, history: [8, 8, 8] }, wellness: { sleep: 2, energy: 2 },
    })
    expect(withWatch?.factors.map(f => f.key)).toEqual(['sleep'])
    const withoutWatch = computeReadiness({ now, wellness: { sleep: 9, energy: 8 } })
    expect(withoutWatch?.factors.map(f => f.key)).toEqual(['wellness'])
    expect(withoutWatch?.level).toBe('high')
  })

  it('bremst bei sprunghaft gestiegener Last', () => {
    const sessions = [run(20, 30), run(15, 30), run(10, 30), run(3, 120, 8), run(2, 120, 8), run(1, 120, 8)]
    const ratio = loadRatio(sessions, now)
    expect(ratio?.ratio).toBeGreaterThan(1.3)
    const r = computeReadiness({ now, wellness: { sleep: 5, energy: 5 }, sessions })
    expect(r?.factors.find(f => f.key === 'load')?.points).toBeLessThan(0)
  })
})
