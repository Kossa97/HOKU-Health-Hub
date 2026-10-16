// src/lib/injectionPersistence.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FEATURES } from '../config/features'
import type { CycleTimeline } from './planTimeline'
import { AUTO_MISSED_NOTE } from './intakeSchedule'
vi.mock('../config/features', () => ({ FEATURES: { planTimelineV2: false } }))
import {
  assertInjectionProSchema,
  buildSelectableInjectionIntakes,
  buildInjectionInsertPayload,
  confirmIntakeDoseLog,
  confirmIntakeWithInjection,
  resetAtomicConfirmRpcCache,
  isDoseLogAlreadyLinkedError,
  isInjectionProSchemaError,
  injectionIntakeLookbackStart,
  loadInjectionLogs,
  loadSelectableInjectionIntakes,
  loadSelectableInjectionCycles,
  resolveInjectionDoseLogId,
} from './injectionPersistence'

describe('normalized injection provenance', () => {
  afterEach(() => { (FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false; vi.useRealTimers(); resetAtomicConfirmRpcCache() })
  const timeline: CycleTimeline = {
    cycle: { id: 'c1', stack_item_id: 's1', started_at: '2026-09-19T00:00:00Z', ended_at: null },
    versions: [{ id: 'v1', cycle_id: 'c1', effective_kind: 'local_date', effective_at: null,
      effective_local_date: '2026-09-19', change_kind: 'initial', frequency: 'Täglich',
      x_days_interval: null, interval_unit: null, cycle_on_days: null, cycle_off_days: null,
      schedule_days: [], intake_time: 'custom', intake_time_custom: '08:00', slot_doses: null,
      slot_days: null, dose: 1, unit: 'mg', method: 'Subkutan' }], pauses: [],
  }
  const pending = { id: 'log-1', stack_item_id: 's1', cycle_id: 'c1', plan_version_id: 'v1',
    routine_slot_key: 'c1@2026-09-19T08:00', logged_at: '2026-09-19T06:15:00.000Z',
    taken: null, dose: 250, unit: 'mcg', method: 'Intramuskulaer' }
  function build(logs: any[] = [], timelines = [timeline]) {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    return buildSelectableInjectionIntakes({ cycles: [], timelines, logs, linkedDoseLogIds: new Set(), escalations: [],
      now: new Date('2026-09-19T12:00:00Z'), lookbackDays: 0, timeZone: 'Europe/Berlin' } as never)
  }
  function timelineReader(timelines = [timeline]) {
    return vi.fn((table: string) => {
      if (table !== 'cycles') throw new Error('Only timeline reads allowed')
      const query: any = { select: () => query, eq: () => query, order: () => query,
        then: (resolve: any) => Promise.resolve({ data: timelines.map(row => ({ ...row.cycle,
          versions: row.versions, pauses: row.pauses })), error: null }).then(resolve) }
      return query
    })
  }
  it('carries exact version and stable slot identity for an open normalized occurrence', () => {
    expect(build()).toEqual([expect.objectContaining({ cycleId: 'c1', planVersionId: 'v1',
      routineSlotKey: 'c1@2026-09-19T08:00', scheduledAt: '2026-09-19T06:00:00.000Z', dose: 1, unit: 'mg' })])
  })
  it('keeps pending snapshot quantity and method without changing occurrence identity', () => {
    expect(build([pending])).toEqual([expect.objectContaining({ doseLogId: 'log-1', dose: 250, unit: 'mcg',
      method: 'Intramuskulaer', cycleId: 'c1', planVersionId: 'v1', scheduledAt: '2026-09-19T06:00:00.000Z' })])
  })
  it('does not offer a decided auto-missed row for V2 confirmation', async () => {
    const decided = { ...pending, taken: false, notes: AUTO_MISSED_NOTE }
    const rpc = vi.fn(() => { throw new Error('Decided rows cannot be reopened') })
    const selected = build([decided])
    for (const intake of selected.filter(row => row.status === 'open')) {
      await confirmIntakeDoseLog({ rpc, from: timelineReader() } as never, { ...intake, userId: 'u', loggedAt: intake.scheduledAt, debitVialStock: false })
    }
    expect(selected).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
    expect(decided.taken).toBe(false)
  })
  it('does not reassign a confirmed log to a different cycle of the same stack item', () => {
    const other = { ...timeline, cycle: { ...timeline.cycle, id: 'c2' }, versions: timeline.versions.map(v => ({ ...v, id: 'v2', cycle_id: 'c2' })) }
    const confirmed = build([{ ...pending, taken: true }], [other]).find(row => row.status === 'confirmed')
    expect(confirmed).toMatchObject({ cycleId: 'c1', planVersionId: 'v1', dose: 250, unit: 'mcg', scheduledAt: pending.logged_at })
  })
  it('confirms and places the injection in one RPC, without dose values from the device', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const rpc = vi.fn(() => Promise.resolve({ data: { dose_log_id: 'd1', injection_log_id: 'i1' }, error: null }))
    const pin = { model_version: 'placeholder-v1', position: { x: 0.1, y: 0.2, z: 0.3 }, normal: { x: 0, y: 0, z: 1 },
      body_region: 'abdomen' as const, body_side: 'left' as const, uv: null, camera_state: null }
    await expect(confirmIntakeWithInjection({ rpc, from: timelineReader() } as never, { userId: 'u', stackItemId: 's1', dose: 250,
      unit: 'mcg', method: 'Subkutan', loggedAt: '2026-09-19T06:15:00Z', scheduledAt: '2026-09-19T06:00:00.000Z',
      cycleId: 'c1', planVersionId: 'v1', routineSlotKey: 'c1@2026-09-19T08:00', doseLogId: 'pending' },
    { notes: ' rot ', warningState: 'caution', substanceLabel: null, pin })).resolves.toEqual({ doseLogId: 'd1', injectionLogId: 'i1' })
    expect(rpc).toHaveBeenCalledTimes(1)
    const [name, args] = rpc.mock.calls[0] as unknown as [string, { p_entry: Record<string, unknown>; p_injection: Record<string, unknown> }]
    expect(name).toBe('confirm_intake_with_injection')
    expect(args.p_entry).toMatchObject({ cycle_id: 'c1', plan_version_id: 'v1', slot_key: 'c1@2026-09-19T08:00',
      dose_log_id: 'pending', dose: 250, unit: 'mcg', logged_at: '2026-09-19T06:15:00Z', taken: true })
    expect(args.p_injection).toEqual({ site: 'abdomen_left', notes: 'rot', substance_label: null, body_region: 'abdomen',
      body_side: 'left', model_version: 'placeholder-v1', position: pin.position, normal: pin.normal, uv: null,
      camera_state: null, warning_state: 'caution' })
  })
  it.each(['PGRST202', '42883'])('falls back (null) when the atomic RPC is not deployed yet (%s)', async code => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const rpc = vi.fn(() => Promise.resolve({ data: null, error: { code, message: 'missing' } }))
    const pin = { model_version: 'm', position: { x: 1, y: 1, z: 1 }, normal: { x: 0, y: 0, z: 1 },
      body_region: 'thigh' as const, body_side: 'right' as const }
    await expect(confirmIntakeWithInjection({ rpc, from: timelineReader() } as never, { userId: 'u', stackItemId: 's1', dose: 250,
      unit: 'mcg', method: 'Subkutan', loggedAt: '2026-09-19T06:15:00Z', scheduledAt: '2026-09-19T06:00:00.000Z',
      cycleId: 'c1', planVersionId: 'v1', routineSlotKey: 'c1@2026-09-19T08:00' },
    { notes: null, warningState: null, pin })).resolves.toBeNull()
    // Gemerkt: das naechste Speichern versucht es nicht erneut.
    await expect(confirmIntakeWithInjection({ rpc, from: timelineReader() } as never, { userId: 'u', stackItemId: 's1', dose: 250,
      unit: 'mcg', method: 'Subkutan', loggedAt: '2026-09-19T06:15:00Z', scheduledAt: '2026-09-19T06:00:00.000Z',
      cycleId: 'c1', planVersionId: 'v1', routineSlotKey: 'c1@2026-09-19T08:00' },
    { notes: null, warningState: null, pin })).resolves.toBeNull()
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('rethrows other atomic RPC errors (nothing half-saved to fall back from)', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const error = { code: '23505', message: 'duplicate key value violates unique constraint "injection_logs_dose_log_id_unique_idx"' }
    const rpc = vi.fn(() => Promise.resolve({ data: null, error }))
    const pin = { model_version: 'm', position: { x: 1, y: 1, z: 1 }, normal: { x: 0, y: 0, z: 1 },
      body_region: 'thigh' as const, body_side: 'right' as const }
    await expect(confirmIntakeWithInjection({ rpc, from: timelineReader() } as never, { userId: 'u', stackItemId: 's1', dose: 250,
      unit: 'mcg', method: 'Subkutan', loggedAt: '2026-09-19T06:15:00Z', scheduledAt: '2026-09-19T06:00:00.000Z',
      cycleId: 'c1', planVersionId: 'v1', routineSlotKey: 'c1@2026-09-19T08:00' },
    { notes: null, warningState: null, pin })).rejects.toBe(error)
    expect(isDoseLogAlreadyLinkedError(error)).toBe(true)
  })
  it('confirms through the authoritative RPC without direct dose-log writes', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const rpc = vi.fn((_name, args) => {
      if (args.p_entries[0].plan_version_id !== 'v1') throw new Error('Version mismatch')
      return Promise.resolve({ data: [{ id: 'saved' }], error: null })
    })
    const from = timelineReader()
    await expect(confirmIntakeDoseLog({ rpc, from } as never, { userId: 'u', stackItemId: 's1', dose: 250, unit: 'mcg',
      method: 'Subkutan', loggedAt: '2026-09-19T06:15:00Z', scheduledAt: '2026-09-19T06:00:00.000Z',
      cycleId: 'c1', planVersionId: 'v1', routineSlotKey: 'c1@2026-09-19T08:00',
      doseLogId: 'pending', debitVialStock: false } as never)).resolves.toBe('saved')
    expect(rpc).toHaveBeenCalledWith('confirm_intake_group', { p_entries: [expect.objectContaining({ cycle_id: 'c1',
      plan_version_id: 'v1', slot_key: 'c1@2026-09-19T08:00', dose_log_id: 'pending', logged_at: '2026-09-19T06:15:00Z' })] })
    expect(from.mock.calls.every(([table]) => table === 'cycles')).toBe(true)
  })
  it('resolves the version at edited actual time while retaining the morning occurrence key', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const changed = { ...timeline, versions: [...timeline.versions, { ...timeline.versions[0], id: 'v2',
      effective_kind: 'instant' as const, effective_at: '2026-09-19T10:00:00Z', effective_local_date: null, dose: 2 }] }
    const foreign = { ...timeline, cycle: { ...timeline.cycle, id: 'other' },
      versions: [{ ...timeline.versions[0], id: 'foreign', cycle_id: 'other' }] }
    const rpc = vi.fn((_name, args) => {
      const entry = args.p_entries[0]
      if (entry.cycle_id !== 'c1' || entry.plan_version_id !== 'v2') throw new Error('Version mismatch at logged_at')
      return Promise.resolve({ data: [{ id: 'saved' }], error: null })
    })
    await expect(confirmIntakeDoseLog({ rpc, from: timelineReader([foreign, changed]) } as never, {
      userId: 'u', stackItemId: 's1', dose: 1, unit: 'mg', method: 'Subkutan',
      loggedAt: '2026-09-19T11:00:00Z', scheduledAt: '2026-09-19T06:00:00.000Z',
      cycleId: 'c1', planVersionId: 'v1', routineSlotKey: 'c1@2026-09-19T08:00',
      doseLogId: 'pending', debitVialStock: false,
    })).resolves.toBe('saved')
    expect(rpc).toHaveBeenCalledWith('confirm_intake_group', { p_entries: [expect.objectContaining({
      plan_version_id: 'v2', slot_key: 'c1@2026-09-19T08:00', logged_at: '2026-09-19T11:00:00Z',
    })] })
  })
  it.each(['paused', 'versionless', 'missing'])('rejects actual-time confirmation for a %s timeline', async state => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const value = structuredClone(timeline)
    if (state === 'paused') value.pauses = [{ id: 'p', cycle_id: 'c1', paused_at: '2026-09-19T10:00:00Z', ends_at: null }]
    if (state === 'versionless') value.versions = []
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'saved' }], error: null })
    await expect(confirmIntakeDoseLog({ rpc, from: timelineReader(state === 'missing' ? [] : [value]) } as never, {
      userId: 'u', stackItemId: 's1', dose: 1, unit: 'mg', method: 'Subkutan', loggedAt: '2026-09-19T11:00:00Z',
      scheduledAt: '2026-09-19T06:00:00.000Z', cycleId: 'c1', planVersionId: 'v1',
      routineSlotKey: 'c1@2026-09-19T08:00', debitVialStock: false,
    })).rejects.toThrow(/timeline|version/)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('loads normalized rows without querying escalations', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const tables: string[] = []
    const from = (table: string) => {
      tables.push(table)
      const query: any = { select: () => query, eq: () => query, in: () => query, gte: () => query,
        not: () => query, order: () => query, then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve) }
      return query
    }
    await loadSelectableInjectionIntakes({ from } as never, 'u', new Date('2026-09-19T12:00:00Z'))
    expect(tables).not.toContain('dose_escalations')
  })
  it('keeps the requested local day even in UTC+14', () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const value = { ...timeline, cycle: { ...timeline.cycle, started_at: '2026-09-18T00:00:00Z' } }
    const result = buildSelectableInjectionIntakes({ cycles: [], timelines: [value], logs: [], linkedDoseLogIds: new Set(),
      escalations: [], now: new Date('2026-09-18T20:00:00Z'), lookbackDays: 0, timeZone: 'Pacific/Kiritimati' })
    expect(result.map(row => row.scheduledAt)).toEqual(['2026-09-18T18:00:00.000Z'])
  })
  it('includes the correctly encoded intramuscular method from a normalized snapshot', () => {
    const value = { ...timeline, versions: [{ ...timeline.versions[0], method: 'Intramuskulär' }] }
    expect(build([], [value])).toEqual([expect.objectContaining({ method: 'Intramuskulär' })])
  })
  it('keeps the older cycle selector on normalized quantities when V2 is enabled', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const row = { ...timeline.cycle, versions: timeline.versions, pauses: [], name: 'Plan',
      dose: 99, unit: 'IU', method: 'Oral', active: true, stack_items: { display_name: 'Item' } }
    const from = (table: string) => {
      const query: any = { select: () => query, eq: () => query, in: () => query, gte: () => query, not: () => query,
        order: () => query, then: (resolve: any) => Promise.resolve({ data: table === 'cycles' ? [row] : [], error: null }).then(resolve) }
      return query
    }
    expect(await loadSelectableInjectionCycles({ from } as never, 'u')).toEqual([
      { id: 'c1', stack_item_id: 's1', stack_item_name: 'Item', cycle_name: 'Plan', dose: 1, unit: 'mg', method: 'Subkutan' },
    ])
  })
})

describe('buildInjectionInsertPayload', () => {
  it('keeps dose_log_id when linking to an existing confirmation', () => {
    const payload = buildInjectionInsertPayload({
      userId: 'user-1',
      doseLogId: 'dose-1',
      stackItemId: 'stack-item-1',
      cycleId: 'cycle-1',
      dose: 250,
      unit: 'mcg',
      method: 'Subkutan',
      notes: 'ok',
      loggedAt: '2026-06-17T08:00:00.000Z',
      warningState: 'caution',
      pin: {
        model_version: 'placeholder-v1',
        body_region: 'abdomen',
        body_side: 'right',
        position: { x: 0.1, y: 0.2, z: 0.3 },
        normal: { x: 0, y: 0, z: 1 },
        uv: null,
        camera_state: null,
      },
    })

    expect(payload).toMatchObject({
      user_id: 'user-1',
      dose_log_id: 'dose-1',
      stack_item_id: 'stack-item-1',
      cycle_id: 'cycle-1',
      dose: 250,
      unit: 'mcg',
      method: 'Subkutan',
      body_region: 'abdomen',
      body_side: 'right',
      model_version: 'placeholder-v1',
      warning_state: 'caution',
    })
    expect(payload.position).toEqual({ x: 0.1, y: 0.2, z: 0.3 })
  })

  it('stores a trimmed manual substance label without a dose_log link', () => {
    const payload = buildInjectionInsertPayload({
      userId: 'user-1',
      doseLogId: null,
      stackItemId: null,
      cycleId: null,
      dose: 10,
      unit: 'mg',
      method: 'Intramuskulär',
      notes: null,
      loggedAt: '2026-06-17T08:00:00.000Z',
      warningState: null,
      substanceLabel: '  Testosteron  ',
      pin: {
        model_version: 'placeholder-v1',
        body_region: 'glute',
        body_side: 'left',
        position: { x: 0, y: -0.8, z: 0.1 },
        normal: { x: 0, y: 0, z: 1 },
        uv: null,
        camera_state: null,
      },
    })

    expect(payload.substance_label).toBe('Testosteron')
    expect(payload.dose_log_id).toBeNull()
    expect(payload.unit).toBe('mg')
  })
})
describe('loadInjectionLogs', () => {
  it('retries without relation joins when PostgREST has no injection log relationships', async () => {
    const selects: string[] = []
    const results = [
      { data: null, error: { code: 'PGRST200', message: 'relationship not found' } },
      {
        data: [{
          id: 'log-1',
          user_id: 'user-1',
          logged_at: '2026-06-17T08:00:00.000Z',
          stack_item_id: 'stack-item-1',
          cycle_id: 'cycle-1',
          substance_label: 'Testosteron',
        }],
        error: null,
      },
    ]
    let queryIndex = 0
    const supabase = {
      from: () => {
        const result = results[queryIndex++]
        const query = {
          select: (value: string) => {
            selects.push(value)
            return query
          },
          eq: () => query,
          order: () => query,
          limit: async () => result,
        }
        return query
      },
    } as unknown as SupabaseClient

    const logs = await loadInjectionLogs(supabase, 'user-1')

    expect(selects).toEqual(['*, stack_items(display_name), cycles(name)', '*'])
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      id: 'log-1',
      stack_item_id: 'stack-item-1',
      cycle_id: 'cycle-1',
      stack_item_name: null,
      cycle_name: null,
      substance_label: 'Testosteron',
    })
  })
  it('loads the linked dose confirmation status for injection history markers', async () => {
    const selects: string[] = []
    const doseIn: unknown[][] = []
    const queries = {
      injection_logs: {
        select: (value: string) => { selects.push(value); return queries.injection_logs },
        eq: () => queries.injection_logs,
        order: () => queries.injection_logs,
        limit: async () => ({
          data: [{
            id: 'log-1',
            user_id: 'user-1',
            dose_log_id: 'dose-1',
            logged_at: '2026-06-17T08:00:00.000Z',
            stack_item_id: 'stack-item-1',
            cycle_id: 'cycle-1',
            stack_items: { display_name: 'BPC-157' },
            cycles: { name: 'Cycle' },
          }],
          error: null,
        }),
      },
      dose_logs: {
        select: (value: string) => { selects.push(value); return queries.dose_logs },
        eq: () => queries.dose_logs,
        in: (_field: string, values: unknown[]) => {
          doseIn.push(values)
          return queries.dose_logs
        },
        then: (resolve: (value: { data: Array<{ id: string; taken: boolean | null }>; error: null }) => void) => resolve({
          data: [{ id: 'dose-1', taken: null }],
          error: null,
        }),
      },
    }
    const supabase = {
      from: (table: 'injection_logs' | 'dose_logs') => queries[table],
    } as unknown as SupabaseClient

    const logs = await loadInjectionLogs(supabase, 'user-1')

    expect(selects).toEqual(['*, stack_items(display_name), cycles(name)', 'id, taken'])
    expect(doseIn).toEqual([['dose-1']])
    expect(logs[0]).toMatchObject({
      id: 'log-1',
      dose_log_id: 'dose-1',
      dose_taken: null,
    })
  })
})

describe('assertInjectionProSchema', () => {
  it('identifies a missing Pro column before saving an injection', async () => {
    const schemaError = {
      code: 'PGRST204',
      message: "Could not find the 'body_region' column of 'injection_logs' in the schema cache",
    }
    const query = {
      select: () => query,
      limit: async () => ({ data: null, error: schemaError }),
    }
    const supabase = {
      from: () => query,
    } as unknown as SupabaseClient

    await expect(assertInjectionProSchema(supabase)).rejects.toEqual(schemaError)
    expect(isInjectionProSchemaError(schemaError)).toBe(true)
  })
})
describe('injectionIntakeLookbackStart', () => {
  it('starts at the beginning of the configured lookback day', () => {
    expect(injectionIntakeLookbackStart(new Date('2026-06-26T15:30:00.000Z'), 7).toISOString()).toBe(
      '2026-06-18T22:00:00.000Z',
    )
  })
})
describe('buildSelectableInjectionIntakes', () => {
  const cycle = {
    id: 'cycle-1',
    stack_item_id: 'stack-item-1',
    name: 'Abendzyklus',
    method: 'Subkutan',
    start_date: '2026-06-20',
    end_date: null,
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: null,
    intake_time: 'abends',
    intake_time_custom: null,
    dose: 100,
    unit: 'mcg',
    schedule_history: null,
    stack_items: { display_name: 'Ipamorelin' },
  }

  it('includes confirmed dose logs without a pin and keeps open slots', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'dose-1',
        stack_item_id: 'stack-item-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T20:15:00.000Z',
        taken: true,
      }],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'confirmed',
        doseLogId: 'dose-1',
        cycleId: 'cycle-1',
        stackItemId: 'stack-item-1',
        stackItemName: 'Ipamorelin',
        scheduledAt: '2026-06-23T20:15:00.000Z',
      }),
      expect.objectContaining({
        status: 'open',
        doseLogId: null,
        cycleId: 'cycle-1',
      }),
    ]))
  })

  it('includes a confirmed intramuscular dose log (correctly encoded)', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [{ ...cycle, method: 'Intramuskulär' }],
      logs: [{
        id: 'dose-im',
        stack_item_id: 'stack-item-1',
        dose: 100,
        unit: 'mg',
        method: 'Intramuskulär',
        logged_at: '2026-06-23T20:15:00.000Z',
        taken: true,
      }],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'confirmed', doseLogId: 'dose-im', method: 'Intramuskulär' }),
    ]))
  })

  it('uses the injectable cycle when an older confirmed dose log has no method', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'dose-legacy',
        stack_item_id: 'stack-item-1',
        dose: 100,
        unit: 'mcg',
        method: 'Andere',
        logged_at: '2026-06-23T20:15:00.000Z',
        taken: true,
      }],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'confirmed',
        doseLogId: 'dose-legacy',
        method: 'Subkutan',
      }),
    ]))
  })
  it('keeps a confirmed injectable dose log even without a matching active schedule', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [],
      logs: [{
        id: 'dose-orphan',
        stack_item_id: 'stack-item-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T20:15:00.000Z',
        taken: true,
      }],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result).toEqual([
      expect.objectContaining({
        status: 'confirmed',
        doseLogId: 'dose-orphan',
        cycleId: null,
        scheduledAt: '2026-06-23T20:15:00.000Z',
      }),
    ])
  })
  it('excludes confirmed dose logs that already have an injection pin', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'dose-1',
        stack_item_id: 'stack-item-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T20:15:00.000Z',
        taken: true,
      }],
      linkedDoseLogIds: new Set(['dose-1']),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result.some(item => item.doseLogId === 'dose-1')).toBe(false)
  })
  it('shows auto-missed injectable dose logs as open intakes', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'missed-1',
        stack_item_id: 'stack-item-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T18:00:00.000Z',
        taken: false,
        notes: 'auto-missed',
      } as any],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'open',
        doseLogId: 'missed-1',
        cycleId: 'cycle-1',
        scheduledAt: '2026-06-23T18:00:00.000Z',
      }),
    ]))
  })
  it('shows reset dose logs without pins as open intakes with their existing id', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'reset-1',
        stack_item_id: 'stack-item-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T18:00:00.000Z',
        taken: null,
      }],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'open',
        doseLogId: 'reset-1',
        cycleId: 'cycle-1',
        scheduledAt: '2026-06-23T18:00:00.000Z',
      }),
    ]))
  })

  it.each([
    ['null dose', null, 'mcg'],
    ['blank dose', '' as unknown as number, 'mcg'],
    ['null unit', 100, null],
    ['blank unit', 100, ' '],
  ])('does not replace an existing open log with %s from the schedule', (_case, dose, unit) => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'reset-unknown',
        stack_item_id: 'stack-item-1',
        dose,
        unit,
        method: 'Subkutan',
        logged_at: '2026-06-23T18:00:00.000Z',
        taken: null,
      }],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result.some(item => item.doseLogId === 'reset-unknown')).toBe(false)
  })

  it.each([
    ['null dose', null, 'mcg'],
    ['blank dose', '' as unknown as number, 'mcg'],
    ['null unit', 100, null],
    ['blank unit', 100, ' '],
  ])('excludes a confirmed log with %s instead of coercing it into a candidate', (_case, dose, unit) => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'confirmed-unknown',
        stack_item_id: 'stack-item-1',
        dose,
        unit,
        method: 'Subkutan',
        logged_at: '2026-06-23T18:00:00.000Z',
        taken: true,
      }],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result.some(item => item.doseLogId === 'confirmed-unknown')).toBe(false)
  })

  it('does not show reset dose logs with an existing injection pin as selectable again', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'reset-linked',
        stack_item_id: 'stack-item-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T18:00:00.000Z',
        taken: null,
      }],
      linkedDoseLogIds: new Set(['reset-linked']),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result.some(item => item.scheduledAt === '2026-06-23T18:00:00.000Z')).toBe(false)
  })
})
describe('resolveInjectionDoseLogId', () => {
  it('reuses a confirmed dose log without confirming or debiting again', async () => {
    let confirmationCalls = 0
    const doseLogId = await resolveInjectionDoseLogId({
      cycleId: 'cycle-1',
      stackItemId: 'stack-item-1',
      stackItemName: 'Ipamorelin',
      cycleName: 'Cycle',
      dose: 100,
      unit: 'mcg',
      method: 'Subkutan',
      scheduledAt: '2026-06-23T20:15:00.000Z',
      daysOverdue: 1,
      status: 'confirmed',
      doseLogId: 'dose-1',
    }, async () => {
      confirmationCalls += 1
      return 'new-dose'
    })

    expect(doseLogId).toBe('dose-1')
    expect(confirmationCalls).toBe(0)
  })

  it('confirms an open intake exactly once', async () => {
    let confirmationCalls = 0
    const doseLogId = await resolveInjectionDoseLogId({
      cycleId: 'cycle-1',
      stackItemId: 'stack-item-1',
      stackItemName: 'Ipamorelin',
      cycleName: 'Cycle',
      dose: 100,
      unit: 'mcg',
      method: 'Subkutan',
      scheduledAt: '2026-06-24T20:00:00.000Z',
      daysOverdue: 0,
      status: 'open',
      doseLogId: null,
    }, async () => {
      confirmationCalls += 1
      return 'new-dose'
    })

    expect(doseLogId).toBe('new-dose')
    expect(confirmationCalls).toBe(1)
  })
})

describe('confirmIntakeDoseLog', () => {
  it('updates an auto-missed dose log instead of inserting a duplicate', async () => {
    const doseUpdates: Array<Record<string, unknown>> = []
    const doseEq: Array<[string, unknown]> = []
    const rpcCalls: Array<[string, Record<string, unknown>]> = []
    let inserts = 0

    const doseUpdateQuery = {
      error: null,
      eq: (field: string, value: unknown) => {
        doseEq.push([field, value])
        return doseUpdateQuery
      },
    }
    const supabase = {
      rpc: async (name: string, params: Record<string, unknown>) => {
        rpcCalls.push([name, params])
        return { data: 0.99, error: null }
      },
      from: (table: string) => {
        if (table === 'dose_logs') {
          return {
            update: (payload: Record<string, unknown>) => {
              doseUpdates.push(payload)
              return doseUpdateQuery
            },
            insert: () => {
              inserts += 1
              return { select: () => ({ single: async () => ({ data: { id: 'new-dose' }, error: null }) }) }
            },
          }
        }
        throw new Error(`Unexpected table ${table}`)
      },
    } as unknown as SupabaseClient

    const id = await confirmIntakeDoseLog(supabase, {
      userId: 'user-1',
      stackItemId: 'stack-item-1',
      dose: 100,
      unit: 'mcg',
      method: 'Subkutan',
      loggedAt: '2026-06-23T18:05:00.000Z',
      doseLogId: 'missed-1',
    })

    expect(id).toBe('missed-1')
    expect(inserts).toBe(0)
    expect(doseUpdates).toEqual([{ dose: 100, unit: 'mcg', method: 'Subkutan', logged_at: '2026-06-23T18:05:00.000Z', taken: true }])
    expect(doseEq).toEqual([['id', 'missed-1'], ['user_id', 'user-1']])
    expect(rpcCalls).toEqual([['apply_inventory_confirmation', { p_dose_log_id: 'missed-1' }]])
  })
})
describe('isDoseLogAlreadyLinkedError', () => {
  it('recognizes the partial unique-index violation', () => {
    expect(isDoseLogAlreadyLinkedError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "injection_logs_dose_log_id_unique_idx"',
    })).toBe(true)
  })
})
