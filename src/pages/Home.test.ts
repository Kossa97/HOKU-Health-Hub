// @vitest-environment jsdom

import { createElement, type ComponentType } from 'react'
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FEATURES } from '../config/features'
import { Home, buildHomeDoseLogPayload, buildHomeRoutineIntake, resolveHomeIntakeQuantity } from './Home'

const pageMocks = vi.hoisted(() => {
  const emptyQuery = () => {
    const query: Record<string, unknown> = {}
    for (const method of ['eq', 'gte', 'lte', 'order', 'limit', 'single']) {
      query[method] = vi.fn(() => query)
    }
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (
      Promise.resolve({ data: [], error: null }).then(resolve, reject)
    )
    return query
  }
  return {
    user: { id: 'user-1' },
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(emptyQuery),
        insert: vi.fn(emptyQuery),
        update: vi.fn(emptyQuery),
        delete: vi.fn(emptyQuery),
      })),
      rpc: vi.fn(async () => ({ data: [], error: null })),
    },
    toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  }
})

vi.mock('../lib/supabase', () => ({ supabase: pageMocks.supabase }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: pageMocks.user }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}))
vi.mock('react-hot-toast', () => ({ default: pageMocks.toast }))
vi.mock('../features/blutspiegel/BlutspiegelView', () => ({ BlutspiegelView: () => null }))
vi.mock('../components/ExpiryWarningBanners', () => ({ ExpiryWarningBanners: () => null }))
vi.mock('../components/WorkflowBanner', () => ({ WorkflowBanner: () => null }))
vi.mock('../components/injection3d/InjectionTrackerHero', () => ({ InjectionTrackerHero: () => null }))

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  disconnect() {}
})

function resolvedQuery(data: unknown, error: { message: string; code?: string } | null = null) {
  const query: Record<string, unknown> = {}
  const filters: Array<[string, unknown]> = []
  let single = false
  for (const method of ['select', 'eq', 'is', 'gte', 'lte', 'order', 'limit', 'single', 'maybeSingle']) {
    query[method] = vi.fn((column: string, value: unknown) => {
      if (method === 'eq') filters.push([column, value])
      if (method === 'single' || method === 'maybeSingle') single = true
      return query
    })
  }
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
    const rows = single && Array.isArray(data)
      ? data.filter(row => filters.every(([column, value]) => row[column] === value)) : data
    return Promise.resolve({ data: single && Array.isArray(rows) ? rows[0] ?? null : rows, error }).then(resolve, reject)
  }
  return query
}

function createHomeClient(
  fixtures: Record<string, unknown[]>,
  rpcImplementation: (name: string, params: { p_entries?: unknown[]; p_dose_log_id?: string }) => Promise<{
    data: unknown
    error: { message: string } | null
  }> = async () => ({ data: [{ id: 'saved-log-1' }, { id: 'saved-log-2' }], error: null }),
  errors: Record<string, { message: string; code?: string } | null> = {},
  skipMutation?: (operation: 'insert' | 'update', values: unknown) => unknown[],
) {
  const selectCounts = new Map<string, number>()
  const selectCalls: Array<{ table: string; columns: string }> = []
  const mutationCalls: Array<{ table: string; operation: 'insert' | 'update'; values: unknown }> = []
  const mutationQueries: ReturnType<typeof resolvedQuery>[] = []
  const queryFilters: Array<{ table: string; method: string; column: string; value: unknown }> = []
  const rpc = vi.fn(rpcImplementation)
  const from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      selectCounts.set(table, (selectCounts.get(table) ?? 0) + 1)
      selectCalls.push({ table, columns })
      const query = resolvedQuery(fixtures[table] ?? [], errors[table] ?? null)
      for (const method of ['eq', 'gte', 'lte', 'lt'] as const) {
        const inner = query[method] as (column: string, value: unknown) => unknown
        query[method] = vi.fn((column: string, value: unknown) => {
          queryFilters.push({ table, method, column, value })
          return inner(column, value)
        })
      }
      return query
    }),
    insert: vi.fn((values: unknown) => {
      mutationCalls.push({ table, operation: 'insert', values })
      return resolvedQuery(table === 'dose_logs'
        ? skipMutation?.('insert', values) ?? { id: 'saved-single-log', ...(values as object) } : null, errors.insert ?? null)
    }),
    update: vi.fn((values: unknown) => {
      mutationCalls.push({ table, operation: 'update', values })
      const query = resolvedQuery(table === 'dose_logs'
        ? skipMutation?.('update', values) ?? [{ id: 'pending-exact', ...(values as object) }] : null)
      mutationQueries.push(query)
      return query
    }),
    delete: vi.fn(() => resolvedQuery(null)),
  }))
  return { from, rpc, selectCounts, selectCalls, queryFilters, mutationCalls, mutationQueries }
}

function intakeOnlyHomeCycle() {
  return {
    id: 'cycle-1',
    stack_item_id: 'stack-1',
    dose: 100,
    unit: 'mcg',
    method: 'Oral',
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: null,
    start_date: '2020-01-01',
    end_date: null,
    intake_time: 'morgens',
    intake_time_custom: null,
    schedule_history: null,
    stack_items: { display_name: 'Vitamin D3', tracking_level: 'intake_only', dosage_form: 'capsule' },
  }
}

function quantifiedHomeCycle() {
  return {
    ...intakeOnlyHomeCycle(),
    id: 'cycle-2',
    stack_item_id: 'stack-2',
    dose: 25,
    unit: 'mg',
    stack_items: { display_name: 'Zink', tracking_level: 'complete', dosage_form: 'capsule' },
  }
}

async function confirmSingleHomeIntake(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }))
  fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false
  vi.clearAllMocks()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Home upcoming intake confirmation flow', () => {
  it('adapts a home slot to the shared group model with its pending log', () => {
    const intake = buildHomeRoutineIntake({
      key: 'cycle-1-1080',
      time: '18:00',
      min: 1080,
      substance: 'Vitamin D3',
      dose: null,
      doseNumber: null,
      unit: null,
      stackItemId: 'stack-1',
      cycleId: 'cycle-1',
      planVersionId: null,
      pendingLogId: 'pending-1',
      routineGroup: 'evening',
      trackingLevel: 'intake_only',
      dosageForm: 'capsule',
      method: 'Oral',
      scheduledAt: '2026-07-29T18:00:00.000Z',
    })

    expect(intake).toMatchObject({
      planVersionId: null,
      pendingLogId: 'pending-1',
      group: 'evening',
      dose: null,
      unit: null,
      injectable: false,
    })
  })

  it('wires a mixed routine group to one RPC and one post-success log reload', async () => {
    const client = createHomeClient({
      cycles: [intakeOnlyHomeCycle(), quantifiedHomeCycle()],
      dose_logs: [],
      stack_items: [
        { id: 'stack-1', display_name: 'Vitamin D3', dosage_form: 'capsule' },
        { id: 'stack-2', display_name: 'Zink', dosage_form: 'capsule' },
      ],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    fireEvent.click(await screen.findByRole('button', { name: 'Alle als eingenommen markieren – Morgens' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alle als eingenommen markieren' }))

    expect(await within(dialog).findByText('Routine gespeichert')).toBeTruthy()
    await waitFor(() => expect(client.rpc).toHaveBeenCalledTimes(2))
    expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: expect.arrayContaining([
        expect.objectContaining({ stack_item_id: 'stack-1', dose: null, unit: null }),
        expect.objectContaining({ stack_item_id: 'stack-2', dose: 25, unit: 'mg' }),
      ]),
    })
    expect(client.rpc.mock.calls[0][1].p_entries).toHaveLength(2)
    expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'saved-log-2',
    })
    await waitFor(() => expect(client.selectCounts.get('dose_logs')).toBe(2))
    expect(client.selectCounts.get('dose_escalations')).toBeGreaterThan(0)
    expect(client.selectCalls.find(call => call.table === 'cycles')?.columns)
      .not.toContain('cycle_plan_versions')
  })

  it('retries only generic inventory after a committed home routine', async () => {
    let inventoryAttempts = 0
    const client = createHomeClient({
      cycles: [quantifiedHomeCycle()],
      dose_logs: [],
      stack_items: [{ id: 'stack-2', display_name: 'Zink', dosage_form: 'capsule' }],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    }, async name => {
      if (name === 'confirm_intake_group') {
        return { data: [{ id: 'saved-log-2' }], error: null }
      }
      inventoryAttempts += 1
      return inventoryAttempts === 1
        ? { data: null, error: { message: 'inventory offline' } }
        : { data: 41, error: null }
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    fireEvent.click(await screen.findByRole('button', { name: 'Alle als eingenommen markieren – Morgens' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alle als eingenommen markieren' }))

    const retry = await within(dialog).findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)

    fireEvent.click(retry)
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)
  })

  it('belegt die Uhrzeit mit jetzt vor, die geplante liegt auf dem Knopf', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const jetzt = new Date()
    jetzt.setHours(7, 30, 0, 0)
    vi.setSystemTime(jetzt)
    const client = createHomeClient({
      cycles: [quantifiedHomeCycle()],
      dose_logs: [],
      stack_items: [{ id: 'stack-2', display_name: 'Zink', dosage_form: 'capsule' }],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    fireEvent.click(await screen.findByRole('button', { name: /Zink/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    const feld = screen.getByLabelText('Uhrzeit') as HTMLInputElement
    expect(feld.value).toBe('07:30')
    fireEvent.click(screen.getByRole('button', { name: /^Geplant/ }))
    expect(feld.value).toBe('08:00')
  })

  it('reuses a pending single log and applies only generic inventory with its committed id', async () => {
    const pendingAt = new Date()
    pendingAt.setHours(8, 0, 0, 0)
    const client = createHomeClient({
      cycles: [quantifiedHomeCycle()],
      dose_logs: [{
        id: 'pending-single-log',
        stack_item_id: 'stack-2',
        taken: null,
        logged_at: pendingAt.toISOString(),
      }],
      stack_items: [{ id: 'stack-2', display_name: 'Zink', dosage_form: 'capsule' }],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    }, async name => name === 'apply_inventory_confirmation'
      ? { data: 41, error: null }
      : { data: [], error: null })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    await confirmSingleHomeIntake('Zink')

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'pending-single-log',
    }))
    expect(client.mutationCalls.filter(call => call.table === 'dose_logs' && call.operation === 'insert'))
      .toHaveLength(0)
    expect(client.mutationCalls).toContainEqual(expect.objectContaining({
      table: 'dose_logs',
      operation: 'update',
      values: expect.objectContaining({ taken: true }),
    }))
    expect(client.selectCalls.some(call => (
      call.table === 'stack_items' && call.columns.includes('vial_amount_mg')
    ))).toBe(false)
  })

  it('retries only generic inventory after a committed single intake', async () => {
    let inventoryAttempts = 0
    const client = createHomeClient({
      cycles: [quantifiedHomeCycle()],
      dose_logs: [],
      stack_items: [{ id: 'stack-2', display_name: 'Zink', dosage_form: 'capsule' }],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    }, async name => {
      if (name !== 'apply_inventory_confirmation') return { data: [], error: null }
      inventoryAttempts += 1
      return inventoryAttempts === 1
        ? { data: null, error: { message: 'inventory offline' } }
        : { data: 41, error: null }
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    await confirmSingleHomeIntake('Zink')

    const retry = await screen.findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(client.mutationCalls.filter(call => call.table === 'dose_logs' && call.operation === 'insert'))
      .toHaveLength(1)
    expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'saved-single-log',
    })

    fireEvent.click(retry)
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    expect(client.mutationCalls.filter(call => call.table === 'dose_logs' && call.operation === 'insert'))
      .toHaveLength(1)
  })

  it('applies a single vial confirmation through the dose-log inventory RPC only', async () => {
    const pendingAt = new Date()
    pendingAt.setHours(8, 0, 0, 0)
    const vialCycle = {
      ...quantifiedHomeCycle(),
      stack_items: { display_name: 'Zink', tracking_level: 'complete' as const, dosage_form: 'vial' },
    }
    const client = createHomeClient({
      cycles: [vialCycle],
      dose_logs: [{
        id: 'pending-vial-log',
        stack_item_id: 'stack-2',
        taken: null,
        logged_at: pendingAt.toISOString(),
      }],
      stack_items: [{ id: 'stack-2', display_name: 'Zink', dosage_form: 'vial' }],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    await confirmSingleHomeIntake('Zink')

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'pending-vial-log',
    }))
    expect(client.selectCalls.some(call => (
      call.table === 'stack_items' && call.columns.includes('vial_amount_mg')
    ))).toBe(false)
  })

  it('retries only vial stock after a committed home routine', async () => {
    let stockAttempts = 0
    const vialCycle = {
      ...quantifiedHomeCycle(),
      stack_items: { display_name: 'Zink', tracking_level: 'complete' as const, dosage_form: 'vial' },
    }
    const client = createHomeClient({
      cycles: [vialCycle],
      dose_logs: [],
      stack_items: [{ id: 'stack-2', display_name: 'Zink', dosage_form: 'vial' }],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    }, async name => {
      if (name === 'confirm_intake_group') return { data: [{ id: 'saved-vial-log' }], error: null }
      stockAttempts += 1
      return stockAttempts === 1
        ? { data: null, error: { message: 'vial stock offline' } }
        : { data: 0.9, error: null }
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    fireEvent.click(await screen.findByRole('button', { name: 'Alle als eingenommen markieren – Morgens' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alle als eingenommen markieren' }))

    const retry = await within(dialog).findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)
    fireEvent.click(retry)
    await waitFor(() => expect(stockAttempts).toBe(2))
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)
  })

  it('uses the active schedule segment quantity and supplied unit label for today', () => {
    const quantity = resolveHomeIntakeQuantity({
      id: 'cycle-1',
      stack_item_id: 'stack-1',
      start_date: '2026-07-01',
      end_date: null,
      frequency: 'Taeglich',
      x_days_interval: null,
      schedule_days: null,
      intake_time: 'morgens',
      intake_time_custom: null,
      dose: 1,
      unit: 'tablet',
      schedule_history: [{
        effective_from: '2026-07-20',
        frequency: 'Taeglich',
        x_days_interval: null,
        schedule_days: null,
        intake_time: 'morgens',
        intake_time_custom: null,
        dose: 0.5,
        unit: 'Tablette',
      }],
    }, new Date('2026-07-29T08:00:00'), [])

    expect(quantity).toEqual({
      doseNumber: 0.5,
      unit: 'Tablette',
      dose: '\u00BD Tablette',
    })
  })

  it('keeps an unknown active schedule quantity nullable for today', () => {
    const quantity = resolveHomeIntakeQuantity({
      id: 'cycle-1',
      stack_item_id: 'stack-1',
      start_date: '2026-07-01',
      end_date: null,
      frequency: 'Taeglich',
      x_days_interval: null,
      schedule_days: null,
      intake_time: 'morgens',
      intake_time_custom: null,
      dose: 100,
      unit: 'mcg',
      schedule_history: [{
        effective_from: '2026-07-20',
        frequency: 'Taeglich',
        x_days_interval: null,
        schedule_days: null,
        intake_time: 'morgens',
        intake_time_custom: null,
        dose: null,
        unit: null,
      }],
    }, new Date('2026-07-29T08:00:00'), [])

    expect(quantity).toEqual({ doseNumber: null, unit: null, dose: null })
  })

  it('does not pair a schedule unit with a rejected mixed-unit adjustment', () => {
    const quantity = resolveHomeIntakeQuantity({
      id: 'cycle-1',
      stack_item_id: 'stack-1',
      start_date: '2026-07-01',
      end_date: null,
      frequency: 'Taeglich',
      x_days_interval: null,
      schedule_days: null,
      intake_time: 'morgens',
      intake_time_custom: null,
      dose: 10,
      unit: 'mg',
      schedule_history: null,
    }, new Date('2026-07-29T08:00:00'), [{
      cycle_id: 'cycle-1',
      increase_amount: 5,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-07-20',
      start_after_days: null,
    }])

    expect(quantity).toEqual({ doseNumber: null, unit: null, dose: null })
  })

  it('builds an unknown taken log with null quantity and the chosen timestamp', () => {
    const payload = buildHomeDoseLogPayload({
      userId: 'user-1',
      stackItemId: 'stack-1',
      doseNumber: null,
      unit: null,
      method: 'Oral',
      scheduledAt: '2026-07-29T06:00:00.000Z',
      taken: true,
      timeValue: '10:45',
    })

    expect(payload).toEqual({
      user_id: 'user-1',
      stack_item_id: 'stack-1',
      dose: null,
      unit: null,
      method: 'Oral',
      logged_at: '2026-07-29T08:45:00.000Z',
      taken: true,
    })
  })

  it('keeps skipped logs false when their quantity is unknown', () => {
    const payload = buildHomeDoseLogPayload({
      userId: 'user-1',
      stackItemId: 'stack-1',
      doseNumber: null,
      unit: null,
      method: null,
      scheduledAt: '2026-07-29T06:00:00.000Z',
      taken: false,
    })

    expect(payload).toEqual(expect.objectContaining({
      dose: null,
      unit: null,
      logged_at: '2026-07-29T06:00:00.000Z',
      taken: false,
    }))
  })
})

describe('Home normalized timeline path', () => {
  it.each([
    { archived: true, configuration_status: 'complete', migration_conflicts: [] },
    { archived: false, configuration_status: 'needs_review', migration_conflicts: [] },
    { archived: false, configuration_status: 'complete', migration_conflicts: [{ resolved_at: null }] },
  ])('offers no dues for an unavailable item and resumes after resolution: %j', async item => {
    const fixtures = startFixFixture()
    Object.assign(fixtures.cycles[0].stack_items, item)
    fixtures.cycles.push({ ...fixtures.cycles[0], id: 'competing-cycle' })
    const client = createHomeClient(fixtures)
    const page = renderNormalized(client)
    await waitFor(() => expect(client.selectCounts.get('cycles')).toBe(1))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(screen.queryByRole('button', { name: /Vitamin D3/ })).toBeNull()
    page.unmount()
    vi.setSystemTime(new Date('2026-09-18T08:05:00Z'))
    const selected = normalizedCycle()
    Object.assign(selected.stack_items, { archived: false, configuration_status: 'complete', migration_conflicts: [] })
    selected.versions[0].dose = 20
    const rejected = Object.assign(normalizedCycle(), {
      id: 'competing-cycle', active: false, end_date: '2026-09-18',
      ended_at: '2026-09-18T08:00:00Z', closed_by_migration_resolution: true,
    })
    rejected.versions[0] = { ...rejected.versions[0], id: 'rejected-version', cycle_id: rejected.id, dose: 10 }
    rejected.stack_items = selected.stack_items
    fixtures.cycles = [selected, rejected]
    renderNormalized(client)
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Vitamin D3/ })).toHaveLength(1))
    expect(screen.getByRole('button', { name: /Vitamin D3/ }).textContent).toContain('20 mg')
  })

  function startFixFixture() {
    vi.stubEnv('TZ', 'Europe/Berlin')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-18T14:00:00Z'))
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    return {
      cycles: [normalizedCycle()], dose_logs: [] as unknown[],
      stack_items: [{ id: 'stack-1', display_name: 'Vitamin D3', tracking_level: 'complete', dosage_form: 'capsule' }],
      inventory_items: [], injection_logs: [],
    }
  }

  function renderNormalized(client: ReturnType<typeof createHomeClient>) {
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    return render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))
  }

  it('reuses the exact pending row when skipping a normalized Home intake', async () => {
    const fixtures = startFixFixture()
    fixtures.dose_logs = [{ id: 'pending-exact', stack_item_id: 'stack-1', taken: null,
      logged_at: '2026-09-18T07:00:00.000Z', cycle_id: 'timeline-cycle',
      plan_version_id: 'timeline-version', routine_slot_key: 'timeline-cycle@2026-09-18T08:00' }]
    const client = createHomeClient(fixtures)
    renderNormalized(client)
    fireEvent.click(await screen.findByRole('button', { name: /Vitamin D3/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Übersprungen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({
        cycle_id: 'timeline-cycle', plan_version_id: 'timeline-version',
        dose_log_id: 'pending-exact', slot_key: 'timeline-cycle@2026-09-18T08:00',
        logged_at: '2026-09-18T07:00:00.000Z', dose: 25, unit: 'mg', method: 'Oral', taken: false,
      })],
    }))
    expect(client.mutationCalls).toEqual([])
  })

  it('surfaces an authoritative skip rejection without a direct dose-log write', async () => {
    const fixtures = startFixFixture()
    const client = createHomeClient(fixtures, async name => name === 'confirm_intake_group'
      ? { data: null, error: { message: 'Intake falls within a paused cycle' } }
      : { data: null, error: null })
    renderNormalized(client)
    fireEvent.click(await screen.findByRole('button', { name: /Vitamin D3/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Übersprungen' }))
    await waitFor(() => expect(pageMocks.toast.error).toHaveBeenCalledWith('Fehler beim Speichern'))
    expect(pageMocks.toast).not.toHaveBeenCalledWith('Einnahme übersprungen')
    expect(client.mutationCalls).toEqual([])
  })

  it('sends edited Home time with its actual-time version and original occurrence key', async () => {
    const fixtures = startFixFixture()
    fixtures.cycles[0].versions.push({ ...fixtures.cycles[0].versions[0], id: 'version-afternoon',
      effective_kind: 'instant', effective_at: '2026-09-18T13:00:00Z', effective_local_date: null } as never)
    const client = createHomeClient(fixtures)
    renderNormalized(client)
    fireEvent.click(await screen.findByRole('button', { name: /Vitamin D3/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '16:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({ plan_version_id: 'version-afternoon',
        slot_key: 'timeline-cycle@2026-09-18T08:00', logged_at: '2026-09-18T14:00:00.000Z' })],
    }))
  })

  it('preserves the pending actual-time provenance when skipping after a version change', async () => {
    const fixtures = startFixFixture()
    fixtures.cycles[0].versions.push({ ...fixtures.cycles[0].versions[0], id: 'version-afternoon',
      effective_kind: 'instant', effective_at: '2026-09-18T13:00:00Z', effective_local_date: null } as never)
    fixtures.dose_logs = [{ id: 'pending-exact', stack_item_id: 'stack-1', taken: null,
      logged_at: '2026-09-18T14:00:00.000Z', cycle_id: 'timeline-cycle',
      plan_version_id: 'version-afternoon', routine_slot_key: 'timeline-cycle@2026-09-18T08:00' }]
    const client = createHomeClient(fixtures)
    renderNormalized(client)
    fireEvent.click(await screen.findByRole('button', { name: /Vitamin D3/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Übersprungen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({
        plan_version_id: 'version-afternoon', logged_at: '2026-09-18T14:00:00.000Z',
        slot_key: 'timeline-cycle@2026-09-18T08:00', taken: false,
      })],
    }))
    expect(client.mutationCalls).toEqual([])
  })

  it('keeps normalized group inventory retry available across the post-confirm reload', async () => {
    const fixtures = startFixFixture()
    let inventoryAttempts = 0
    const client = createHomeClient(fixtures, async name => {
      if (name === 'apply_inventory_confirmation' && ++inventoryAttempts === 1) {
        return { data: null, error: { message: 'retry inventory' } }
      }
      return { data: [{ id: 'saved' }], error: null }
    })
    renderNormalized(client)
    fireEvent.click(await screen.findByRole('button', { name: /Alle als eingenommen markieren/ }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Alle als eingenommen markieren' }))
    await waitFor(() => expect(client.selectCounts.get('dose_logs')).toBe(2))
    await screen.findByRole('button', { name: /Vitamin D3/ })
    fireEvent.click(await screen.findByRole('button', { name: 'Bestand erneut versuchen' }))
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    expect(client.rpc.mock.calls.filter(call => call[0] === 'confirm_intake_group')).toHaveLength(1)
  })

  it('shows an explicit normalized loading/error state and restores the schedule on retry', async () => {
    const errors = { cycles: { message: 'timeline unavailable' } as { message: string } | null }
    const client = createHomeClient(startFixFixture(), undefined, errors)
    renderNormalized(client)
    expect(screen.getByRole('status').textContent).toContain('Lädt')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Vitamin D3/ })).toBeNull()
    errors.cycles = null
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByRole('button', { name: /Vitamin D3/ })).toBeTruthy()
  })

  it('removes stale Home actions when a post-confirm reload fails', async () => {
    const errors = { cycles: null as { message: string } | null }
    const client = createHomeClient(startFixFixture(), async () => {
      errors.cycles = { message: 'reload unavailable' }
      return { data: [{ id: 'saved' }], error: null }
    }, errors)
    renderNormalized(client)
    await confirmSingleHomeIntake('Vitamin D3')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Vitamin D3/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Alle als eingenommen/ })).toBeNull()
  })

  it('counts only current active or paused timelines in the Home statistic', async () => {
    const fixtures = startFixFixture()
    fixtures.cycles.push(
      { ...normalizedCycle(), id: 'paused', pauses: [{ id: 'p', cycle_id: 'paused', paused_at: '2026-09-17T00:00:00Z', ends_at: null }] },
      { ...normalizedCycle(), id: 'future', started_at: '2026-09-19T00:00:00Z' },
      { ...normalizedCycle(), id: 'ended', ended_at: '2026-09-18T12:00:00Z' } as never,
    )
    renderNormalized(createHomeClient(fixtures))
    await screen.findAllByRole('button', { name: /Vitamin D3/ })
    const stat = screen.getByText('stat_active_cycles').closest('button')!
    expect(stat.textContent).toMatch(/2/)
    expect(stat.textContent).not.toMatch(/4/)
  })

  function normalizedCycle(pauses: unknown[] = []) {
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const localDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')
    return {
      id: 'timeline-cycle',
      stack_item_id: 'stack-1',
      start_date: localDate,
      end_date: null as string | null,
      active: true,
      frequency: 'Täglich',
      x_days_interval: null,
      schedule_days: null,
      intake_time: 'morgens',
      intake_time_custom: '08:00',
      dose: 25,
      unit: 'mg',
      method: 'Oral',
      schedule_history: null,
      stack_items: {
        display_name: 'Vitamin D3', tracking_level: 'complete', dosage_form: 'capsule',
      },
      started_at: new Date(today.getTime() - 86_400_000).toISOString(),
      ended_at: null as string | null,
      versions: [{
        id: 'timeline-version',
        cycle_id: 'timeline-cycle',
        effective_kind: 'local_date',
        effective_at: null,
        effective_local_date: localDate,
        change_kind: 'initial',
        frequency: 'Täglich',
        x_days_interval: null,
        interval_unit: null,
        cycle_on_days: null,
        cycle_off_days: null,
        schedule_days: [],
        intake_time: 'morgens',
        intake_time_custom: '08:00',
        slot_doses: null,
        slot_days: null,
        dose: 25,
        unit: 'mg',
        method: 'Oral',
      }],
      pauses,
    }
  }

  it('loads normalized timelines without dose escalations and confirms the exact version', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const client = createHomeClient({
      cycles: [normalizedCycle()],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1', display_name: 'Vitamin D3', tracking_level: 'complete',
        dosage_form: 'capsule', vials_in_stock: 3,
      }],
      inventory_items: [],
      injection_logs: [],
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    fireEvent.click(await screen.findByRole('button', { name: 'Alle als eingenommen markieren – Morgens' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alle als eingenommen markieren' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({
        cycle_id: 'timeline-cycle',
        plan_version_id: 'timeline-version',
        slot_key: expect.stringMatching(/^timeline-cycle@/),
      })],
    }))
    expect(client.selectCounts.get('dose_escalations')).toBeUndefined()
    expect(client.selectCalls.find(call => call.table === 'cycles')?.columns)
      .toContain('cycle_plan_versions')
    expect(client.selectCalls.find(call => call.table === 'dose_logs')?.columns)
      .toContain('routine_slot_key')
    expect(client.queryFilters.some(filter => (
      filter.table === 'dose_logs' && filter.method === 'gte' && filter.column === 'logged_at'
    ))).toBe(true)
  })

  it('does not render or auto-insert an intake during a full-day pause', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, '0'),
      String(yesterday.getDate()).padStart(2, '0'),
    ].join('-')
    localStorage.setItem('tyd_automiss_since', yesterdayKey)
    const pausedCycle = normalizedCycle([{
      id: 'pause-1',
      cycle_id: 'timeline-cycle',
      paused_at: new Date(now.getTime() - 2 * 86_400_000).toISOString(),
      ends_at: new Date(now.getTime() + 86_400_000).toISOString(),
    }])
    pausedCycle.start_date = yesterdayKey
    pausedCycle.started_at = new Date(now.getTime() - 2 * 86_400_000).toISOString()
    pausedCycle.versions[0].effective_local_date = yesterdayKey
    const client = createHomeClient({
      cycles: [pausedCycle],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1', display_name: 'Vitamin D3', tracking_level: 'complete',
        dosage_form: 'capsule', vials_in_stock: 3,
      }],
      inventory_items: [],
      injection_logs: [],
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    await waitFor(() => expect(client.selectCounts.get('cycles')).toBe(1))
    expect(screen.queryByRole('button', { name: /Alle als eingenommen markieren/ })).toBeNull()
    expect(client.mutationCalls.filter(call => call.table === 'dose_logs' && call.operation === 'insert'))
      .toHaveLength(0)
  })

  it('auto-marks a closed normalized slot through the idempotent RPC', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, '0'),
      String(yesterday.getDate()).padStart(2, '0'),
    ].join('-')
    localStorage.setItem('tyd_automiss_since', yesterdayKey)
    const cycle = normalizedCycle()
    cycle.start_date = yesterdayKey
    cycle.started_at = new Date(now.getTime() - 2 * 86_400_000).toISOString()
    cycle.versions[0].effective_local_date = yesterdayKey
    const client = createHomeClient({
      cycles: [cycle],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1', display_name: 'Vitamin D3', tracking_level: 'complete',
        dosage_form: 'capsule', vials_in_stock: 3,
      }],
      inventory_items: [],
      injection_logs: [],
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({
      stack_item_id: 'stack-1',
      cycle_id: 'timeline-cycle',
      plan_version_id: 'timeline-version',
      slot_key: expect.stringMatching(/^timeline-cycle@/),
      logged_at: expect.any(String),
      dose: 25,
      unit: 'mg',
      method: 'Oral',
      taken: false,
      })],
    }))
    expect(client.mutationCalls.filter(call => call.table === 'dose_logs')).toHaveLength(0)
  })

  it('marks nothing as missed that Dot logs automatically', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, '0'),
      String(yesterday.getDate()).padStart(2, '0'),
    ].join('-')
    localStorage.setItem('tyd_automiss_since', yesterdayKey)
    const cycle = normalizedCycle()
    cycle.start_date = yesterdayKey
    cycle.started_at = new Date(now.getTime() - 2 * 86_400_000).toISOString()
    cycle.versions[0].effective_local_date = yesterdayKey
    const client = createHomeClient({
      cycles: [cycle],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1', display_name: 'Vitamin D3', tracking_level: 'complete',
        dosage_form: 'capsule', vials_in_stock: 3,
      }],
      // Das Bündel mit Vitamin D3 trägt seit vorgestern automatisch ein
      intake_bundles: [{ stack_item_ids: ['stack-1'], auto_log_since: cycle.started_at }],
      inventory_items: [],
      injection_logs: [],
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    await screen.findAllByText(/Vitamin D3/)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(client.rpc).not.toHaveBeenCalledWith('confirm_intake_group', expect.anything())
  })

  it('bounds dose history and defers auto-miss until after today is painted', () => {
    const source = readFileSync('src/pages/Home.tsx', 'utf8')
    const loader = source.slice(source.indexOf('async function load()'), source.indexOf('void load()'))
    expect(loader).toContain(".gte('logged_at', logsSince)")
    expect(loader).toContain('missedTimer = window.setTimeout')
    expect(loader).toContain('AUTO_MISS_DAY_BATCH')
    expect(loader.indexOf("setTimelineLoadState('ready')"))
      .toBeLessThan(loader.indexOf('collectMissedTimelineIntakes'))
  })
})
