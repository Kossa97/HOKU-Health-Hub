import { describe, expect, it, vi } from 'vitest'
import type { CyclePlanVersion, CycleTimeline, PlanScheduleSnapshot } from '../../../lib/planTimeline'
import type { CreatePlanVersionInput } from '../types'
import {
  PlanLifecycleError,
  createPlanVersion,
  endCycle,
  loadCycleHistory,
  loadCycleTimelines,
  pauseCycle,
  removeFuturePlanVersion,
  replaceFuturePlanVersion,
  resolveCycleMigrationConflict,
  resolveCycleCourseTimezone,
  restartCycle,
  resumeCycle,
  setPauseEnd,
} from './planLifecycle'
import type { PlanRpcClient } from './planLifecycle'

const schedule: PlanScheduleSnapshot = {
  frequency: 'daily',
  x_days_interval: null,
  interval_unit: null,
  cycle_on_days: null,
  cycle_off_days: null,
  schedule_days: [],
  intake_time: '08:00',
  intake_time_custom: null,
  slot_doses: null,
  slot_days: null,
  dose: 10,
  unit: 'mg',
  method: 'oral',
}

const version: CyclePlanVersion = {
  id: 'version-1',
  cycle_id: 'cycle-1',
  effective_kind: 'local_date',
  effective_at: null,
  effective_local_date: '2026-10-01',
  change_kind: 'dose',
  ...schedule,
}

const timeline: CycleTimeline = {
  cycle: {
    id: 'cycle-1',
    stack_item_id: 'stack-1',
    started_at: '2026-09-01T06:00:00.000Z',
    ended_at: null,
  },
  versions: [version],
  pauses: [{
    id: 'pause-1',
    cycle_id: 'cycle-1',
    paused_at: '2026-09-20T12:00:00.000Z',
    ends_at: '2026-09-21T12:00:00.000Z',
  }],
}

function databaseRow(value: CycleTimeline = timeline) {
  return {
    ...value.cycle,
    versions: value.versions,
    pauses: value.pauses,
  }
}

function queryClient(rows: ReturnType<typeof databaseRow>[]) {
  const single = vi.fn(async () => ({ data: rows[0] ?? null, error: null }))
  const order = vi.fn(async () => ({ data: rows, error: null }))
  const eqResult = { order, single }
  const eq = vi.fn(() => eqResult)
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn((_table: 'cycles') => ({ select }))
  return { client: { from }, from, select, eq, order, single }
}

function rpcClient(
  rpcResult: { data: unknown; error: { message: string; code?: string } | null },
  rows = [databaseRow()],
) {
  const query = queryClient(rows)
  const rpc = vi.fn(async () => rpcResult)
  return { client: { from: query.client.from, rpc }, rpc, query }
}

it('confirms a course timezone with one stable mutation key and surfaces the review marker', async () => {
  const mock = rpcClient({ data: { stack_item_id: 'stack-1' }, error: null })
  await resolveCycleCourseTimezone(mock.client, { stackItemId: 'stack-1', timeZone: 'Asia/Tokyo', idempotencyKey: 'zone-review' })
  expect(mock.rpc).toHaveBeenCalledWith('resolve_cycle_course_timezone', {
    p_stack_item_id: 'stack-1', p_timezone: 'Asia/Tokyo', p_idempotency_key: 'zone-review',
  })
  const query = queryClient([{ ...databaseRow(), timezone_review_required: true }])
  expect(await loadCycleTimelines(query.client, 'user')).toEqual([])
  expect((await loadCycleTimelines(query.client, 'user', { includeUnavailable: true }))[0].cycle.timezone_review_required).toBe(true)
})

describe('plan lifecycle service', () => {
  it('surfaces a versionless open cycle instead of silently producing no dues', async () => {
    const query = queryClient([databaseRow({ ...timeline, versions: [] })])
    await expect(loadCycleTimelines(query.client, 'user-1')).rejects.toThrow('Cycle has no plan versions')
  })
  it('retains rejected migration history only for management without hiding ordinary ended cycles', async () => {
    const rejected = { ...databaseRow(), ended_at: '2026-10-01T08:00:00Z', closed_by_migration_resolution: true }
    const ordinaryEnded = { ...databaseRow(), id: 'ordinary-ended', ended_at: '2026-10-01T08:00:00Z', closed_by_migration_resolution: false }
    const query = queryClient([rejected, ordinaryEnded])
    const actionable = await loadCycleTimelines(query.client, 'user-1')
    expect(actionable.map(item => item.cycle.id)).toEqual(['ordinary-ended'])
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('closed_by_migration_resolution'))
    const history = await loadCycleTimelines(query.client, 'user-1', { includeUnavailable: true })
    expect(history.map(item => item.cycle.id)).toEqual(['cycle-1', 'ordinary-ended'])
    expect(history[0]).toEqual({ ...timeline, cycle: { ...timeline.cycle, ended_at: '2026-10-01T08:00:00Z' } })
  })

  it('loads cycle history with names, without discarded, conflicted or planless cycles', async () => {
    const item = (name: string, conflicts: Array<{ resolved_at: string | null }> = []) =>
      ({ archived: true, configuration_status: 'complete', display_name: name, migration_conflicts: conflicts })
    const query = queryClient([
      { ...databaseRow(), stack_items: item('BPC-157') },
      { ...databaseRow(), id: 'discarded', closed_by_migration_resolution: true, stack_items: item('BPC-157') },
      { ...databaseRow(), id: 'conflicted', stack_item_id: 'stack-2', stack_items: item('TB-500', [{ resolved_at: null }]) },
      { ...databaseRow({ ...timeline, versions: [] }), id: 'planless', stack_item_id: 'stack-3', stack_items: item('Sema') },
      { ...databaseRow(), id: 'zone-review', stack_item_id: 'stack-4', timezone_review_required: true, stack_items: item('GHK-Cu') },
    ] as never)
    const { timelines, namen } = await loadCycleHistory(query.client, 'user-1')
    expect(timelines).toEqual([timeline])
    expect([...namen]).toEqual([['stack-1', 'BPC-157']])
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('display_name'))
  })

  it('fetches substance names only for the history', async () => {
    const query = queryClient([databaseRow()])
    await loadCycleTimelines(query.client, 'user-1')
    expect(query.select).not.toHaveBeenCalledWith(expect.stringContaining('display_name'))
  })

  it.each([
    { archived: true, configuration_status: 'complete', migration_conflicts: [] },
    { archived: false, configuration_status: 'needs_review', migration_conflicts: [] },
    { archived: false, configuration_status: 'complete', migration_conflicts: [{ resolved_at: null }] },
  ])('suppresses unavailable item timelines but retains management access: %j', async item => {
    const row = { ...databaseRow(), stack_items: item }
    const query = queryClient([row])
    await expect(loadCycleTimelines(query.client, 'user-1')).resolves.toEqual([])
    await expect(loadCycleTimelines(query.client, 'user-1', { includeUnavailable: true })).resolves.toEqual([timeline])
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('stack_items'))
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('migration_conflicts:cycle_migration_conflicts'))
    row.stack_items = { archived: false, configuration_status: 'complete', migration_conflicts: [] }
    await expect(loadCycleTimelines(query.client, 'user-1')).resolves.toEqual([timeline])
  })

  it('loads complete cycle timelines through relational versions and pauses', async () => {
    const secondVersion = {
      ...version,
      id: 'version-2',
      effective_local_date: '2026-11-01',
    }
    const query = queryClient([databaseRow({
      ...timeline,
      versions: [version, secondVersion],
    })])

    await expect(loadCycleTimelines(query.client as never, 'user-1')).resolves.toEqual([{
      ...timeline,
      versions: [version, secondVersion],
    }])

    expect(query.from).toHaveBeenCalledWith('cycles')
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('versions:cycle_plan_versions'))
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('pauses:cycle_pause_periods'))
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('creates and replaces complete plan snapshots with exact boundaries', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: version, error: null })
      .mockResolvedValueOnce({ data: { ...version, id: 'version-2' }, error: null })
    const query = queryClient([])
    const client = { rpc, from: query.client.from }

    await expect(createPlanVersion(client, {
      cycleId: 'cycle-1',
      effectiveKind: 'instant',
      effectiveAt: '2026-09-20T12:00:00.000Z',
      effectiveLocalDate: null,
      changeKind: 'dose',
      schedule,
      idempotencyKey: 'mutation-create',
    })).resolves.toEqual(version)
    await expect(replaceFuturePlanVersion(client, {
      versionId: 'version-1',
      effectiveKind: 'local_date',
      effectiveAt: null,
      effectiveLocalDate: '2026-10-02',
      changeKind: 'schedule',
      schedule,
      timeZone: 'Europe/Berlin',
      idempotencyKey: 'mutation-replace',
    })).resolves.toEqual({ ...version, id: 'version-2' })

    expect(rpc).toHaveBeenNthCalledWith(1, 'create_plan_version', {
      p_cycle_id: 'cycle-1',
      p_effective_kind: 'instant',
      p_effective_at: '2026-09-20T12:00:00.000Z',
      p_effective_local_date: null,
      p_change_kind: 'dose',
      p_schedule: schedule,
      p_idempotency_key: 'mutation-create',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'replace_future_plan_version', {
      p_version_id: 'version-1',
      p_effective_kind: 'local_date',
      p_effective_at: null,
      p_effective_local_date: '2026-10-02',
      p_change_kind: 'schedule',
      p_schedule: schedule,
      p_timezone: 'Europe/Berlin',
      p_idempotency_key: 'mutation-replace',
    })
  })

  it('passes one generated idempotency key unchanged when a removal is retried', async () => {
    const { client, rpc } = rpcClient({
      data: { cycle_id: 'cycle-1', version_id: 'version-2' },
      error: null,
    })
    const idempotencyKey = crypto.randomUUID()
    const input = {
      versionId: 'version-2',
      timeZone: 'Europe/Berlin',
      idempotencyKey,
    }

    await removeFuturePlanVersion(client, input)
    await removeFuturePlanVersion(client, input)

    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenNthCalledWith(1, 'remove_future_plan_version', {
      p_version_id: 'version-2',
      p_timezone: 'Europe/Berlin',
      p_idempotency_key: idempotencyKey,
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'remove_future_plan_version', {
      p_version_id: 'version-2',
      p_timezone: 'Europe/Berlin',
      p_idempotency_key: idempotencyKey,
    })
  })

  it('uses exact pause RPC contracts and reloads the canonical timeline', async () => {
    const pause = rpcClient({ data: { cycle_id: 'cycle-1' }, error: null })
    const pauseEnd = rpcClient({ data: { cycle_id: 'cycle-1' }, error: null })
    const resume = rpcClient({ data: { cycle_id: 'cycle-1' }, error: null })

    await expect(pauseCycle(pause.client, {
      cycleId: 'cycle-1',
      endsAt: '2026-09-22T12:00:00.000Z',
      idempotencyKey: 'mutation-pause',
    })).resolves.toEqual(timeline)
    await expect(setPauseEnd(pauseEnd.client, {
      pauseId: 'pause-1',
      endsAt: '2026-09-23T12:00:00.000Z',
      idempotencyKey: 'mutation-pause-end',
    })).resolves.toEqual(timeline)
    await expect(resumeCycle(resume.client, {
      cycleId: 'cycle-1',
      idempotencyKey: 'mutation-resume',
    })).resolves.toEqual(timeline)

    expect(pause.rpc).toHaveBeenCalledWith('pause_cycle', {
      p_cycle_id: 'cycle-1',
      p_ends_at: '2026-09-22T12:00:00.000Z',
      p_idempotency_key: 'mutation-pause',
    })
    expect(pauseEnd.rpc).toHaveBeenCalledWith('set_pause_end', {
      p_pause_id: 'pause-1',
      p_ends_at: '2026-09-23T12:00:00.000Z',
      p_idempotency_key: 'mutation-pause-end',
    })
    expect(resume.rpc).toHaveBeenCalledWith('resume_cycle', {
      p_cycle_id: 'cycle-1',
      p_idempotency_key: 'mutation-resume',
    })
    expect(pause.query.eq).toHaveBeenLastCalledWith('id', 'cycle-1')
    expect(pauseEnd.query.eq).toHaveBeenLastCalledWith('id', 'cycle-1')
    expect(resume.query.eq).toHaveBeenLastCalledWith('id', 'cycle-1')
  })

  it('keeps the Supabase client as the receiver while reloading after a mutation', async () => {
    const query = queryClient([databaseRow()])
    const client = {
      rpc: vi.fn(async () => ({ data: { cycle_id: 'cycle-1' }, error: null })),
      from(this: unknown, table: 'cycles') {
        if (this !== client) throw new Error('Supabase client receiver was lost')
        return query.client.from(table)
      },
    }

    await expect(pauseCycle(client, {
      cycleId: 'cycle-1',
      endsAt: null,
      idempotencyKey: 'mutation-bound-client',
    })).resolves.toEqual(timeline)
  })

  it('ends and restarts through their RPCs before loading the affected cycle', async () => {
    const ending = rpcClient({ data: { cycle_id: 'cycle-1' }, error: null })
    const restartedTimeline: CycleTimeline = {
      ...timeline,
      cycle: { ...timeline.cycle, id: 'cycle-2' },
      versions: [{ ...version, id: 'version-2', cycle_id: 'cycle-2' }],
      pauses: [],
    }
    const restarting = rpcClient(
      { data: { source_cycle_id: 'cycle-1', cycle_id: 'cycle-2', plan_version_id: 'version-2' }, error: null },
      [databaseRow(restartedTimeline)],
    )

    await expect(endCycle(ending.client, {
      cycleId: 'cycle-1',
      idempotencyKey: 'mutation-end',
    })).resolves.toEqual(timeline)
    await expect(restartCycle(restarting.client, {
      sourceCycleId: 'cycle-1',
      startedAt: '2026-10-01T06:00:00.000Z',
      timeZone: 'America/New_York',
      initialSchedule: schedule,
      idempotencyKey: 'mutation-restart',
    })).resolves.toEqual(restartedTimeline)

    expect(ending.rpc).toHaveBeenCalledWith('end_cycle', {
      p_cycle_id: 'cycle-1',
      p_idempotency_key: 'mutation-end',
    })
    expect(restarting.rpc).toHaveBeenCalledWith('restart_cycle', {
      p_source_cycle_id: 'cycle-1',
      p_started_at: '2026-10-01T06:00:00.000Z',
      p_initial_schedule: { ...schedule, _timezone: 'America/New_York' },
      p_idempotency_key: 'mutation-restart',
    })
    expect(restarting.query.eq).toHaveBeenLastCalledWith('id', 'cycle-2')
  })

  it('resolves a migration conflict for the exact stack item and kept cycle before loading that timeline', async () => {
    const resolution = rpcClient({ data: { cycle_id: 'cycle-1' }, error: null })
    const input = {
      stackItemId: 'stack-1',
      keepCycleId: 'cycle-1',
      idempotencyKey: 'migration-resolution-1',
    }

    await expect(resolveCycleMigrationConflict(resolution.client, input)).resolves.toEqual(timeline)
    await expect(resolveCycleMigrationConflict(resolution.client, input)).resolves.toEqual(timeline)

    expect(resolution.rpc).toHaveBeenCalledTimes(2)
    expect(resolution.rpc).toHaveBeenNthCalledWith(1, 'resolve_cycle_migration_conflict', {
      p_stack_item_id: 'stack-1',
      p_keep_cycle_id: 'cycle-1',
      p_idempotency_key: 'migration-resolution-1',
    })
    expect(resolution.rpc).toHaveBeenNthCalledWith(2, 'resolve_cycle_migration_conflict', {
      p_stack_item_id: 'stack-1',
      p_keep_cycle_id: 'cycle-1',
      p_idempotency_key: 'migration-resolution-1',
    })
    expect(resolution.query.eq).toHaveBeenLastCalledWith('id', 'cycle-1')
  })

  it.each([
    ['Plan version is already effective', 'already_effective'],
    ['Cycle is already ended', 'already_ended'],
    ['Cycle is not paused', 'not_paused'],
    ['Another open cycle exists', 'open_cycle_conflict'],
    ['Unexpected database failure', 'unknown'],
  ] as const)('maps database error %s to %s', async (message, code) => {
    const { client } = rpcClient({ data: null, error: { message } })

    const failure = resumeCycle(client, {
      cycleId: 'cycle-1',
      idempotencyKey: 'mutation-error',
    })

    await expect(failure).rejects.toMatchObject({
      name: 'PlanLifecycleError',
      code,
      message,
    })
    await expect(failure).rejects.toBeInstanceOf(PlanLifecycleError)
  })

  it('does not turn a loading failure into an empty-plan state', async () => {
    const query = queryClient([])
    query.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'Timeline query failed' },
    } as never)

    await expect(loadCycleTimelines(query.client as never, 'user-1')).rejects.toMatchObject({
      code: 'unknown',
      message: 'Timeline query failed',
    })
  })
})

function assertInvalidBoundaryTypes() {
  // @ts-expect-error An instant boundary requires an instant and forbids a local date.
  const invalidInstantBoundary: CreatePlanVersionInput = {
    cycleId: 'cycle-1',
    effectiveKind: 'instant',
    effectiveAt: null,
    effectiveLocalDate: '2026-10-01',
    changeKind: 'dose',
    schedule,
    idempotencyKey: 'invalid-boundary',
  }
  void invalidInstantBoundary

  // @ts-expect-error A local-date boundary forbids an instant and requires a local date.
  const invalidLocalDateBoundary: CreatePlanVersionInput = {
    cycleId: 'cycle-1',
    effectiveKind: 'local_date',
    effectiveAt: '2026-10-01T06:00:00.000Z',
    effectiveLocalDate: null,
    changeKind: 'schedule',
    schedule,
    idempotencyKey: 'invalid-local-boundary',
  }
  void invalidLocalDateBoundary

  // @ts-expect-error Lifecycle mutations reload canonical state and require relational reads.
  const rpcOnlyClient: PlanRpcClient = {
    rpc: async () => ({ data: null, error: null }),
  }
  void rpcOnlyClient
}
void assertInvalidBoundaryTypes
