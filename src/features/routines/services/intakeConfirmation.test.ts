import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoutineConfirmationEntry } from '../intakeGroups'
import {
  markiereNichtGenommen,
  confirmIntakeGroup,
  quantifiedVialEntries,
  skipIntakeGroup,
  skipIntakeGroupsInBatches,
  type IntakeConfirmationClient,
} from './intakeConfirmation'
import { slotSchluesselFuerZeitpunkt } from '../lib/slotKey'

function entry(overrides: Partial<RoutineConfirmationEntry> = {}): RoutineConfirmationEntry {
  const basis: RoutineConfirmationEntry = {
    key: '',
    cycleId: 'cycle-d3',
    planVersionId: 'version-d3',
    pendingLogId: null,
    stackItemId: 'stack-d3',
    stackItemName: 'Vitamin D3',
    trackingLevel: 'intake_only',
    group: 'morning',
    scheduledAt: '2026-07-29T08:00:00.000Z',
    dose: null,
    unit: null,
    method: 'Oral',
    injectable: false,
    selected: true,
    actualDose: null,
    actualUnit: null,
    ...overrides,
  }
  // `key` ist die Identitaet des Platzes im Plan, und `confirmIntakeGroup`
  // weist alles zurueck, was kein Slot-Schluessel dieses Zyklus ist. Hier
  // stand frueher ein Kuerzel wie `d3` -- damit prueften die Faelle unten
  // etwas, das es in der App nie gab, und die Ecke, an der eine falsche
  // Identitaet eine zweite Zeile anlegt, blieb ungedeckt.
  return {
    ...basis,
    key: overrides.key ?? slotSchluesselFuerZeitpunkt(basis.cycleId, basis.scheduledAt, 'Europe/Berlin'),
  }
}

describe('confirmIntakeGroup', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves all selected mixed entries in one RPC call and returns their saved log IDs', async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'de-DE',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'Europe/Berlin',
    })
    const calls: Array<{ name: string; params: unknown }> = []
    const client: IntakeConfirmationClient = {
      rpc: async (name, params) => {
        calls.push({ name, params })
        return { data: [{ id: 'log-d3' }, { id: 'log-zinc' }], error: null }
      },
    }

    const result = await confirmIntakeGroup(client, [
      entry(),
      entry({
        cycleId: 'cycle-zinc',
        planVersionId: null,
        pendingLogId: 'pending-zinc',
        stackItemId: 'stack-zinc',
        stackItemName: 'Zink',
        trackingLevel: 'with_amount',
        dose: 25,
        unit: 'mg',
        actualDose: 30,
        actualUnit: 'mg',
      }),
      entry({ cycleId: 'cycle-off', selected: false }),
    ])

    // Die RPC gibt die volle Zeile zurueck (`returns setof dose_logs`), nicht
    // nur die id -- genau die Zeile, die der Mock oben schickt, unveraendert.
    expect(result).toEqual([{ id: 'log-d3' }, { id: 'log-zinc' }])
    expect(calls).toEqual([{
      name: 'confirm_intake_group',
      params: {
        p_entries: [
          {
            cycle_id: 'cycle-d3',
            plan_version_id: 'version-d3',
            timezone: 'Europe/Berlin',
            dose_log_id: null,
            slot_key: 'cycle-d3@2026-07-29T10:00',
            stack_item_id: 'stack-d3',
            dose: null,
            unit: null,
            method: 'Oral',
            logged_at: '2026-07-29T08:00:00.000Z',
            taken: true,
          },
          {
            cycle_id: 'cycle-zinc',
            plan_version_id: null,
            timezone: 'Europe/Berlin',
            dose_log_id: 'pending-zinc',
            slot_key: 'cycle-zinc@2026-07-29T10:00',
            stack_item_id: 'stack-zinc',
            dose: 30,
            unit: 'mg',
            method: 'Oral',
            logged_at: '2026-07-29T08:00:00.000Z',
            taken: true,
          },
        ],
      },
    }])
  })

  it('falls back to UTC only when the runtime supplies no timezone', async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: '',
    })
    const calls: Array<{ params: { p_entries: Array<{ timezone: string }> } }> = []
    const client: IntakeConfirmationClient = {
      rpc: async (_name, params) => {
        calls.push({ params })
        return { data: [{ id: 'log-d3' }], error: null }
      },
    }

    await confirmIntakeGroup(client, [entry({ planVersionId: null })])

    expect(calls[0].params.p_entries[0].timezone).toBe('UTC')
  })

  it('routes a skipped intake through the same authoritative RPC decision path', async () => {
    const rpc = vi.fn(async () => ({ data: [{ id: 'skipped-log' }], error: null }))

    await expect(skipIntakeGroup({ rpc }, [entry({
      pendingLogId: 'pending-d3',
      actualLoggedAt: '2026-07-29T08:15:00.000Z',
    })])).resolves.toEqual([{ id: 'skipped-log' }])

    expect(rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({
        dose_log_id: 'pending-d3',
        slot_key: 'cycle-d3@2026-07-29T10:00',
        logged_at: '2026-07-29T08:15:00.000Z',
        taken: false,
      })],
    })
  })

  it('nimmt den geplanten Schluessel und baut ihn nur fuer den alten Zweig', async () => {
    // Zwei Herkuenfte, zwei Regeln. Unter der Zeitleiste traegt `key` die
    // geplante Wanduhr -- die reist mit und muss unveraendert durchgereicht
    // werden. Der alte Home-Zweig baut statt eines Schluessels ein Kuerzel
    // aus Zyklus und Minute; dort wird der Schluessel aus dem Zeitpunkt
    // gebaut, sonst landete `cycle-1-480` in einer Spalte mit Unique-Index.
    const gesendet: string[] = []
    const rpc = vi.fn(async (_name: string, params: { p_entries: { slot_key: string }[] }) => {
      gesendet.push(params.p_entries[0]!.slot_key)
      return { data: [{ id: 'log-1' }], error: null }
    })

    await confirmIntakeGroup({ rpc } as never, [entry({ key: 'cycle-d3@2026-07-29T08:00' })])
    expect(gesendet.at(-1)).toBe('cycle-d3@2026-07-29T08:00')

    await confirmIntakeGroup({ rpc } as never, [entry({ key: 'cycle-d3-480' })])
    // 2026-07-29T08:00Z ist in Berlin 10:00 -- aus dem Zeitpunkt gebaut.
    expect(gesendet.at(-1)).toBe('cycle-d3@2026-07-29T10:00')

    // Auch ein Schluessel mit fremdem Zyklus gilt nicht als Planung.
    await confirmIntakeGroup({ rpc } as never, [entry({ key: 'cycle-fremd@2026-07-29T08:00' })])
    expect(gesendet.at(-1)).toBe('cycle-d3@2026-07-29T10:00')
  })

  it('splits a large automatic missed-intake backlog into sequential bounded RPC calls', async () => {
    const rpc = vi.fn(async (_name, params) => ({
      data: params.p_entries.map((item: { stack_item_id: string }) => ({ id: `log-${item.stack_item_id}` })),
      error: null,
    }))
    const entries = Array.from({ length: 5 }, (_, index) => entry({
      cycleId: `cycle-${index}`,
      stackItemId: `stack-${index}`,
      scheduledAt: `2026-07-${String(20 + index).padStart(2, '0')}T08:00:00.000Z`,
    }))

    await expect(skipIntakeGroupsInBatches({ rpc }, entries, 2)).resolves.toEqual([
      { id: 'log-stack-0' },
      { id: 'log-stack-1' },
      { id: 'log-stack-2' },
      { id: 'log-stack-3' },
      { id: 'log-stack-4' },
    ])
    expect(rpc.mock.calls.map(([, params]) => params.p_entries)).toHaveLength(3)
    expect(rpc.mock.calls.map(([, params]) => params.p_entries.length)).toEqual([2, 2, 1])
  })

  it('keeps occurrence identity while sending an edited actual log time', async () => {
    const rpc = vi.fn(async () => ({ data: [{ id: 'saved' }], error: null }))
    await confirmIntakeGroup({ rpc }, [entry({
      actualLoggedAt: '2026-07-29T16:00:00.000Z',
      planVersionId: 'version-afternoon',
    })])
    expect(rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({
        slot_key: 'cycle-d3@2026-07-29T10:00',
        logged_at: '2026-07-29T16:00:00.000Z',
        plan_version_id: 'version-afternoon',
      })],
    })
  })

  it('surfaces an RPC failure to the confirmation sheet', async () => {
    const client: IntakeConfirmationClient = {
      rpc: async () => ({ data: null, error: { message: 'group rejected' } }),
    }

    await expect(confirmIntakeGroup(client, [entry()])).rejects.toThrow('group rejected')
  })

  it('reuses the same deterministic slot key after an ambiguous retry', async () => {
    const slotKeys: string[] = []
    let attempt = 0
    const client: IntakeConfirmationClient = {
      rpc: async (_name, params) => {
        slotKeys.push(params.p_entries[0].slot_key)
        attempt += 1
        return attempt === 1
          ? { data: null, error: { message: 'response lost' } }
          : { data: [{ id: 'committed-log' }], error: null }
      },
    }

    await expect(confirmIntakeGroup(client, [entry()])).rejects.toThrow('response lost')
    await expect(confirmIntakeGroup(client, [entry()])).resolves.toEqual([{ id: 'committed-log' }])
    expect(slotKeys).toEqual([
      'cycle-d3@2026-07-29T10:00',
      'cycle-d3@2026-07-29T10:00',
    ])
  })

  it('limits post-confirm stock debits to selected quantified vial entries', () => {
    const vial = entry({
      key: 'vial',
      stackItemId: 'stack-vial',
      trackingLevel: 'complete',
      dose: 2,
      unit: 'mg',
      actualDose: 2,
      actualUnit: 'mg',
    })
    const deselectedVial = { ...vial, key: 'off', selected: false }
    const quantifiedTablet = { ...vial, key: 'tablet', stackItemId: 'stack-tablet' }

    expect(quantifiedVialEntries(
      [entry(), vial, deselectedVial, quantifiedTablet],
      new Set(['stack-vial']),
    ).map(item => item.key)).toEqual(['vial'])
  })
})

describe('markiereNichtGenommen', () => {
  it('markiert nur nicht genommene Zeilen ohne eigene Notiz', async () => {
    const inIds = vi.fn(async (_column: 'id', _ids: string[]) => ({ error: null }))
    const update = vi.fn((_row: { notes: string }) => ({ in: inIds }))
    const client = { from: vi.fn(() => ({ update })) }
    const ids = await markiereNichtGenommen(client, [
      { id: 'a', taken: false, notes: null },
      { id: 'b', taken: true, notes: null },
      { id: 'c', taken: false, notes: 'eigene Notiz' },
    ], 'skipped')
    expect(ids).toEqual(['a'])
    expect(update).toHaveBeenCalledWith({ notes: 'skipped' })
    expect(inIds).toHaveBeenCalledWith('id', ['a'])
  })

  it('lässt die Entscheidung stehen, wenn der Marker nicht gesetzt werden kann', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const client = { from: () => ({ update: () => ({ in: async () => ({ error: { message: 'offline' } }) }) }) }
    await expect(markiereNichtGenommen(client, [{ id: 'a', taken: false }], 'skipped')).resolves.toEqual([])
  })
})
