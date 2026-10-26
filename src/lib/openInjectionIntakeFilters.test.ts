import { describe, expect, it } from 'vitest'
import { filterOpenInjectionIntakes } from './openInjectionIntakeFilters'
import type { OpenInjectionIntake } from './injectionPersistence'

const intake = (
  cycleId: string,
  scheduledAt: string,
  daysOverdue: number,
): OpenInjectionIntake => ({
  cycleId,
  stackItemId: `stack-item-${cycleId}`,
  stackItemName: cycleId,
  cycleName: cycleId,
  dose: 100,
  unit: 'mcg',
  method: 'Subkutan',
  scheduledAt,
  daysOverdue,
  status: cycleId === 'cycle-b' ? 'confirmed' : 'open',
  doseLogId: cycleId === 'cycle-b' ? 'dose-b' : null,
})

describe('filterOpenInjectionIntakes', () => {
  const intakes = [
    intake('cycle-a', '2026-06-23T20:00:00.000Z', 1),
    intake('cycle-b', '2026-06-20T20:00:00.000Z', 4),
    intake('cycle-a', '2026-06-14T20:00:00.000Z', 10),
  ]

  it('defaults to all cycles, all statuses, the last 7 days, newest first', () => {
    expect(filterOpenInjectionIntakes(intakes).map(item => item.scheduledAt)).toEqual([
      '2026-06-23T20:00:00.000Z',
      '2026-06-20T20:00:00.000Z',
    ])
  })

  it('filters by cycle and can sort oldest first', () => {
    expect(filterOpenInjectionIntakes(intakes, {
      cycleId: 'cycle-a',
      days: 'all',
      order: 'oldest',
    }).map(item => item.scheduledAt)).toEqual([
      '2026-06-14T20:00:00.000Z',
      '2026-06-23T20:00:00.000Z',
    ])
  })

  it('filters by substance across cycles', () => {
    expect(filterOpenInjectionIntakes(intakes, { stackItemId: 'stack-item-cycle-b', days: 'all' })
      .map(item => item.cycleId)).toEqual(['cycle-b'])
  })

  it('filters open and confirmed intakes by status', () => {
    expect(filterOpenInjectionIntakes(intakes, { status: 'open' }).map(item => item.status)).toEqual([
      'open',
    ])
    expect(filterOpenInjectionIntakes(intakes, { status: 'confirmed' }).map(item => item.status)).toEqual([
      'confirmed',
    ])
  })
  it('filters today and yesterday as exact day buckets', () => {
    expect(filterOpenInjectionIntakes(intakes, { days: 0, status: 'open' }).map(item => item.daysOverdue)).toEqual([])
    expect(filterOpenInjectionIntakes(intakes, { days: 1, status: 'open' }).map(item => item.scheduledAt)).toEqual([
      '2026-06-23T20:00:00.000Z',
    ])
  })
})