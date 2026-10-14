// src/lib/injectionPersistence.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { FEATURES } from '../config/features'
import { loadCycleTimelines } from '../features/my-stack/services/planLifecycle'
import { buildIntakeRpcEntries, confirmIntakeGroup } from '../features/routines/services/intakeConfirmation'
import type { RoutineConfirmationEntry } from '../features/routines/intakeGroups'
import { localDateTimeKey, resolveCycleAt, type CycleTimeline } from './planTimeline'
import { differenceInCalendarDays, format, parseISO, startOfDay, subDays } from 'date-fns'
import {
  AUTO_MISSED_NOTE,
  collectOpenIntakes,
  collectOpenTimelineIntakes,
  resolveTimelineIntakesForDay,
  cycleAppliesToDay,
  effectiveQuantity,
  type EscalationRow,
  type IntakeLog,
  type ScheduleCycle,
} from './intakeSchedule'
import { debitPeptideStockForDoseById as debitVialStockForDoseById } from '../features/my-stack/extensions/peptide/vialStock'
import type { InjectionLog3D, InjectionPinDraft, SelectableInjectionCycle } from './injectionLogTypes'
import { istSlotSchluessel } from '../features/routines/lib/slotKey'

const INJECTABLE_METHODS = ['Subkutan', 'IntramuskulÃ¤r', 'Intramuskulaer']
const NORMALIZED_INJECTABLE_METHODS = [...INJECTABLE_METHODS, 'Intramuskulär']

interface SaveInjectionInput {
  userId: string
  doseLogId: string | null
  stackItemId: string | null
  cycleId: string | null
  dose: number | null
  unit: string | null
  method: string | null
  notes: string | null
  loggedAt: string
  warningState: string | null
  substanceLabel?: string | null
  pin: InjectionPinDraft
}

interface InjectionLogRow {
  id: string
  user_id: string
  logged_at: string
  dose_log_id?: string | null
  stack_item_id?: string | null
  cycle_id?: string | null
  dose?: number | string | null
  unit?: string | null
  method?: string | null
  notes?: string | null
  created_at?: string | null
  model_version?: string | null
  body_region?: InjectionLog3D['body_region'] | null
  body_side?: InjectionLog3D['body_side'] | null
  position?: InjectionLog3D['position'] | null
  normal?: InjectionLog3D['normal'] | null
  uv?: InjectionLog3D['uv']
  camera_state?: InjectionLog3D['camera_state']
  warning_state?: string | null
  substance_label?: string | null
  stack_items?: { display_name?: string } | Array<{ display_name?: string }> | null
  cycles?: { name?: string } | Array<{ name?: string }> | null
}

interface SelectableCycleRow {
  id: string
  stack_item_id: string
  name: string
  dose: number | string
  unit: string
  method: string
  stack_items?: { display_name?: string } | Array<{ display_name?: string }> | null
}

type InjectionPlacementInput = Pick<SaveInjectionInput, 'notes' | 'warningState' | 'substanceLabel' | 'pin'>

/** Alles an einer Injektion, was vom Geraet kommt: Stelle, Notiz, Warnstufe. */
export function buildInjectionPlacement(input: InjectionPlacementInput) {
  return {
    notes: input.notes?.trim() || null,
    site: `${input.pin.body_region}_${input.pin.body_side}`,
    substance_label: input.substanceLabel?.trim() || null,
    body_region: input.pin.body_region,
    body_side: input.pin.body_side,
    model_version: input.pin.model_version,
    position: input.pin.position,
    normal: input.pin.normal,
    uv: input.pin.uv ?? null,
    camera_state: input.pin.camera_state ?? null,
    warning_state: input.warningState,
  }
}

export function buildInjectionInsertPayload(input: SaveInjectionInput) {
  return {
    user_id: input.userId,
    dose_log_id: input.doseLogId,
    stack_item_id: input.stackItemId,
    cycle_id: input.cycleId,
    dose: input.dose,
    unit: input.unit,
    method: input.method,
    logged_at: input.loggedAt,
    ...buildInjectionPlacement(input),
  }
}

export function isInjectionProSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string }
  const message = candidate.message?.toLowerCase() ?? ''
  return (
    candidate.code === 'PGRST204' ||
    candidate.code === '42703' ||
    (message.includes('schema cache') && message.includes('injection_logs') && message.includes('column'))
  )
}

export async function assertInjectionProSchema(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from('injection_logs')
    .select('stack_item_id, cycle_id, dose, unit, method, body_region, body_side, model_version, position, normal, uv, camera_state, warning_state, substance_label')
    .limit(0)
  if (error) throw error
}

export async function loadInjectionLogs(
  supabase: SupabaseClient,
  userId: string,
): Promise<InjectionLog3D[]> {
  const enrichedResult = await supabase
    .from('injection_logs')
    .select('*, stack_items(display_name), cycles(name)')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(300)

  let data = enrichedResult.data as InjectionLogRow[] | null
  let error = enrichedResult.error

  if (error?.code === 'PGRST200') {
    const plainResult = await supabase
      .from('injection_logs')
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(300)
    data = plainResult.data as InjectionLogRow[] | null
    error = plainResult.error
  }

  if (error) throw error

  const rows = data ?? []
  const linkedDoseLogIds = Array.from(new Set(
    rows
      .map(row => row.dose_log_id)
      .filter((id): id is string => Boolean(id)),
  ))
  const doseTakenById = new Map<string, boolean | null>()
  if (linkedDoseLogIds.length > 0) {
    const { data: doseRows, error: doseError } = await supabase
      .from('dose_logs')
      .select('id, taken')
      .eq('user_id', userId)
      .in('id', linkedDoseLogIds)
    if (!doseError) {
      for (const row of doseRows ?? []) doseTakenById.set(row.id as string, row.taken as boolean | null)
    }
  }

  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    dose_log_id: row.dose_log_id ?? null,
    dose_taken: row.dose_log_id ? doseTakenById.get(row.dose_log_id) : undefined,
    stack_item_id: row.stack_item_id ?? null,
    cycle_id: row.cycle_id ?? null,
    stack_item_name: Array.isArray(row.stack_items) ? row.stack_items[0]?.display_name ?? null : row.stack_items?.display_name ?? null,
    cycle_name: Array.isArray(row.cycles) ? row.cycles[0]?.name ?? null : row.cycles?.name ?? null,
    dose: row.dose == null ? null : Number(row.dose),
    unit: row.unit ?? null,
    method: row.method ?? null,
    notes: row.notes ?? null,
    logged_at: row.logged_at,
    created_at: row.created_at ?? null,
    model_version: row.model_version ?? 'legacy-2d',
    body_region: row.body_region ?? 'outside_typical',
    body_side: row.body_side ?? 'center',
    position: row.position ?? { x: 0, y: 0, z: 0 },
    normal: row.normal ?? { x: 0, y: 0, z: 1 },
    uv: row.uv ?? null,
    camera_state: row.camera_state ?? null,
    warning_state: row.warning_state ?? null,
    substance_label: row.substance_label ?? null,
  })) as InjectionLog3D[]
}

export async function saveInjectionLog(
  supabase: SupabaseClient,
  input: SaveInjectionInput,
): Promise<string> {
  const { data, error } = await supabase
    .from('injection_logs')
    .insert(buildInjectionInsertPayload(input))
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export interface InjectionLogEdit {
  notes: string | null
  substanceLabel: string | null
  dose: number | null
  unit: string | null
  method: string | null
  loggedAt: string
}

/**
 * Was sich an einer gespeicherten Injektion aendern laesst. Ist sie an eine
 * bestaetigte Einnahme gebunden, gehoeren Dosis, Methode und Zeitpunkt der
 * Einnahme (dose_logs) -- hier nur die Notiz, sonst laufen beide auseinander.
 * Die Stelle selbst bleibt; verschieben heisst loeschen und neu setzen.
 */
export function buildInjectionUpdatePayload(log: Pick<InjectionLog3D, 'dose_log_id'>, edit: InjectionLogEdit) {
  const notes = edit.notes?.trim() || null
  if (log.dose_log_id) return { notes }
  return {
    notes,
    substance_label: edit.substanceLabel?.trim() || null,
    dose: edit.dose,
    unit: edit.unit,
    method: edit.method,
    logged_at: edit.loggedAt,
  }
}

// Ohne passende Zeile (fremde ID, schon geloescht, RLS) melden update und
// delete keinen Fehler, sondern aendern still nichts. Das darf nicht als
// Erfolg durchgehen.
const INJECTION_LOG_NOT_FOUND = 'Injection log not found'

function requireAffectedRow(data: unknown[] | null): void {
  if (!data || data.length === 0) throw new Error(INJECTION_LOG_NOT_FOUND)
}

/** Die Zeile gibt es nicht (mehr) -- etwa auf einem anderen Geraet geloescht. */
export function isInjectionLogNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message === INJECTION_LOG_NOT_FOUND
}

export async function updateInjectionLog(
  supabase: SupabaseClient,
  userId: string,
  log: Pick<InjectionLog3D, 'id' | 'dose_log_id'>,
  edit: InjectionLogEdit,
): Promise<void> {
  const { data, error } = await supabase
    .from('injection_logs')
    .update(buildInjectionUpdatePayload(log, edit))
    .eq('id', log.id)
    .eq('user_id', userId)
    .select('id')
  if (error) throw error
  requireAffectedRow(data)
}

/** Entfernt nur die Injektionsstelle. Eine verknuepfte Einnahme bleibt unberuehrt. */
export async function deleteInjectionLog(
  supabase: SupabaseClient,
  userId: string,
  logId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('injection_logs')
    .delete()
    .eq('id', logId)
    .eq('user_id', userId)
    .select('id')
  if (error) throw error
  requireAffectedRow(data)
}

export async function loadSelectableInjectionCycles(
  supabase: SupabaseClient,
  userId: string,
): Promise<SelectableInjectionCycle[]> {
  if (FEATURES.planTimelineV2) {
    const intakes = await loadSelectableInjectionIntakes(supabase, userId)
    return [...new Map(intakes.filter(intake => intake.status === 'open' && intake.cycleId)
      .map(intake => [intake.cycleId, {
        id: intake.cycleId!, stack_item_id: intake.stackItemId, stack_item_name: intake.stackItemName,
        cycle_name: intake.cycleName, dose: intake.dose, unit: intake.unit, method: intake.method,
      }])).values()]
  }
  const { data, error } = await supabase
    .from('cycles')
    .select('id, stack_item_id, name, dose, unit, method, active, stack_items(display_name)')
    .eq('user_id', userId)
    .eq('active', true)
    .in('method', INJECTABLE_METHODS)
  if (error) throw error
  return ((data ?? []) as SelectableCycleRow[]).map(row => ({
    id: row.id,
    stack_item_id: row.stack_item_id,
    stack_item_name: Array.isArray(row.stack_items) ? row.stack_items[0]?.display_name ?? row.name : row.stack_items?.display_name ?? row.name,
    cycle_name: row.name,
    dose: Number(row.dose),
    unit: row.unit,
    method: row.method,
  }))
}

export type InjectionIntakeStatus = 'open' | 'confirmed'

export interface OpenInjectionIntake {
  cycleId: string | null
  planVersionId?: string | null
  routineSlotKey?: string | null
  stackItemId: string
  stackItemName: string
  cycleName: string
  dose: number
  unit: string
  method: string
  scheduledAt: string
  daysOverdue: number
  status: InjectionIntakeStatus
  doseLogId: string | null
}

interface InjectionDoseLog extends IntakeLog {
  id: string
  dose: number | null
  unit: string | null
  method: string
  notes?: string | null
  stack_items?: { display_name?: string; default_method?: string } | Array<{ display_name?: string; default_method?: string }> | null
}

interface InjectionCycleRow extends ScheduleCycle {
  active?: boolean
  name?: string
  method?: string
  stack_items?: { display_name?: string } | Array<{ display_name?: string }> | null
}

function stackItemName(cycle: InjectionCycleRow | undefined): string {
  if (Array.isArray(cycle?.stack_items)) return cycle.stack_items[0]?.display_name ?? cycle.name ?? 'Substanz'
  return cycle?.stack_items?.display_name ?? cycle?.name ?? 'Substanz'
}

function cycleName(cycle: InjectionCycleRow | undefined): string {
  return cycle?.name ?? ''
}

function injectionDoseValue(value: number | null): number | null {
  if (value == null || !String(value).trim()) return null
  const dose = Number(value)
  return Number.isFinite(dose) ? dose : null
}

function isAutoMissedDoseLog(log: InjectionDoseLog): boolean {
  return log.taken === false && log.notes === AUTO_MISSED_NOTE
}

function isOpenDoseLog(log: InjectionDoseLog): boolean {
  return log.taken === null || isAutoMissedDoseLog(log)
}

function doseLogSlotKey(log: InjectionDoseLog): string {
  const loggedAt = parseISO(log.logged_at)
  const minutes = loggedAt.getHours() * 60 + loggedAt.getMinutes()
  return `${log.stack_item_id}|${format(loggedAt, 'yyyy-MM-dd')}|${minutes}`
}

function openIntakeSlotKey(open: { stackItemId: string; dateKey: string; minutes: number }): string {
  return `${open.stackItemId}|${open.dateKey}|${open.minutes}`
}

export function injectionIntakeLookbackStart(now: Date, lookbackDays = 90): Date {
  return startOfDay(subDays(now, lookbackDays))
}
export function buildSelectableInjectionIntakes({
  cycles,
  logs,
  linkedDoseLogIds,
  escalations,
  now,
  lookbackDays = 90,
  timelines,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: {
  cycles: InjectionCycleRow[]
  logs: InjectionDoseLog[]
  linkedDoseLogIds: Set<string>
  escalations: EscalationRow[]
  now: Date
  lookbackDays?: number
  timelines?: CycleTimeline[]
  timeZone?: string
}): OpenInjectionIntake[] {
  if (FEATURES.planTimelineV2) {
    if (!timelines) throw new Error('Cycle timelines unavailable')
    return buildTimelineInjectionIntakes(timelines, cycles, logs, linkedDoseLogIds, now, lookbackDays, timeZone)
  }
  const activeCycles = cycles.filter(cycle => cycle.active !== false)
  const openDoseLogBySlot = new Map(
    logs
      .filter(log => isOpenDoseLog(log) && !linkedDoseLogIds.has(log.id))
      .map(log => [doseLogSlotKey(log), log]),
  )
  const linkedOpenSlotKeys = new Set(
    logs
      .filter(log => isOpenDoseLog(log) && linkedDoseLogIds.has(log.id))
      .map(doseLogSlotKey),
  )
  const logsForOpenSlots = logs.filter(log => !isAutoMissedDoseLog(log))
  const openIntakes = collectOpenIntakes(activeCycles, logsForOpenSlots, now, lookbackDays).flatMap(open => {
    const slotKey = openIntakeSlotKey(open)
    if (linkedOpenSlotKeys.has(slotKey)) return []

    const cycle = activeCycles.find(candidate => candidate.id === open.cycleId)
    const openDoseLog = openDoseLogBySlot.get(slotKey)
    const day = startOfDay(parseISO(open.dateKey))
    const scheduledAt = new Date(day.getTime() + open.minutes * 60000)
    const plannedQuantity = cycle ? effectiveQuantity(cycle, day, escalations) : null
    const dose = openDoseLog
      ? injectionDoseValue(openDoseLog.dose)
      : plannedQuantity?.dose ?? null
    const unit = openDoseLog
      ? openDoseLog.unit
      : plannedQuantity?.unit ?? null
    if (dose == null || !unit?.trim()) return []
    return [{
      cycleId: open.cycleId,
      stackItemId: open.stackItemId,
      stackItemName: stackItemName(cycle),
      cycleName: cycleName(cycle),
      dose,
      unit,
      method: openDoseLog?.method ?? cycle?.method ?? 'Subkutan',
      scheduledAt: openDoseLog?.logged_at ?? scheduledAt.toISOString(),
      daysOverdue: Math.max(0, differenceInCalendarDays(startOfDay(now), day)),
      status: 'open' as const,
      doseLogId: openDoseLog?.id ?? null,
    }]
  })

  const earliestDay = injectionIntakeLookbackStart(now, lookbackDays)
  const confirmedIntakes = logs.flatMap((log): OpenInjectionIntake[] => {
    if (log.taken !== true || linkedDoseLogIds.has(log.id)) return []
    const day = startOfDay(parseISO(log.logged_at))
    if (day < earliestDay || day > startOfDay(now)) return []

    const stackItemCycles = cycles.filter(cycle => cycle.stack_item_id === log.stack_item_id)
    const cycle = stackItemCycles.find(candidate => cycleAppliesToDay(candidate, day)) ?? stackItemCycles[0]
    const logStackItem = Array.isArray(log.stack_items) ? log.stack_items[0] : log.stack_items
    const resolvedMethod = INJECTABLE_METHODS.includes(log.method)
      ? log.method
      : cycle?.method || logStackItem?.default_method || ''
    if (!INJECTABLE_METHODS.includes(resolvedMethod)) return []

    const dose = injectionDoseValue(log.dose)
    if (dose == null || !log.unit?.trim()) return []

    return [{
      cycleId: cycle?.id ?? null,
      stackItemId: log.stack_item_id,
      stackItemName: logStackItem?.display_name ?? stackItemName(cycle),
      cycleName: cycleName(cycle),
      dose,
      unit: log.unit,
      method: resolvedMethod,
      scheduledAt: log.logged_at,
      daysOverdue: Math.max(0, differenceInCalendarDays(startOfDay(now), day)),
      status: 'confirmed',
      doseLogId: log.id,
    }]
  })

  return [...openIntakes, ...confirmedIntakes]
}

function buildTimelineInjectionIntakes(
  timelines: CycleTimeline[], cycles: InjectionCycleRow[], logs: InjectionDoseLog[],
  linkedIds: Set<string>, now: Date, lookbackDays: number, timeZone: string,
): OpenInjectionIntake[] {
  const todayKey = localDateTimeKey(now, timeZone).slice(0, 10)
  const today = parseISO(todayKey)
  const firstKey = format(subDays(today, lookbackDays), 'yyyy-MM-dd')
  const result: OpenInjectionIntake[] = []
  for (const timeline of timelines) {
    const resolved = resolveCycleAt(timeline, now, timeZone)
    if (resolved.status === 'active' && !resolved.planVersion) throw new Error('Cycle plan version unavailable')
  }
  for (let back = lookbackDays; back >= 0; back--) {
    const day = subDays(today, back)
    const localDate = format(day, 'yyyy-MM-dd')
    const firstOccurrence = timelines.flatMap(timeline => resolveTimelineIntakesForDay(timeline, localDate, timeZone))[0]
    if (!firstOccurrence) continue
    for (const occurrence of collectOpenTimelineIntakes(timelines, logs, new Date(firstOccurrence.scheduledAt), timeZone)) {
      const log = logs.find(row => row.id === occurrence.pendingLogId)
      if (log && linkedIds.has(log.id)) continue
      const dose = log ? injectionDoseValue(log.dose) : occurrence.dose
      const unit = log ? log.unit : occurrence.unit
      const method = log ? log.method : occurrence.method
      if (dose == null || !unit?.trim() || !NORMALIZED_INJECTABLE_METHODS.includes(method)) continue
      const cycle = cycles.find(row => row.id === occurrence.cycleId)
      result.push({ cycleId: occurrence.cycleId, planVersionId: log?.plan_version_id ?? occurrence.planVersionId,
        routineSlotKey: occurrence.routineSlotKey, stackItemId: occurrence.stackItemId,
        stackItemName: stackItemName(cycle), cycleName: cycleName(cycle), dose, unit, method,
        scheduledAt: occurrence.scheduledAt, daysOverdue: back, status: 'open', doseLogId: log?.id ?? null })
    }
  }
  for (const log of logs) {
    if (log.taken !== true || linkedIds.has(log.id)) continue
    const dateKey = localDateTimeKey(new Date(log.logged_at), timeZone).slice(0, 10)
    if (dateKey < firstKey || dateKey > todayKey) continue
    const exact = Boolean(log.cycle_id || log.plan_version_id)
    const timeline = log.cycle_id ? timelines.find(row => row.cycle.id === log.cycle_id)
      : !exact ? timelines.find(row => row.cycle.stack_item_id === log.stack_item_id
        && new Date(log.logged_at) >= new Date(row.cycle.started_at)
        && (!row.cycle.ended_at || new Date(log.logged_at) < new Date(row.cycle.ended_at))) : undefined
    const cycleId = log.cycle_id ?? timeline?.cycle.id ?? null
    const cycle = cycles.find(row => row.id === cycleId)
    const item = Array.isArray(log.stack_items) ? log.stack_items[0] : log.stack_items
    const method = exact ? log.method : log.method || item?.default_method || ''
    const dose = injectionDoseValue(log.dose)
    if (dose == null || !log.unit?.trim() || !NORMALIZED_INJECTABLE_METHODS.includes(method)) continue
    result.push({ cycleId, planVersionId: log.plan_version_id ?? null, routineSlotKey: log.routine_slot_key ?? null,
      stackItemId: log.stack_item_id, stackItemName: item?.display_name ?? stackItemName(cycle), cycleName: cycleName(cycle),
      dose, unit: log.unit, method, scheduledAt: log.logged_at,
      daysOverdue: differenceInCalendarDays(today, parseISO(dateKey)), status: 'confirmed', doseLogId: log.id })
  }
  return result
}

export async function loadSelectableInjectionIntakes(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<OpenInjectionIntake[]> {
  if (FEATURES.planTimelineV2) {
    const [timelines, cyclesRes, logsRes, linkedRes] = await Promise.all([
      loadCycleTimelines(supabase as never, userId),
      supabase.from('cycles').select('id, name, stack_item_id, stack_items(display_name)').eq('user_id', userId),
      supabase.from('dose_logs')
        .select('id, stack_item_id, cycle_id, plan_version_id, routine_slot_key, dose, unit, method, logged_at, taken, notes, stack_items(display_name, default_method)')
        .eq('user_id', userId).gte('logged_at', injectionIntakeLookbackStart(now).toISOString())
        .order('logged_at', { ascending: false }),
      supabase.from('injection_logs').select('dose_log_id').eq('user_id', userId).not('dose_log_id', 'is', null),
    ])
    for (const result of [cyclesRes, logsRes, linkedRes]) if (result.error) throw result.error
    return buildSelectableInjectionIntakes({ timelines, cycles: (cyclesRes.data ?? []) as InjectionCycleRow[],
      logs: (logsRes.data ?? []) as InjectionDoseLog[], escalations: [], now,
      linkedDoseLogIds: new Set((linkedRes.data ?? []).map(row => row.dose_log_id as string)) })
  }
  const [cyclesRes, logsRes, escRes, linkedRes] = await Promise.all([
    supabase.from('cycles').select('*, stack_items(display_name, default_method)').eq('user_id', userId).in('method', INJECTABLE_METHODS),
    supabase
      .from('dose_logs')
      .select('id, stack_item_id, dose, unit, method, logged_at, taken, notes, stack_items(display_name, default_method)')
      .eq('user_id', userId)
      .gte('logged_at', injectionIntakeLookbackStart(now).toISOString())
      .order('logged_at', { ascending: false }),
    supabase.from('dose_escalations').select('cycle_id, increase_amount, unit, start_type, start_date, start_after_days').eq('user_id', userId),
    supabase.from('injection_logs').select('dose_log_id').eq('user_id', userId).not('dose_log_id', 'is', null),
  ])
  if (cyclesRes.error) throw cyclesRes.error
  if (logsRes.error) throw logsRes.error
  if (escRes.error) throw escRes.error
  if (linkedRes.error) throw linkedRes.error

  const cycles = (cyclesRes.data ?? []) as InjectionCycleRow[]
  const logs = (logsRes.data ?? []) as InjectionDoseLog[]
  const linkedDoseLogIds = new Set((linkedRes.data ?? []).map(row => row.dose_log_id as string))
  const intakes = buildSelectableInjectionIntakes({
    cycles,
    logs,
    linkedDoseLogIds,
    escalations: (escRes.data ?? []) as EscalationRow[],
    now,
  })

  if (import.meta.env.DEV) {
    const todayKey = format(now, 'yyyy-MM-dd')
    const todayLogs = logs.filter(log => format(parseISO(log.logged_at), 'yyyy-MM-dd') === todayKey)
    const todayConfirmedLogs = todayLogs.filter(log => log.taken === true)
    const selectableConfirmed = intakes.filter(intake => intake.status === 'confirmed')
    const selectableConfirmedToday = selectableConfirmed.filter(
      intake => format(parseISO(intake.scheduledAt), 'yyyy-MM-dd') === todayKey,
    )
    console.info('[InjectionIntakes] Auswahl geladen', {
      today: todayKey,
      doseLogs: logs.length,
      confirmedDoseLogs: logs.filter(log => log.taken === true).length,
      linkedDoseLogs: linkedDoseLogIds.size,
      selectableConfirmed: selectableConfirmed.length,
      todayDoseLogs: todayLogs.length,
      todayConfirmedDoseLogs: todayConfirmedLogs.length,
      todayLinkedDoseLogs: todayConfirmedLogs.filter(log => linkedDoseLogIds.has(log.id)).length,
      todaySelectableConfirmed: selectableConfirmedToday.length,
      todayExcludedAfterLoad: todayConfirmedLogs.length
        - todayConfirmedLogs.filter(log => linkedDoseLogIds.has(log.id)).length
        - selectableConfirmedToday.length,
    })
  }

  return intakes
}
export async function resolveInjectionDoseLogId(
  intake: OpenInjectionIntake,
  confirmOpenIntake: () => Promise<string>,
): Promise<string> {
  if (intake.status === 'confirmed') {
    if (!intake.doseLogId) throw new Error('Confirmed intake is missing doseLogId')
    return intake.doseLogId
  }
  return confirmOpenIntake()
}

export function isDoseLogAlreadyLinkedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string }
  return candidate.code === '23505' && (candidate.message ?? '').includes('injection_logs_dose_log_id_unique_idx')
}
export interface ConfirmIntakeDoseLogInput {
  userId: string
  stackItemId: string
  dose: number
  unit: string
  method: string
  loggedAt: string
  doseLogId?: string | null
  cycleId?: string | null
  planVersionId?: string | null
  routineSlotKey?: string | null
  scheduledAt?: string
  debitVialStock?: boolean
}

/** Prueft die Herkunft der Einnahme und baut den Eintrag fuer `confirm_intake_group`. */
async function prepareTimelineConfirmEntry(
  supabase: SupabaseClient,
  input: ConfirmIntakeDoseLogInput,
): Promise<RoutineConfirmationEntry> {
  // Frueher stand hier ein Vergleich gegen den aus `scheduledAt`
  // gerechneten Zeitpunkt. Der Schluessel traegt jetzt die Wanduhr der
  // Planung, und die stimmt unterwegs bewusst nicht mit der Uhr am
  // Aufenthaltsort ueberein -- der Vergleich haette genau die Reise
  // blockiert, deretwegen das Format gewechselt ist. Geprueft wird, was
  // hier zu pruefen ist: dass der Schluessel zu diesem Zyklus gehoert und
  // nicht erfunden ist. Ob er einen offenen Platz trifft, entscheidet der
  // Upsert in der Datenbank.
  if (!input.cycleId || !input.planVersionId || !input.scheduledAt
    || !istSlotSchluessel(input.routineSlotKey, input.cycleId)) {
    throw new Error('Injection occurrence provenance unavailable')
  }
  const timelines = await loadCycleTimelines(supabase as never, input.userId)
  const timeline = timelines.find(row => row.cycle.id === input.cycleId && row.cycle.stack_item_id === input.stackItemId)
  if (!timeline) throw new Error('Injection cycle timeline unavailable')
  const resolved = resolveCycleAt(timeline, new Date(input.loggedAt), Intl.DateTimeFormat().resolvedOptions().timeZone)
  if (resolved.status !== 'active' || !resolved.planVersion) throw new Error('Injection plan version unavailable at actual time')
  return {
    key: input.routineSlotKey, cycleId: input.cycleId, planVersionId: resolved.planVersion.id,
    pendingLogId: input.doseLogId ?? null, stackItemId: input.stackItemId, stackItemName: '',
    trackingLevel: 'with_amount', group: 'morning', scheduledAt: input.scheduledAt,
    actualLoggedAt: input.loggedAt, dose: input.dose, unit: input.unit, method: input.method,
    injectable: true, selected: true, actualDose: input.dose, actualUnit: input.unit,
  }
}

// PostgREST kennt die Funktion nicht (PGRST202) bzw. Postgres (42883): die
// Migration ist auf dieser Datenbank noch nicht eingespielt.
function isMissingRpcError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883'
}

/**
 * Einnahme bestaetigen und Injektionsstelle speichern in EINER Transaktion
 * (supabase-injection-atomic-confirm.sql). Dosis, Zeitpunkt usw. der Stelle
 * setzt die Datenbank aus der bestaetigten Einnahme.
 *
 * `null`: die Datenbankfunktion fehlt noch -- der Aufrufer nimmt dann den
 * bisherigen Weg in zwei Schritten. Bestand bucht diese Funktion NIE; das
 * macht der Aufrufer danach (getrennt wiederholbar).
 */
// Einmal als fehlend erkannt, nicht bei jedem Speichern erneut versuchen
// (bis zum Neuladen der App, also bis zur naechsten Version).
let atomicConfirmRpcMissing = false

export async function confirmIntakeWithInjection(
  supabase: SupabaseClient,
  input: Omit<ConfirmIntakeDoseLogInput, 'debitVialStock'>,
  injection: InjectionPlacementInput,
): Promise<{ doseLogId: string; injectionLogId: string } | null> {
  if (atomicConfirmRpcMissing) return null
  const entry = await prepareTimelineConfirmEntry(supabase, input)
  const [p_entry] = buildIntakeRpcEntries([entry], true)
  const { data, error } = await supabase.rpc('confirm_intake_with_injection', {
    p_entry,
    p_injection: buildInjectionPlacement(injection),
  })
  if (isMissingRpcError(error)) {
    atomicConfirmRpcMissing = true
    return null
  }
  if (error) throw error
  const result = data as { dose_log_id?: string; injection_log_id?: string } | null
  if (!result?.dose_log_id || !result.injection_log_id) throw new Error('confirm_intake_with_injection returned no ids')
  return { doseLogId: result.dose_log_id, injectionLogId: result.injection_log_id }
}

/** Nur fuer Tests: den gemerkten „Funktion fehlt“-Zustand zuruecksetzen. */
export function resetAtomicConfirmRpcCache(): void {
  atomicConfirmRpcMissing = false
}

// Insert a confirmed dose_log for an intake and debit the linked vial stock,
// matching the Dashboard confirmation. Returns the new dose_log id to link.
export async function confirmIntakeDoseLog(
  supabase: SupabaseClient,
  input: ConfirmIntakeDoseLogInput,
): Promise<string> {
  if (FEATURES.planTimelineV2) {
    const [saved] = await confirmIntakeGroup(supabase, [await prepareTimelineConfirmEntry(supabase, input)])
    const id = saved?.id
    if (!id) throw new Error('Injection confirmation returned no dose log')
    if (input.debitVialStock !== false) await debitVialStockForDoseById(supabase, id)
    return id
  }
  if (input.doseLogId) {
    const { error } = await supabase
      .from('dose_logs')
      .update({
        dose: input.dose,
        unit: input.unit,
        method: input.method,
        logged_at: input.loggedAt,
        taken: true,
      })
      .eq('id', input.doseLogId)
      .eq('user_id', input.userId)
    if (error) throw error
    if (input.debitVialStock !== false) {
      await debitVialStockForDoseById(supabase, input.doseLogId)
    }
    return input.doseLogId
  }

  const { data, error } = await supabase
    .from('dose_logs')
    .insert({
      user_id: input.userId,
      stack_item_id: input.stackItemId,
      dose: input.dose,
      unit: input.unit,
      method: input.method,
      logged_at: input.loggedAt,
      taken: true,
    })
    .select('id')
    .single()
  if (error) throw error
  if (input.debitVialStock !== false) {
    await debitVialStockForDoseById(supabase, data.id as string)
  }
  return data.id as string
}
