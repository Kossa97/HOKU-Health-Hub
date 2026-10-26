import type {
  CyclePausePeriod,
  CyclePlanVersion,
  CycleTimeline,
  TimelineCycle,
} from '../../../lib/planTimeline'
import type {
  CreatePlanVersionInput,
  EndCycleInput,
  PauseCycleInput,
  RemovePlanVersionInput,
  ReplacePlanVersionInput,
  RestartCycleInput,
  ResumeCycleInput,
  SetPauseEndInput,
} from '../types'

interface ServiceError {
  message: string
  code?: string
}

interface QueryResult<T> {
  data: T | null
  error: ServiceError | null
}

interface CycleTimelineRow extends TimelineCycle {
  closed_by_migration_resolution?: boolean
  versions: CyclePlanVersion[] | null
  pauses: CyclePausePeriod[] | null
  stack_items?: {
    archived: boolean
    configuration_status: string
    display_name?: string
    migration_conflicts: Array<{ resolved_at: string | null }>
  } | null
}

interface CycleFilter {
  order(
    column: 'started_at',
    options: { ascending: false },
  ): PromiseLike<QueryResult<CycleTimelineRow[]>>
  single(): PromiseLike<QueryResult<CycleTimelineRow>>
}

export interface PlanQueryClient {
  from(table: 'cycles'): {
    select(columns: string): {
      eq(column: 'user_id' | 'id', value: string): CycleFilter
    }
  }
}

export interface PlanRpcClient extends PlanQueryClient {
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): PromiseLike<QueryResult<unknown>>
}

export type PlanLifecycleErrorCode =
  | 'already_effective'
  | 'already_ended'
  | 'not_paused'
  | 'open_cycle_conflict'
  | 'unknown'

export class PlanLifecycleError extends Error {
  readonly code: PlanLifecycleErrorCode

  constructor(code: PlanLifecycleErrorCode, message: string) {
    super(message)
    this.name = 'PlanLifecycleError'
    this.code = code
  }
}

/** Felder der Substanz im Embed; der Verlauf braucht zusaetzlich den Namen. */
const ITEM_FIELDS = 'archived, configuration_status, migration_conflicts:cycle_migration_conflicts(resolved_at)'

const timelineSelect = (itemFields: string) => `
  id,
  stack_item_id,
  started_at,
  ended_at,
  start_local_date,
  end_local_date,
  lifecycle_timezone,
  timezone_review_required,
  closed_by_migration_resolution,
  stack_items(${itemFields}),
  versions:cycle_plan_versions (
    id,
    created_at,
    cycle_id,
    effective_kind,
    effective_at,
    effective_local_date,
    change_kind,
    frequency,
    x_days_interval,
    interval_unit,
    cycle_on_days,
    cycle_off_days,
    schedule_days,
    intake_time,
    intake_time_custom,
    slot_doses,
    slot_days,
    dose,
    unit,
    method
  ),
  pauses:cycle_pause_periods (
    id,
    cycle_id,
    paused_at,
    ends_at
  )
`

const TIMELINE_SELECT = timelineSelect(ITEM_FIELDS)
const HISTORY_SELECT = timelineSelect(`display_name, ${ITEM_FIELDS}`)

const hasOpenConflict = (row: CycleTimelineRow) =>
  row.stack_items?.migration_conflicts?.some(conflict => conflict.resolved_at === null) === true

async function loadTimelineRows(client: PlanQueryClient, userId: string, select: string): Promise<CycleTimelineRow[]> {
  const { data, error } = await client
    .from('cycles')
    .select(select)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
  throwIfError(error)
  return data ?? []
}

function lifecycleError(error: ServiceError): PlanLifecycleError {
  let code: PlanLifecycleErrorCode = 'unknown'
  if (error.message === 'Plan version is already effective') code = 'already_effective'
  else if (error.message === 'Cycle is already ended') code = 'already_ended'
  else if (error.message === 'Cycle is not paused') code = 'not_paused'
  else if (error.message === 'Another open cycle exists') code = 'open_cycle_conflict'
  return new PlanLifecycleError(code, error.message)
}

function throwIfError(error: ServiceError | null): void {
  if (error) throw lifecycleError(error)
}

function mapTimeline(row: CycleTimelineRow): CycleTimeline {
  if (!row.versions?.length) throw new PlanLifecycleError('unknown', 'Cycle has no plan versions')
  return {
    cycle: {
      id: row.id,
      stack_item_id: row.stack_item_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      ...(row.start_local_date ? { start_local_date: row.start_local_date } : {}),
      ...(row.end_local_date ? { end_local_date: row.end_local_date } : {}),
      ...(row.lifecycle_timezone ? { lifecycle_timezone: row.lifecycle_timezone } : {}),
      ...(row.timezone_review_required ? { timezone_review_required: true } : {}),
    },
    versions: row.versions ?? [],
    pauses: row.pauses ?? [],
  }
}

async function loadCycleTimeline(client: PlanQueryClient, cycleId: string): Promise<CycleTimeline> {
  const { data, error } = await client
    .from('cycles')
    .select(TIMELINE_SELECT)
    .eq('id', cycleId)
    .single()
  throwIfError(error)
  if (!data) throw new PlanLifecycleError('unknown', 'Cycle timeline not found')
  return mapTimeline(data)
}

async function callRpc<T>(
  client: PlanRpcClient,
  name: string,
  params: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, params)
  throwIfError(error)
  const value = Array.isArray(data) ? data[0] : data
  if (value == null) throw new PlanLifecycleError('unknown', `${name} returned no data`)
  return value as T
}

export async function loadCycleTimelines(
  client: PlanQueryClient,
  userId: string,
  options: { includeUnavailable?: boolean } = {},
): Promise<CycleTimeline[]> {
  const rows = await loadTimelineRows(client, userId, TIMELINE_SELECT)
  // Management keeps unavailable timelines for conflict resolution; scheduling
  // must not offer archived or contradictory plans. Archiving does not end them.
  return rows.filter(row => options.includeUnavailable || (
    row.closed_by_migration_resolution !== true
    && row.timezone_review_required !== true
    && row.stack_items?.archived !== true
    && row.stack_items?.configuration_status !== 'needs_review'
    && !hasOpenConflict(row)
  )).map(mapTimeline)
}

/**
 * Zyklen als Verlauf (etwa unter Blutwerten): was tatsaechlich lief, auch bei
 * archivierten Substanzen — aber ohne die bei einer Migration verworfenen
 * Zyklen, ohne Substanzen mit noch offenem Konflikt und ohne Zyklen, deren
 * lokale Tage noch auf die Zeitzonen-Pruefung warten (koennten um einen Tag
 * verschoben sein). Ein einzelner kaputter Zyklus (ohne Plan) faellt heraus,
 * statt alles scheitern zu lassen. Dazu die Namen der Substanzen.
 */
export async function loadCycleHistory(
  client: PlanQueryClient,
  userId: string,
): Promise<{ timelines: CycleTimeline[]; namen: Map<string, string> }> {
  const rows = await loadTimelineRows(client, userId, HISTORY_SELECT)
  const namen = new Map<string, string>()
  const timelines: CycleTimeline[] = []
  for (const row of rows) {
    if (row.closed_by_migration_resolution === true || row.timezone_review_required === true) continue
    if (hasOpenConflict(row) || !row.versions?.length) continue
    if (row.stack_items?.display_name) namen.set(row.stack_item_id, row.stack_items.display_name)
    timelines.push(mapTimeline(row))
  }
  return { timelines, namen }
}

export async function createPlanVersion(
  client: PlanRpcClient,
  input: CreatePlanVersionInput,
): Promise<CyclePlanVersion> {
  return callRpc(client, 'create_plan_version', {
    p_cycle_id: input.cycleId,
    p_effective_kind: input.effectiveKind,
    p_effective_at: input.effectiveAt,
    p_effective_local_date: input.effectiveLocalDate,
    p_change_kind: input.changeKind,
    p_schedule: { ...input.schedule,
      ...(input.timeZone ? { _timezone: input.timeZone, _effective_now: input.effectiveNow === true } : {}),
    },
    p_idempotency_key: input.idempotencyKey,
  })
}

export async function replaceFuturePlanVersion(
  client: PlanRpcClient,
  input: ReplacePlanVersionInput,
): Promise<CyclePlanVersion> {
  return callRpc(client, 'replace_future_plan_version', {
    p_version_id: input.versionId,
    p_effective_kind: input.effectiveKind,
    p_effective_at: input.effectiveAt,
    p_effective_local_date: input.effectiveLocalDate,
    p_change_kind: input.changeKind,
    p_schedule: input.schedule,
    p_timezone: input.timeZone,
    p_idempotency_key: input.idempotencyKey,
  })
}

export async function removeFuturePlanVersion(
  client: PlanRpcClient,
  input: RemovePlanVersionInput,
): Promise<void> {
  await callRpc(client, 'remove_future_plan_version', {
    p_version_id: input.versionId,
    p_timezone: input.timeZone,
    p_idempotency_key: input.idempotencyKey,
  })
}

export async function pauseCycle(
  client: PlanRpcClient,
  input: PauseCycleInput,
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'pause_cycle', {
    p_cycle_id: input.cycleId,
    p_ends_at: input.endsAt,
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}

export async function setPauseEnd(
  client: PlanRpcClient,
  input: SetPauseEndInput,
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'set_pause_end', {
    p_pause_id: input.pauseId,
    p_ends_at: input.endsAt,
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}

export async function resumeCycle(
  client: PlanRpcClient,
  input: ResumeCycleInput,
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'resume_cycle', {
    p_cycle_id: input.cycleId,
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}

export async function endCycle(
  client: PlanRpcClient,
  input: EndCycleInput,
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'end_cycle', {
    p_cycle_id: input.cycleId,
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}

export async function resolveCycleMigrationConflict(
  client: PlanRpcClient,
  input: { stackItemId: string; keepCycleId: string; idempotencyKey: string },
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'resolve_cycle_migration_conflict', {
    p_stack_item_id: input.stackItemId,
    p_keep_cycle_id: input.keepCycleId,
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}

export async function resolveCycleCourseTimezone(
  client: PlanRpcClient,
  input: { stackItemId: string; timeZone: string; idempotencyKey: string },
): Promise<void> {
  await callRpc(client, 'resolve_cycle_course_timezone', {
    p_stack_item_id: input.stackItemId,
    p_timezone: input.timeZone,
    p_idempotency_key: input.idempotencyKey,
  })
}

export async function restartCycle(
  client: PlanRpcClient,
  input: RestartCycleInput,
): Promise<CycleTimeline> {
  const result = await callRpc<{ cycle_id: string }>(client, 'restart_cycle', {
    p_source_cycle_id: input.sourceCycleId,
    p_started_at: input.startedAt,
    p_initial_schedule: { ...input.initialSchedule, _timezone: input.timeZone },
    p_idempotency_key: input.idempotencyKey,
  })
  return loadCycleTimeline(client, result.cycle_id)
}
