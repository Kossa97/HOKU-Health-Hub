import { describe, expect, it, vi } from 'vitest'
import type { RoutineIntake } from '../intakeGroups'
import {
  bundleDueIntakes,
  bundlesForPeriod,
  liveBundleItemIds,
  normalizeBundleName,
  saveIntakeBundle,
  type IntakeBundleClient,
} from './intakeBundles'

function intake(stackItemId: string, scheduledAt: string, key = `${stackItemId}-${scheduledAt}`): RoutineIntake {
  return {
    key,
    cycleId: `cycle-${stackItemId}`,
    planVersionId: null,
    pendingLogId: null,
    stackItemId,
    stackItemName: stackItemId,
    trackingLevel: 'complete',
    group: 'morning',
    scheduledAt,
    dose: 1,
    unit: 'mg',
    method: 'oral',
    injectable: false,
  }
}

describe('bundleDueIntakes', () => {
  it('takes only the earliest open intake per substance', () => {
    const due = [
      intake('a', '2026-10-16T18:00:00.000Z'),
      intake('a', '2026-10-16T07:00:00.000Z'),
      intake('b', '2026-10-16T08:00:00.000Z'),
    ]
    const result = bundleDueIntakes({ stack_item_ids: ['a', 'b'] }, due)
    expect(result.map(item => item.key)).toEqual([
      'a-2026-10-16T07:00:00.000Z',
      'b-2026-10-16T08:00:00.000Z',
    ])
  })

  it('follows the bundle order and skips members without an open intake', () => {
    const due = [intake('a', '2026-10-16T07:00:00.000Z'), intake('c', '2026-10-16T06:00:00.000Z')]
    const result = bundleDueIntakes({ stack_item_ids: ['c', 'b', 'a', 'c'] }, due)
    expect(result.map(item => item.stackItemId)).toEqual(['c', 'a'])
  })

  it('ignores open intakes of substances outside the bundle', () => {
    expect(bundleDueIntakes({ stack_item_ids: ['x'] }, [intake('a', '2026-10-16T07:00:00.000Z')])).toEqual([])
  })
})

describe('bundlesForPeriod', () => {
  const morgen = [
    intake('a', '2026-10-16T07:00:00.000Z'),
    intake('b', '2026-10-16T07:30:00.000Z'),
    intake('c', '2026-10-16T08:00:00.000Z'),
  ]

  it('takes the members open in this period and marks them as taken', () => {
    const { entries, vergeben } = bundlesForPeriod([{ bundle: 'Morgen', itemIds: ['a', 'b', 'x'] }], morgen)
    expect(entries).toHaveLength(1)
    expect(entries[0].intakes.map(item => item.stackItemId)).toEqual(['a', 'b'])
    expect([...vergeben].sort()).toEqual(['a-2026-10-16T07:00:00.000Z', 'b-2026-10-16T07:30:00.000Z'])
  })

  it('gives a substance in two bundles to the first one only', () => {
    const vier = [...morgen, intake('d', '2026-10-16T08:30:00.000Z')]
    const { entries } = bundlesForPeriod([
      { bundle: 'Erstes', itemIds: ['a', 'b'] },
      { bundle: 'Zweites', itemIds: ['b', 'c', 'd'] },
    ], vier)
    expect(entries.map(entry => [entry.bundle, entry.intakes.map(item => item.stackItemId)])).toEqual([
      ['Erstes', ['a', 'b']],
      ['Zweites', ['c', 'd']],
    ])
  })

  it('leaves out a bundle with nothing open in this period', () => {
    const { entries, vergeben } = bundlesForPeriod([{ bundle: 'Abend', itemIds: ['z'] }], morgen)
    expect(entries).toEqual([])
    expect(vergeben.size).toBe(0)
  })

  it('shows a bundle only with at least two open intakes; one alone stays single', () => {
    // Sonntags-Bündel: Magnesium täglich, Melatonin nur sonntags.
    const werktag = [intake('magnesium', '2026-10-16T21:00:00.000Z')]
    const sonntag = [...werktag, intake('melatonin', '2026-10-18T21:30:00.000Z')]
    const buendel = [{ bundle: 'Sonntag', itemIds: ['magnesium', 'melatonin'] }]
    expect(bundlesForPeriod(buendel, werktag)).toEqual({ entries: [], vergeben: new Set() })
    expect(bundlesForPeriod(buendel, sonntag).entries).toHaveLength(1)
  })

  it('does not count a substance an earlier bundle already holds', () => {
    // Magnesium steckt in beiden; das erste Bündel hält es. Das zweite hätte
    // nur noch Vitamin D — ein Bündel aus einer Einnahme ist keins.
    const abend = [intake('magnesium', '2026-10-18T21:00:00.000Z'), intake('melatonin', '2026-10-18T21:30:00.000Z'),
      intake('vitd', '2026-10-18T21:00:00.000Z')]
    const { entries } = bundlesForPeriod([
      { bundle: 'Sonntag', itemIds: ['magnesium', 'melatonin'] },
      { bundle: 'Neu', itemIds: ['magnesium', 'vitd'] },
    ], abend, new Set(['magnesium', 'melatonin', 'vitd']))
    expect(entries.map(entry => [entry.bundle, entry.anzahl])).toEqual([['Sonntag', 2]])
  })

  it('counts what is planned, not what is still open: one confirmed keeps the bundle', () => {
    const buendel = [{ bundle: 'Sonntag', itemIds: ['magnesium', 'melatonin'] }]
    const nurNochMelatonin = [intake('melatonin', '2026-10-18T21:30:00.000Z')]
    // Sonntag, Magnesium schon bestätigt: beide geplant, eine offen.
    expect(bundlesForPeriod(buendel, nurNochMelatonin, new Set(['magnesium', 'melatonin'])).entries[0].intakes
      .map(item => item.stackItemId)).toEqual(['melatonin'])
    // Werktag: nur Magnesium geplant.
    expect(bundlesForPeriod(buendel, [intake('magnesium', '2026-10-16T21:00:00.000Z')], new Set(['magnesium'])).entries).toEqual([])
  })

  it('takes only the earliest intake per substance; a second one stays single', () => {
    const zweimal = [
      intake('a', '2026-10-16T07:00:00.000Z'),
      intake('a', '2026-10-16T09:00:00.000Z'),
      intake('b', '2026-10-16T07:30:00.000Z'),
    ]
    const { entries, vergeben } = bundlesForPeriod([{ bundle: 'Morgen', itemIds: ['a', 'b'] }], zweimal)
    expect(entries[0].intakes.map(item => item.key)).toEqual(['a-2026-10-16T07:00:00.000Z', 'b-2026-10-16T07:30:00.000Z'])
    expect(vergeben.has('a-2026-10-16T09:00:00.000Z')).toBe(false)
  })
})

describe('liveBundleItemIds', () => {
  it('drops archived or deleted substances and duplicates', () => {
    expect(liveBundleItemIds({ stack_item_ids: ['a', 'gone', 'b', 'a'] }, new Set(['a', 'b']))).toEqual(['a', 'b'])
  })
})

describe('normalizeBundleName', () => {
  it('trims, collapses whitespace and caps the length', () => {
    expect(normalizeBundleName('  Morgen   Stack ')).toBe('Morgen Stack')
    expect(normalizeBundleName('x'.repeat(80))).toHaveLength(60)
  })
})

describe('saveIntakeBundle', () => {
  it('refuses an empty bundle before touching the database', async () => {
    const from = vi.fn()
    const client = { from } as unknown as IntakeBundleClient
    await expect(saveIntakeBundle(client, 'u', { name: 'Morgen', stackItemIds: [], sortOrder: 0 }))
      .rejects.toThrow('no items')
    await expect(saveIntakeBundle(client, 'u', { name: '   ', stackItemIds: ['a'], sortOrder: 0 }))
      .rejects.toThrow('empty')
    expect(from).not.toHaveBeenCalled()
  })

  it('inserts a new bundle with deduplicated items', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'b1' }, error: null })
    const insert = vi.fn(() => ({ select: () => ({ single }) }))
    const client = { from: () => ({ insert }) } as unknown as IntakeBundleClient
    await saveIntakeBundle(client, 'u', { name: ' Morgen ', stackItemIds: ['a', 'a', 'b'], sortOrder: 2 })
    expect(insert).toHaveBeenCalledWith({ user_id: 'u', name: 'Morgen', stack_item_ids: ['a', 'b'], sort_order: 2 })
  })
})
