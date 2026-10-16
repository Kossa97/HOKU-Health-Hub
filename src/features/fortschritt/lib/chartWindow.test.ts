import { describe, it, expect } from 'vitest'
import { MIN_WINDOW_DAYS, rangeBounds, windowMsForRange } from './chartWindow'

const DAY = 24 * 3_600_000

describe('windowMsForRange', () => {
  it('ist so breit wie der Seiten-Zeitraum', () => {
    expect(windowMsForRange({ from: '2026-07-01', to: '2026-09-29' })).toBe(90 * DAY)
    expect(windowMsForRange({ from: '2025-10-16', to: '2026-10-16' })).toBe(365 * DAY)
  })

  it('zählt ganze Tage, auch über die Zeitumstellung', () => {
    // 25.10.2026 endet die Sommerzeit: 30 Kalendertage sind 30 Tage + 1 Stunde.
    expect(windowMsForRange({ from: '2026-10-20', to: '2026-11-19' })).toBe(30 * DAY)
  })

  it('wird nie schmaler als 30 Tage', () => {
    expect(MIN_WINDOW_DAYS).toBe(30)
    expect(windowMsForRange({ from: '2026-10-10', to: '2026-10-16' })).toBe(30 * DAY)
  })
})

describe('rangeBounds', () => {
  it('wandelt from/to in Timestamps um', () => {
    const { start, now } = rangeBounds({ from: '2026-01-01', to: '2026-01-31' })
    expect(now - start).toBe(30 * DAY)
  })

  it('klemmt now nicht unter start', () => {
    const { start, now } = rangeBounds({ from: '2026-02-01', to: '2026-01-01' })
    expect(now).toBe(start)
  })

  it('faellt bei kaputtem Datum auf einen gueltigen Bereich zurueck', () => {
    const { start, now } = rangeBounds({ from: 'quatsch', to: 'quatsch' })
    expect(Number.isFinite(start)).toBe(true)
    expect(now).toBeGreaterThanOrEqual(start)
  })
})
