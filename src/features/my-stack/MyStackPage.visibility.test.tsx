// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { loadStackItems, type LoadedStackItem } from './services/stackItems'
import type { StackItemWizardProps } from './components/StackItemWizard'
import { emptyRhythm } from './lib/intakeRhythm'
import { MyStackPage } from './MyStackPage'
import { installDenyFeedback } from '../../lib/denyFeedback'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDosageForm } from './lib/dosageForms'
import { FEATURES } from '../../config/features'
import toast from 'react-hot-toast'

const qaName = 'Codex QA Stack Lifecycle 2026-07-24'
const visibilityMocks = vi.hoisted(() => ({
  escalations: [] as Array<Record<string, unknown>>,
  realWizard: false,
  mutations: [] as Array<{ table: string; values: unknown }>,
  archiveError: null as string | null,
}))

type LoadedLegacyStackItem = LoadedStackItem & { default_method?: string }
const loadedItems: LoadedLegacyStackItem[] = [
  {
    id: 'other-1',
    user_id: 'user-1',
    display_name: qaName,
    category: 'supplement',
    dosage_form: 'other',
    brand: 'Codex QA Brand A',
    color_hex: '#f97316',
    notes: null,
    configuration_status: 'complete',
    tracking_level: 'complete',
    pk_profile_method: null,
    archived: false,
    archived_at: null,
    created_at: '2026-07-24T00:19:53.509875Z',
    updated_at: '2026-07-24T00:19:53.509875Z',
    default_method: 'Subkutan',
    ingredients: [{
      id: 'ingredient-1',
      stack_item_id: 'other-1',
      catalog_substance_id: null,
      custom_name: 'Magnesium',
      amount_value: 100,
      amount_unit: 'mg',
      basis_value: 1,
      basis_unit: 'application',
      position: 0,
      substance_catalog: null,
    }, {
      id: 'ingredient-1b',
      stack_item_id: 'other-1',
      catalog_substance_id: 'vitamin-d3',
      custom_name: '',
      amount_value: 5_000,
      amount_unit: 'IU',
      basis_value: 1,
      basis_unit: 'application',
      position: 1,
      substance_catalog: {
        id: 'vitamin-d3',
        canonical_name: 'Vitamin D3',
        aliases: [],
        default_category: 'vitamin',
        suggested_units: ['IU'],
        suggested_dosage_forms: ['other'],
        pk_profile_id: 'pk-vitamin-d3',
        active: true,
      },
    }],
  },
  {
    id: 'vial-1',
    user_id: 'user-1',
    display_name: 'Existing Premium Vial',
    category: 'peptide',
    dosage_form: 'vial',
    brand: null,
    color_hex: '#06b6d4',
    notes: null,
    configuration_status: 'complete',
    tracking_level: 'complete',
    pk_profile_method: null,
    archived: false,
    archived_at: null,
    created_at: '2026-07-21T10:00:00.000Z',
    updated_at: '2026-07-21T10:00:00.000Z',
    ingredients: [{
      id: 'ingredient-2',
      stack_item_id: 'vial-1',
      catalog_substance_id: null,
      custom_name: 'Existing Premium Vial',
      amount_value: 5,
      amount_unit: 'mg',
      basis_value: 1,
      basis_unit: 'vial',
      position: 0,
      substance_catalog: null,
    }],
  },
]

const activeCycle = {
  id: 'cycle-active-1',
  user_id: 'user-1',
  stack_item_id: 'other-1',
  name: 'Abendplan',
  dose: 100,
  unit: 'mg',
  method: 'Oral',
  frequency: 'daily',
  x_days_interval: null,
  schedule_days: [],
  start_date: '2026-07-24',
  end_date: null,
  active: true,
  intake_time: 'abends',
  intake_time_custom: '20:30',
  schedule_history: null,
  reminder: '10m',
  created_at: '2026-07-24T00:30:00.000Z',
}

function normalizedVersion(
  id: string,
  cycleId: string,
  changes: Record<string, unknown> = {},
) {
  return {
    id,
    cycle_id: cycleId,
    change_kind: 'initial' as const,
    effective_kind: 'local_date' as const,
    effective_at: null,
    effective_local_date: '2026-07-24',
    frequency: 'daily',
    x_days_interval: null,
    interval_unit: null,
    cycle_on_days: null,
    cycle_off_days: null,
    schedule_days: [],
    intake_time: 'abends',
    intake_time_custom: '20:30',
    slot_doses: null,
    slot_days: null,
    dose: 100,
    unit: 'mg',
    method: 'Oral',
    ...changes,
  }
}

function timelineRow(
  cycleId: string,
  versions = [normalizedVersion(`${cycleId}-version`, cycleId)],
  changes: Record<string, unknown> = {},
) {
  return {
    id: cycleId,
    stack_item_id: 'other-1',
    started_at: '2026-07-24T00:30:00.000Z',
    ended_at: null,
    versions,
    pauses: [],
    ...changes,
  }
}

function v2Client(options: {
  timelineResults: Array<{ data: unknown[] | null; error: { message: string } | null }>
  rpc?: ReturnType<typeof vi.fn>
  singleRows?: Record<string, unknown>
  legacyCycles?: unknown[]
}) {
  const timelineQuery = vi.fn(async () => (
    options.timelineResults.shift() ?? { data: [], error: null }
  ))
  const rpc = options.rpc ?? vi.fn(async () => ({ data: null, error: null }))
  const client = {
    from: vi.fn((table: string) => {
      if (table !== 'cycles') throw new Error(`Unexpected table: ${table}`)
      return {
        select: vi.fn((columns: string) => ({
          eq: vi.fn((column: string, value: string) => {
            if (columns === '*') {
              return Promise.resolve({ data: options.legacyCycles ?? [], error: null })
            }
            if (column === 'id') {
              return {
                single: vi.fn(async () => ({
                  data: options.singleRows?.[value] ?? null,
                  error: options.singleRows?.[value] ? null : { message: 'missing timeline' },
                })),
              }
            }
            return { order: timelineQuery }
          }),
        })),
      }
    }),
    rpc,
  }
  return { client, rpc, timelineQuery }
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'de' } }),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('../../lib/supabase', () => {
  return { supabase: { from: (table: string) => {
    const builder: Record<string, unknown> = {}
    builder.select = () => builder
    builder.eq = () => builder
    builder.order = () => builder
    let updating = false
    builder.update = (values: unknown) => {
      updating = true
      visibilityMocks.mutations.push({ table, values })
      return builder
    }
    builder.then = (resolve: (value: { data: unknown[]; error: { message: string } | null }) => unknown) => Promise.resolve({
      data: table === 'dose_escalations' ? visibilityMocks.escalations : [],
      error: updating && visibilityMocks.archiveError ? { message: visibilityMocks.archiveError } : null,
    }).then(resolve)
    return builder
  } } }
})

vi.mock('../../lib/useNew', () => ({
  useNew: () => [false, vi.fn()],
}))

vi.mock('../../components/SloshContext', () => ({
  SloshProvider: ({ children }: { children: React.ReactNode }) => children,
  useSloshEngine: () => ({ pushImpulse: vi.fn() }),
}))

vi.mock('../../components/LabLoader', () => ({
  LabLoader: () => null,
}))

vi.mock('./components/StackStage', () => ({
  StackStage: ({ item }: { item: LoadedStackItem }) => (
    <div data-testid={`stack-stage-${item.id}`}>{item.display_name}</div>
  ),
}))

vi.mock('./components/StackItemWizard', async importOriginal => {
  const original = await importOriginal<typeof import('./components/StackItemWizard')>()
  return {
    StackItemWizard: (props: StackItemWizardProps) => {
      if (visibilityMocks.realWizard) return <original.StackItemWizard {...props} />
      const { catalogEntries, existingItem, existingPlan, planEditContext, intent, onClose, onSave, onSavePlanChange } = props
      const selectedPlan = planEditContext?.snapshot ?? existingPlan
      return (
        <div role="dialog" aria-label="stack-item-wizard">
      <span data-testid="wizard-catalog-ids">{catalogEntries.map(entry => entry.id).join(',')}</span>
      <span data-testid="wizard-intent">{intent ?? ''}</span>
      <span data-testid="wizard-item-id">{existingItem?.id ?? ''}</span>
      <span data-testid="wizard-plan-id">{selectedPlan?.id ?? ''}</span>
      <span data-testid="wizard-plan-method">{selectedPlan?.method ?? ''}</span>
      <span data-testid="wizard-plan-dose">{selectedPlan?.slots[0]?.dose ?? ''}</span>
      <span data-testid="wizard-plan-unit">{selectedPlan?.unit ?? ''}</span>
      <span data-testid="wizard-plan-frequency">{selectedPlan?.rhythm.kind ?? ''}</span>
      <span data-testid="wizard-plan-routine-group">{selectedPlan?.slots[0]?.routineGroup ?? ''}</span>
      <span data-testid="wizard-plan-time">{selectedPlan?.slots[0]?.time ?? ''}</span>
      <span data-testid="wizard-target-cycle-id">{planEditContext?.target.cycleId ?? ''}</span>
      <span data-testid="wizard-target-version-id">{planEditContext?.target.versionId ?? ''}</span>
      <span data-testid="wizard-change-kind">{planEditContext?.changeKind ?? ''}</span>
      <button
        type="button"
        onClick={() => {
          const inventory = {
            enabled: false,
            packageQuantity: null,
            packageUnit: null,
            remainingQuantity: null,
            brand: '',
            batchNumber: '',
            expiresAt: null,
          }
          if (existingItem) {
            void onSave({
              id: existingItem.id,
              displayName: existingItem.display_name,
              trackingLevel: existingItem.tracking_level,
              category: existingItem.category,
              dosageForm: existingItem.dosage_form,
              brand: existingItem.brand ?? '',
              colorHex: existingItem.color_hex ?? '',
              notes: existingItem.notes ?? '',
              ingredients: existingItem.ingredients,
              pkProfileMethod: existingItem.pk_profile_method,
              plan: existingPlan ?? { name: 'Existing metadata', method: 'Oral', unit: 'mg', rhythm: emptyRhythm(),
                startDate: '2026-09-19', endDate: null, slots: [{ routineGroup: 'morning', time: '08:00', dose: 1, weekdays: [] }], reminders: [] },
              inventory,
            }, 'update', 'wizard-save-key').then(onClose)
            return
          }
          void onSave({
            displayName: 'New setup',
            trackingLevel: 'intake_only',
            category: 'supplement',
            dosageForm: 'other',
            brand: '',
            colorHex: '#f97316',
            notes: '',
            ingredients: [{
              catalog_substance_id: null,
              custom_name: 'New setup',
              amount_value: null,
              amount_unit: null,
              basis_value: null,
              basis_unit: null,
              position: 0,
            }],
            pkProfileMethod: null,
            plan: {
              name: 'Start plan',
              unit: null,
              method: 'Oral',
              rhythm: emptyRhythm(),
              startDate: '2026-08-16',
              endDate: null,
              slots: [{ routineGroup: 'morning', time: null, dose: null, weekdays: [] }],
              reminders: [],
            },
            inventory,
          }, 'create', 'wizard-save-key').then(onClose)
        }}
      >
        save hydrated plan
      </button>
      {planEditContext && onSavePlanChange && (
        <button
          type="button"
          onClick={() => {
            void onSavePlanChange({
              target: planEditContext.target,
              snapshot: {
                frequency: 'daily',
                x_days_interval: null,
                interval_unit: null,
                cycle_on_days: null,
                cycle_off_days: null,
                schedule_days: [],
                intake_time: 'abends',
                intake_time_custom: '20:30',
                slot_doses: null,
                slot_days: null,
                dose: 125,
                unit: 'mg',
                method: 'Oral',
              },
              effective: planEditContext.initialEffective ?? { kind: 'now', localDate: null },
              changeKind: planEditContext.changeKind,
              timeZone: planEditContext.timeZone,
            }).then(onClose).catch(() => undefined)
          }}
        >
          save version change
        </button>
      )}
        </div>
      )
    },
  }
})

vi.mock('./components/StackArchive', () => ({
  StackArchive: () => null,
}))

vi.mock('./services/stackItems', async importOriginal => {
  const original = await importOriginal<typeof import('./services/stackItems')>()
  return {
    ...original,
    loadStackItems: vi.fn(async (_client: unknown, archived: boolean) => archived ? [] : loadedItems),
  }
})

vi.mock('./services/substanceCatalog', () => ({
  searchSubstanceCatalog: vi.fn(async () => ({ entries: [], unavailable: false })),
}))

vi.mock('./lib/colorMigration', () => ({
  isLocalColorMigrationComplete: () => true,
  migrateLocalColors: vi.fn(async () => false),
}))

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}))

/** Die Listenzeile einer Substanz — null, solange sie nicht sichtbar ist. */
function visibleCardFor(name: string): HTMLElement | null {
  const row = screen.queryAllByText(name)
    .map(node => node.closest<HTMLElement>('[data-list-row]'))
    .find((node): node is HTMLElement => node !== null) ?? null
  return row?.closest('.hidden') ? null : row
}

/** Tippt die Listenzeile an: das Vollbild der Substanz oeffnet sich. */
function openDetailFor(name: string): HTMLElement {
  const row = visibleCardFor(name)
  if (!row) throw new Error(`Expected visible list row for ${name}`)
  fireEvent.click(within(row).getByRole('button', { name: 'my_stack_list_open' }))
  return screen.getByRole('dialog', { name })
}

/** Bearbeiten und Loeschen liegen im Vollbild, nicht mehr auf der Zeile. */
function detailButtonFor(name: string, label: 'bearbeiten' | 'loeschen'): HTMLElement {
  return within(openDetailFor(name)).getByRole('button', { name: label })
}

/**
 * Vom Vollbild in die Plan-Uebersicht — dorthin, wo frueher die
 * aufgeklappte Listenkarte die Zyklen zeigte.
 */
async function openPlanFor(name: string): Promise<void> {
  const dialog = openDetailFor(name)
  if (FEATURES.planTimelineV2) {
    // Mit laufendem Plan „Plan & Verlauf oeffnen", nur mit beendeten „Verlauf ansehen".
    fireEvent.click(await within(dialog).findByRole('button', {
      name: /^(my_stack_plan_open_overview|my_stack_plan_view_history)$/,
    }))
    return
  }
  const zyklus = dialog.querySelector<HTMLElement>('[data-stack-detail="zyklus"] button')
  if (!zyklus) throw new Error('Expected the cycle entry in the detail view')
  fireEvent.click(zyklus)
}

async function renderPage(): Promise<void> {
  render(
    <MemoryRouter initialEntries={['/my-stack']}>
      <MyStackPage />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getAllByText('Existing Premium Vial').length).toBeGreaterThan(0))
}

async function openLegacyCycleEditor(cycleId: string): Promise<void> {
  await openPlanFor(qaName)
  const cycleCard = document.querySelector<HTMLElement>(`[data-cycle-id="${cycleId}"]`)
  if (!cycleCard) throw new Error(`Expected cycle card ${cycleId}`)
  const zugeklappt = cycleCard.querySelector<HTMLElement>('button[aria-expanded="false"]')
  if (zugeklappt) fireEvent.click(zugeklappt)
  fireEvent.click(within(cycleCard).getByRole('button', { name: 'bearbeiten' }))
}

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location-search">{location.search}</span>
}

function BrowserBackButton() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate(-1)}>Browser zurück</button>
}

function PathProbe() {
  return <output aria-label="current path">{useLocation().pathname}</output>
}

function versionedCycle(effectiveFrom: string) {
  const segment = {
    frequency: activeCycle.frequency,
    x_days_interval: activeCycle.x_days_interval,
    schedule_days: activeCycle.schedule_days,
    intake_time: activeCycle.intake_time,
    intake_time_custom: activeCycle.intake_time_custom,
  }
  return {
    ...activeCycle,
    schedule_history: [
      { ...segment, effective_from: activeCycle.start_date, dose: 100, unit: 'mg' },
      { ...segment, effective_from: effectiveFrom, dose: 150, unit: 'mg' },
    ],
  }
}

describe('MyStackPage non-vial visibility', () => {
  beforeEach(() => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false
    localStorage.clear()
    localStorage.setItem('tyd_peptide_view', 'vials')
    visibilityMocks.escalations = []
    visibilityMocks.realWizard = false
    visibilityMocks.mutations = []
    visibilityMocks.archiveError = null
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false
    cleanup()
    vi.clearAllMocks()
  })

  it('owns the available viewport and keeps the primary carousel inside it', async () => {
    await renderPage()

    const page = document.querySelector<HTMLElement>('[data-my-stack-page]')
    const body = document.querySelector<HTMLElement>('[data-my-stack-body]')
    const carousel = document.querySelector<HTMLElement>('[data-my-stack-carousel]')
    const tabs = document.querySelector<HTMLElement>('[data-stack-tabs]')
    const strip = document.querySelector<HTMLElement>('[data-vial-carousel-strip]')

    expect(page).not.toBeNull()
    expect(page?.className).toContain('h-full')
    expect(page?.className).toContain('overflow-hidden')
    expect(page?.className).toContain('overscroll-none')
    expect(page?.className).toContain('touch-pan-x')
    expect(body?.className).toContain('min-h-0')
    expect(body?.className).toContain('overflow-hidden')
    expect(body?.className).toContain('overscroll-none')
    expect(carousel?.className).toContain('min-h-0')
    expect(carousel?.className).toContain('flex-1')
    expect(tabs?.className).toContain('overflow-y-hidden')
    expect(tabs?.className).toContain('touch-pan-x')
    expect(strip).not.toBeNull()
    expect(strip?.className).toContain('overflow-y-hidden')
    expect(strip?.className).toContain('overscroll-none')
    expect(strip?.className).toContain('touch-pan-x')
  })

  it('sperrt leere Reiter, statt das Karussell samt Leiste verschwinden zu lassen', async () => {
    const uninstall = installDenyFeedback()
    try {
      await renderPage()
      const leer = document.querySelector<HTMLElement>('[data-stack-tab="medication"]')!
      expect(leer.getAttribute('aria-disabled')).toBe('true')
      expect(leer.getAttribute('data-deny-reason')).toBe('my_stack_tab_locked')

      fireEvent.click(leer)

      expect(leer.hasAttribute('data-deny')).toBe(true)
      expect(document.querySelector('[data-stack-tabs]')).not.toBeNull()
      expect(document.querySelector('[data-stack-tab="all"]')?.getAttribute('aria-selected')).toBe('true')
      expect(document.querySelector('[data-stack-tab="peptide"]')?.hasAttribute('aria-disabled')).toBe(false)
    } finally {
      uninstall()
    }
  })

  it('macht die „Neu"-Kachel in der Positionszeile und mit dem Zurück-Pfeil erreichbar', async () => {
    await renderPage()
    const plus = document.querySelector<HTMLElement>('[data-vial-add-dot]')!
    expect(plus).not.toBeNull()
    expect(plus.hasAttribute('aria-current')).toBe(false)
    expect(document.querySelector('[data-vial-dot="0"]')?.getAttribute('aria-current')).toBe('true')

    // Von der ersten Substanz zurück landet man bei der Kachel, nicht am Ende.
    fireEvent.click(screen.getByRole('button', { name: 'Vorheriges Peptid' }))
    expect(plus.getAttribute('aria-current')).toBe('true')
    expect(document.querySelector('[data-vial-dot="0"]')?.hasAttribute('aria-current')).toBe(false)

    // Steht die Kachel in der Mitte, ist die erste Substanz nur ein Nachbar:
    // ein Tipp holt sie in die Mitte, statt gleich ihr Vollbild zu öffnen.
    fireEvent.click(screen.getByRole('button', { name: 'Existing Premium Vial' }))
    expect(screen.queryByRole('dialog', { name: 'Existing Premium Vial' })).toBeNull()
    expect(document.querySelector('[data-vial-dot="0"]')?.getAttribute('aria-current')).toBe('true')

    // Über das „+" wieder zur Kachel, über den Punkt wieder zurück.
    fireEvent.click(plus)
    expect(plus.getAttribute('aria-current')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_go_to_item' }))
    expect(document.querySelector('[data-vial-dot="0"]')?.getAttribute('aria-current')).toBe('true')
  })

  it('öffnet „Neue Substanz“ direkt über den Plus-Knopf in der Kopfzeile', async () => {
    await renderPage()
    const plus = document.querySelector<HTMLElement>('[data-my-stack-add]')!
    expect(plus.getAttribute('aria-label')).toBe('neues_peptid_title')

    fireEvent.click(plus)

    const wizard = await screen.findByRole('dialog', { name: 'stack-item-wizard' })
    expect(within(wizard).getByTestId('wizard-item-id').textContent).toBe('')

    // Bleibt bei offener Suche stehen — ohne Treffer will man genau anlegen.
    fireEvent.click(screen.getByRole('button', { name: 'peptid_suchen' }))
    expect(document.querySelector('[data-my-stack-add]')).not.toBeNull()
    // Der Punkt vor der Positionszeile hat einen eigenen Namen: er oeffnet
    // nichts, er faehrt nur zur Kachel.
    expect(document.querySelector('[data-vial-add-dot]')?.getAttribute('aria-label')).toBe('my_stack_go_to_add_tile')
  })

  it('nimmt beim Schließen der Suche den Fokus mit (keine Tastatur, kein unsichtbares Filtern)', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'peptid_suchen' }))
    const feld = screen.getByPlaceholderText('peptid_suchen')
    feld.focus()
    fireEvent.change(feld, { target: { value: 'Vi' } })
    expect(document.activeElement).toBe(feld)

    fireEvent.click(screen.getByRole('button', { name: 'close' }))

    expect(document.activeElement).not.toBe(feld)
    expect((feld as HTMLInputElement).value).toBe('')

    // Escape ebenso.
    fireEvent.click(screen.getByRole('button', { name: 'peptid_suchen' }))
    feld.focus()
    fireEvent.keyDown(feld, { key: 'Escape' })
    expect(document.activeElement).not.toBe(feld)
  })

  it('keeps vertical scrolling available in list mode', async () => {
    localStorage.setItem('tyd_peptide_view', 'list')
    await renderPage()

    const page = document.querySelector<HTMLElement>('[data-my-stack-page]')
    const body = document.querySelector<HTMLElement>('[data-my-stack-body]')

    expect(page?.className).not.toContain('touch-pan-x')
    expect(body?.className).toContain('overflow-y-auto')
    expect(body?.className).toContain('overscroll-contain')
  })

  it('keeps an active non-vial item visible and editable beside the premium vial stage', async () => {
    await renderPage()

    const card = visibleCardFor(qaName)
    expect(card).not.toBeNull()
    expect(screen.getByTestId('stack-stage-vial-1')).not.toBeNull()
    expect(screen.queryByTestId('stack-stage-other-1')).toBeNull()
    // Die Zeile selbst traegt keine Aktionen mehr — sie oeffnet das Vollbild,
    // und dort stehen Bearbeiten und Loeschen.
    expect(within(card!).queryByRole('button', { name: 'loeschen' })).toBeNull()
    const detail = openDetailFor(qaName)
    expect(within(detail).getByRole('button', { name: 'bearbeiten' })).not.toBeNull()
    expect(within(detail).getByRole('button', { name: 'loeschen' })).not.toBeNull()
  })

  it('shows mixing in the composition, the batch in the substance and the stock as its own line', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Existing Premium Vial' }))
    const dialog = await screen.findByRole('dialog', { name: 'Existing Premium Vial' })
    const substance = dialog.querySelector<HTMLElement>('[data-stack-detail="substanz"]')
    const product = dialog.querySelector<HTMLElement>('[data-stack-detail="produkt"]')

    expect(substance?.querySelector('[data-stack-detail-field="wirkstoff"]')).toBeNull()
    expect(within(product!).getByRole('heading', { name: 'Zusammensetzung' })).not.toBeNull()
    // Nur Gesetztes bekommt eine Zeile; was fehlt, zaehlt der Knopf darunter.
    expect(product?.querySelector('[data-stack-detail-field="wirkstoff"]')).not.toBeNull()
    for (const feld of ['fluessigkeit', 'rekonstituiert_am', 'haltbarkeit', 'batch', 'quelle', 'analyse']) {
      const zeile = dialog.querySelector<HTMLElement>(`[data-stack-detail-field="${feld}"]`)
      if (zeile) expect(zeile.textContent, feld).not.toContain('Nicht gesetzt')
    }
    expect(dialog.textContent).not.toContain('Nicht gesetzt')
    expect(Number(dialog.querySelector('[data-stack-detail-missing]')?.getAttribute('data-stack-detail-missing'))).toBeGreaterThan(0)
    // Ohne Ablaufdatum keine Kachel „Nicht gesetzt".
    expect(dialog.querySelector('[data-stack-detail-field="ablauf"]')).toBeNull()
    // Den Vorrat zeigt die Bestand-Anzeige, keine Kachel — und kein eigenes Fenster.
    expect(dialog.querySelector('[data-stack-detail-field="vorrat"]')).toBeNull()
    const stock = dialog.querySelector<HTMLElement>('[data-stack-detail="bestand"]')
    expect(stock).not.toBeNull()
    expect(within(stock!).getAllByRole('button')).toHaveLength(1)
    // Die Notiz steht unter ihrem Namen, nicht rechts daneben abgeschnitten.
    // (Leer steht sie gar nicht da.)
    const notiz = substance?.querySelector('[data-stack-detail-field="notizen"]')
    if (notiz) expect(notiz.getAttribute('data-wide')).toBe('true')
  })

  it('shows a set expiry date as the unopened one', async () => {
    const vial = loadedItems.find(item => item.id === 'vial-1')!
    const vorher = vial.inventory
    vial.inventory = {
      id: 'inv-vial-1', enabled: false, package_quantity: null, package_unit: null, remaining_quantity: null,
      batch_number: null, expires_at: '2027-03-01', batch_source: null, batch_file_url: null,
      opened_at: null, use_within_days: null, reconstitution_ml: null,
    } as never
    try {
      await renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'Existing Premium Vial' }))
      const dialog = await screen.findByRole('dialog', { name: 'Existing Premium Vial' })
      const tile = dialog.querySelector<HTMLElement>('[data-stack-detail-field="ablauf"]')
      expect(tile).not.toBeNull()
      expect(within(tile!).getByText('my_stack_stock_expires_unopened')).toBeTruthy()
      expect(tile!.textContent).toContain('01.03.2027')
      // Ein kurzer Wert steht rechts neben seinem Namen.
      expect(tile!.getAttribute('data-wide')).toBe('false')
    } finally {
      vial.inventory = vorher
    }
  })

  it('uses the first browser-back step to close substance details without leaving My Stack', async () => {
    render(
      <MemoryRouter initialEntries={['/', '/my-stack']} initialIndex={1}>
        <PathProbe />
        <Routes>
          <Route path="/" element={<p>Home route</p>} />
          <Route path="/my-stack" element={<><MyStackPage /><BrowserBackButton /></>} />
        </Routes>
      </MemoryRouter>,
    )
    const stackObject = await screen.findByRole('button', { name: 'Existing Premium Vial' })
    fireEvent.click(stackObject)
    expect(await screen.findByRole('dialog', { name: 'Existing Premium Vial' })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Browser zurück' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Existing Premium Vial' })).toBeNull())
    expect(screen.getByLabelText('current path').textContent).toBe('/my-stack')
    expect(screen.getByRole('button', { name: 'Existing Premium Vial' })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Browser zurück' }))

    await waitFor(() => expect(screen.getByLabelText('current path').textContent).toBe('/'))
  })

  it('shows the active cycle as one status-marked entry and reveals its details after tapping it', async () => {
    const vialCycle = { ...activeCycle, stack_item_id: 'vial-1' }
    const cyclesEq = vi.fn(async () => ({ data: [vialCycle], error: null }))
    const stackDataClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: cyclesEq })) })),
    }

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )
    const stackObject = await screen.findByRole('button', { name: 'Existing Premium Vial' })
    fireEvent.click(stackObject)

    const dialog = await screen.findByRole('dialog', { name: 'Existing Premium Vial' })
    const cycleSection = dialog.querySelector<HTMLElement>('[data-stack-detail="zyklus"]')
    expect(cycleSection).not.toBeNull()
    const cycleButton = within(cycleSection!).getByRole('button', { name: 'aktiv_badge Abendplan zyklus' })
    expect(cycleButton.querySelector('[data-active-cycle-indicator]')).not.toBeNull()
    expect(cycleSection?.textContent).toBe('Abendplan zyklus')
    expect(within(cycleSection!).queryByRole('button', { name: 'deaktivieren_title' })).toBeNull()

    fireEvent.click(cycleButton)

    expect(screen.queryByRole('dialog', { name: 'Existing Premium Vial' })).toBeNull()
    expect(await screen.findByText('zyklen_verwalten')).not.toBeNull()
    expect(screen.getByText('100 mg')).not.toBeNull()
    expect(screen.getByText('daily')).not.toBeNull()
  })

  it('puts the newest currently active V2 cycle before paused, planned, and ended cycles', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const now = new Date()
    const row = (
      id: string,
      startedAt: Date,
      changes: Record<string, unknown> = {},
    ) => timelineRow(
      id,
      [normalizedVersion(`${id}-version`, id, {
        effective_local_date: format(startedAt, 'yyyy-MM-dd'),
      })],
      { stack_item_id: 'vial-1', started_at: startedAt.toISOString(), ...changes },
    )
    const planned = row('cycle-planned', addDays(now, 10))
    const ended = row('cycle-ended', addDays(now, -20), {
      ended_at: addDays(now, -10).toISOString(),
    })
    const activeOlder = row('cycle-active-older', addDays(now, -5))
    const paused = row('cycle-paused', addDays(now, -3), {
      pauses: [{
        id: 'pause-current',
        cycle_id: 'cycle-paused',
        paused_at: addDays(now, -1).toISOString(),
        ends_at: null,
      }],
    })
    const activeNewest = row('cycle-active-newest', addDays(now, -1))
    const vialCycle = { ...activeCycle, id: 'legacy-vial-cycle', stack_item_id: 'vial-1' }
    const { client } = v2Client({
      timelineResults: [{
        data: [planned, ended, activeOlder, paused, activeNewest],
        error: null,
      }],
      legacyCycles: [vialCycle],
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Existing Premium Vial' }))
    const detail = await screen.findByRole('dialog', { name: 'Existing Premium Vial' })
    // Mit der Plan-Zeitleiste fuehrt die Plan-Karte oben im Vollbild zur Uebersicht.
    const summary = detail.querySelector<HTMLElement>('[data-plan-summary]')!
    expect(summary.dataset.planSummary).toBe('active')
    expect(detail.querySelector('[data-stack-detail="zyklus"]')).toBeNull()
    fireEvent.click(within(summary).getByRole('button', { name: 'my_stack_plan_open_overview' }))

    const sections = await screen.findAllByTestId(/^plan-management-/)
    expect(sections.map(section => section.dataset.testid)).toEqual([
      'plan-management-cycle-active-newest',
      'plan-management-cycle-active-older',
      'plan-management-cycle-paused',
      'plan-management-cycle-planned',
      'plan-management-cycle-ended',
    ])
  })


  it('summarizes a non-vial item with its composition', async () => {
    await renderPage()

    const card = visibleCardFor(qaName)
    expect(card).not.toBeNull()
    // Die Zeile zeigt die Zusammensetzung — eine Mischung jeden Wirkstoff
    // mit Namen und Menge —, nicht die Darreichungsform.
    expect(card?.textContent).not.toContain('dosage_form_other')
    expect(card?.textContent).toContain('Magnesium 100 mg')
    // Zahlen in der Schreibweise der Sprache: 5.000 auf Deutsch.
    expect(card?.textContent).toContain('Vitamin D3 5.000 IU')
    expect(card?.textContent).not.toContain('method_subkutan')
  })
  it('shows an exact-name non-vial search result instead of a blank vial view', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'peptid_suchen' }))
    fireEvent.change(screen.getByPlaceholderText('peptid_suchen'), { target: { value: qaName } })

    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    expect(screen.queryByText('kein_peptid_gefunden_msg')).toBeNull()
  })

  it('opens a PK deep link without guessing a newest active plan', async () => {
    const cyclesEq = vi.fn(async () => ({ data: [activeCycle], error: null }))
    const stackDataClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: cyclesEq })) })),
    }

    render(
      <MemoryRouter initialEntries={['/my-stack?edit=other-1&intent=pk']}>
        <LocationProbe />
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'stack-item-wizard' })).toBeTruthy())
    expect(screen.getByTestId('wizard-intent').textContent).toBe('pk')
    expect(screen.getByTestId('wizard-item-id').textContent).toBe('other-1')
    expect(screen.getByTestId('wizard-plan-id').textContent).toBe('')
    expect(screen.getByTestId('wizard-catalog-ids').textContent).toContain('vitamin-d3')
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toBe(''))
  })

  it.each([
    { label: 'before the future boundary', offsetDays: 1, dose: 100 },
    { label: 'on the effective-date boundary', offsetDays: 0, dose: 150 },
  ])('hydrates and saves the active schedule quantity $label', async ({ offsetDays, dose }) => {
    localStorage.setItem('tyd_peptide_view', 'list')
    const cycle = versionedCycle(format(addDays(new Date(), offsetDays), 'yyyy-MM-dd'))
    const cyclesEq = vi.fn(async () => ({ data: [cycle], error: null }))
    const cyclesSelect = vi.fn(() => ({ eq: cyclesEq }))
    const rpc = vi.fn(async () => ({ data: loadedItems[0], error: null }))
    const stackDataClient = {
      from: vi.fn((table: string) => {
        if (table !== 'cycles') throw new Error(`Unexpected table: ${table}`)
        return { select: cyclesSelect }
      }),
      rpc,
    }

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())

    await openLegacyCycleEditor(cycle.id)

    expect(screen.getByTestId('wizard-plan-id').textContent).toBe(cycle.id)
    expect(screen.getByTestId('wizard-plan-method').textContent).toBe(cycle.method)
    expect(screen.getByTestId('wizard-plan-dose').textContent).toBe(String(dose))
    expect(screen.getByTestId('wizard-plan-unit').textContent).toBe('mg')
    fireEvent.click(screen.getByRole('button', { name: 'save hydrated plan' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    expect(rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({ id: cycle.id, dose, unit: 'mg' }),
    }))
    await waitFor(() => {
      const activeItemLoads = vi.mocked(loadStackItems).mock.calls.filter(
        ([client, archived]) => (client as unknown) === stackDataClient && archived === false,
      )
      expect(activeItemLoads).toHaveLength(2)
      expect(stackDataClient.from).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByText('Substanz gespeichert')).toBeNull()
    expect(screen.queryByText('Zyklus anlegen')).toBeNull()
  })

  it('hydrates the base segment without folding an active escalation into the editable dose', async () => {
    localStorage.setItem('tyd_peptide_view', 'list')
    const cycle = {
      ...activeCycle,
      dose: 5,
      unit: 'mg',
    }
    visibilityMocks.escalations = [{
      id: 'same-unit-step',
      cycle_id: cycle.id,
      increase_amount: 5,
      unit: 'mg',
      start_type: 'date',
      start_date: activeCycle.start_date,
      start_after_days: null,
      notes: null,
    }]
    const cyclesEq = vi.fn(async () => ({ data: [cycle], error: null }))
    const rpc = vi.fn(async () => ({ data: loadedItems[0], error: null }))
    const stackDataClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: cyclesEq })) })),
      rpc,
    }

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())

    await openLegacyCycleEditor(cycle.id)

    expect(screen.getByTestId('wizard-plan-dose').textContent).toBe('5')
    expect(screen.getByTestId('wizard-plan-unit').textContent).toBe('mg')
    fireEvent.click(screen.getByRole('button', { name: 'save hydrated plan' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    expect(rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({ id: cycle.id, dose: 5, unit: 'mg' }),
    }))
    expect(visibilityMocks.escalations).toHaveLength(1)
  })

  it('hydrates every editable schedule field from the segment active before a future change', async () => {
    localStorage.setItem('tyd_peptide_view', 'list')
    const futureDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const cycle = {
      ...activeCycle,
      dose: 150,
      frequency: 'Wochentage wählen',
      schedule_days: ['Mo'],
      intake_time: 'morgens',
      intake_time_custom: '09:30',
      schedule_history: [{
        effective_from: activeCycle.start_date,
        frequency: 'Täglich',
        x_days_interval: null,
        schedule_days: [],
        intake_time: 'abends',
        intake_time_custom: '20:30',
        dose: 100,
        unit: 'mg',
      }, {
        effective_from: futureDate,
        frequency: 'Wochentage wählen',
        x_days_interval: null,
        schedule_days: ['Mo'],
        intake_time: 'morgens',
        intake_time_custom: '09:30',
        dose: 150,
        unit: 'mg',
      }],
    }
    const cyclesEq = vi.fn(async () => ({ data: [cycle], error: null }))
    const rpc = vi.fn(async () => ({ data: loadedItems[0], error: null }))
    const stackDataClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: cyclesEq })) })),
      rpc,
    }

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())

    await openLegacyCycleEditor(cycle.id)

    expect(screen.getByTestId('wizard-plan-dose').textContent).toBe('100')
    // Die Harness zeigt die Form des Rhythmus, nicht mehr den Frequenztext.
    expect(screen.getByTestId('wizard-plan-frequency').textContent).toBe('daily')
    expect(screen.getByTestId('wizard-plan-routine-group').textContent).toBe('evening')
    expect(screen.getByTestId('wizard-plan-time').textContent).toBe('20:30')
  })

  it('does not show the retired cycle prompt after atomically saving a new setup', async () => {
    localStorage.setItem('tyd_peptide_view', 'list')
    const cyclesEq = vi.fn(async () => ({ data: [], error: null }))
    const cyclesSelect = vi.fn(() => ({ eq: cyclesEq }))
    const rpc = vi.fn(async () => ({ data: loadedItems[0], error: null }))
    const stackDataClient = {
      from: vi.fn(() => ({ select: cyclesSelect })),
      rpc,
    }

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(document.querySelector('[data-my-stack-add]')).not.toBeNull())

    fireEvent.click(document.querySelector<HTMLElement>('[data-my-stack-add]')!)
    fireEvent.click(screen.getByRole('button', { name: 'save hydrated plan' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    expect(rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_item: expect.objectContaining({ id: null }),
      p_plan: expect.objectContaining({ id: null }),
      p_idempotency_key: 'wizard-save-key',
    }))
    expect(screen.queryByText('Substanz gespeichert')).toBeNull()
    expect(screen.queryByText('Zyklus anlegen')).toBeNull()
  })

  it.each(['', '&intent=pk'])('saves existing metadata without invoking initial cycle creation (%s)', async suffix => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const row = timelineRow('existing-cycle')
    const rpc = vi.fn(async (name: string) => name === 'save_stack_item'
      ? { data: loadedItems[0], error: null }
      : { data: null, error: { message: 'duplicate key violates cycles_one_open_per_stack_item' } })
    const { client } = v2Client({ timelineResults: [{ data: [row], error: null }, { data: [row], error: null }], rpc })
    render(<MemoryRouter initialEntries={[`/my-stack?edit=other-1${suffix}`]}><MyStackPage stackDataClient={client as never} /></MemoryRouter>)
    if (!suffix) {
      await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
      fireEvent.click(detailButtonFor(qaName, 'bearbeiten'))
    }
    fireEvent.click(await screen.findByRole('button', { name: 'save hydrated plan' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('save_stack_item', expect.objectContaining({
      p_item: expect.objectContaining({ id: 'other-1' }),
    })))
    expect(rpc).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'stack-item-wizard' })).toBeNull())
  })

  it('saves through the real metadata wizard without offering discarded plan edits', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    visibilityMocks.realWizard = true
    const row = timelineRow('metadata-real-cycle')
    const rpc = vi.fn(async (name: string) => name === 'save_stack_item'
      ? { data: loadedItems[0], error: null }
      : { data: null, error: { message: 'duplicate key violates cycles_one_open_per_stack_item' } })
    const { client } = v2Client({ timelineResults: [{ data: [row], error: null }, { data: [row], error: null }], rpc })
    render(<MemoryRouter initialEntries={['/my-stack']}><MyStackPage stackDataClient={client as never} /></MemoryRouter>)
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    fireEvent.click(detailButtonFor(qaName, 'bearbeiten'))
    for (let step = 0; step < 10 && !screen.queryByRole('button', { name: 'save' }); step++) {
      expect(screen.queryByLabelText('my_stack_plan_start_date')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('save_stack_item', expect.objectContaining({ p_item: expect.objectContaining({ id: 'other-1' }) })))
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it.each([null, 'archive rejected'])('archives under V2 without ending or updating a cycle (%s)', async error => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    visibilityMocks.archiveError = error
    await renderPage()
    fireEvent.click(detailButtonFor(qaName, 'loeschen'))
    const dialog = await screen.findByRole('dialog', { name: 'substanz_entfernen_title' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'archivieren_behalten' }))
    if (error) {
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('error'))
      expect(screen.getByRole('dialog', { name: 'substanz_entfernen_title' })).not.toBeNull()
      expect(toast.success).not.toHaveBeenCalled()
    } else {
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('substanz_archiviert'))
      expect(screen.queryByRole('dialog', { name: 'substanz_entfernen_title' })).toBeNull()
    }
    expect(visibilityMocks.mutations).toEqual([{ table: 'stack_items', values: {
      archived: true, archived_at: expect.any(String),
    } }])
  })

  it('targets the selected future V2 version instead of another active cycle', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const currentVersion = {
      id: 'version-current', cycle_id: activeCycle.id, change_kind: 'initial' as const,
      effective_kind: 'local_date' as const, effective_at: null, effective_local_date: '2026-07-24',
      frequency: 'daily', x_days_interval: null, interval_unit: null,
      cycle_on_days: null, cycle_off_days: null, schedule_days: [],
      intake_time: 'abends', intake_time_custom: '20:30', slot_doses: null,
      slot_days: null, dose: 100, unit: 'mg', method: 'Oral',
    }
    const futureVersion = {
      ...currentVersion,
      id: 'version-future-exact',
      change_kind: 'schedule' as const,
      effective_local_date: '2099-10-01',
      dose: 150,
    }
    const timelineRow = {
      id: activeCycle.id,
      stack_item_id: activeCycle.stack_item_id,
      started_at: '2026-07-24T00:30:00.000Z',
      ended_at: null,
      versions: [currentVersion, futureVersion],
      pauses: [],
    }
    const stackDataClient = {
      from: vi.fn(() => ({
        select: vi.fn((columns: string) => ({
          eq: vi.fn(() => columns === '*'
            ? Promise.resolve({ data: [activeCycle], error: null })
            : { order: vi.fn(async () => ({ data: [timelineRow], error: null })) }),
        })),
      })),
      rpc: vi.fn(),
    }

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    await openPlanFor(qaName)

    const section = await screen.findByTestId(`plan-management-${activeCycle.id}`)
    fireEvent.click(within(section).getByRole('button', {
      name: 'my_stack_plan_edit_future',
    }))

    expect(screen.getByTestId('wizard-target-cycle-id').textContent).toBe(activeCycle.id)
    expect(screen.getByTestId('wizard-target-version-id').textContent).toBe('version-future-exact')
    // Die Art bei reinen Mengenaenderungen; mehr entscheidet der Vergleich mit der Stufe davor beim Speichern.
    expect(screen.getByTestId('wizard-change-kind').textContent).toBe('dose')
  })

  it('hides both ordinary schedules for a needs-review item and resolves the chosen running cycle', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const needsReviewItem = { ...loadedItems[0], configuration_status: 'needs_review' as const }
    const resolvedItem = { ...needsReviewItem, configuration_status: 'complete' as const }
    vi.mocked(loadStackItems)
      .mockResolvedValueOnce([needsReviewItem, loadedItems[1]])
      .mockResolvedValueOnce([resolvedItem, loadedItems[1]])
    const conflictItem = { archived: false, configuration_status: 'needs_review', migration_conflicts: [{ resolved_at: null }] }
    const first = timelineRow('cycle-conflict-first', undefined, { stack_items: conflictItem })
    const kept = timelineRow('cycle-conflict-kept', [normalizedVersion(
      'cycle-conflict-kept-version',
      'cycle-conflict-kept',
      { dose: 250 },
    )], { stack_items: conflictItem })
    const closed = timelineRow('cycle-conflict-first', first.versions, {
      ended_at: '2026-09-19T08:00:00.000Z',
    })
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name === 'resolve_cycle_migration_conflict') {
        return { data: { cycle_id: params.p_keep_cycle_id }, error: null }
      }
      return { data: null, error: { message: `Unexpected RPC: ${name}` } }
    })
    const { client } = v2Client({
      timelineResults: [
        { data: [first, kept], error: null },
        { data: [closed, kept], error: null },
      ],
      rpc,
      singleRows: { 'cycle-conflict-kept': kept },
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    await openPlanFor(qaName)

    const choices = await screen.findAllByRole('button', { name: 'my_stack_plan_conflict_keep' })
    expect(choices).toHaveLength(2)
    expect(screen.queryByText('my_stack_plan_next_intake')).toBeNull()
    expect(screen.queryByText('my_stack_plan_next_change')).toBeNull()
    fireEvent.click(within(screen.getByTestId('plan-management-cycle-conflict-kept')).getByRole('button', {
      name: 'my_stack_plan_conflict_keep',
    }))

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('resolve_cycle_migration_conflict', {
      p_stack_item_id: 'other-1',
      p_keep_cycle_id: 'cycle-conflict-kept',
      p_idempotency_key: expect.any(String),
    }))
    await waitFor(() => expect(screen.getByText('my_stack_plan_next_intake')).toBeTruthy())
    expect(screen.getByTestId('plan-management-cycle-conflict-kept').textContent).toContain('250')
  })

  it('keeps missing-timezone history visible and refreshes only after explicit zone review', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    vi.mocked(loadStackItems)
      .mockResolvedValueOnce([{ ...loadedItems[0], configuration_status: 'needs_review' }, loadedItems[1]])
      .mockResolvedValueOnce(loadedItems)
    const unknown = timelineRow('unknown-zone', undefined, {
      started_at: null, ended_at: null, timezone_review_required: true,
      stack_items: { archived: false, configuration_status: 'needs_review', migration_conflicts: [{ resolved_at: null }] },
    })
    const resolved = timelineRow('unknown-zone', unknown.versions, {
      started_at: '2026-09-01T04:00:00Z', lifecycle_timezone: 'America/New_York', timezone_review_required: false,
    })
    const rpc = vi.fn(async () => ({ data: { stack_item_id: 'other-1' }, error: null }))
    const { client } = v2Client({ timelineResults: [{ data: [unknown], error: null }, { data: [resolved], error: null }], rpc })
    render(<MemoryRouter initialEntries={['/my-stack']}><MyStackPage stackDataClient={client as never} /></MemoryRouter>)
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    await openPlanFor(qaName)
    const input = await screen.findByLabelText('my_stack_course_timezone')
    expect(rpc).not.toHaveBeenCalled()
    expect(screen.queryByText('my_stack_plan_next_intake')).toBeNull()
    fireEvent.change(input, { target: { value: 'America/New_York' } })
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_course_timezone_confirm' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('resolve_cycle_course_timezone', {
      p_stack_item_id: 'other-1', p_timezone: 'America/New_York', p_idempotency_key: expect.any(String),
    }))
    await waitFor(() => expect(screen.queryByText('my_stack_course_timezone_review')).toBeNull())
    expect(screen.getByTestId('plan-management-unknown-zone')).toBeTruthy()
  })

  it('opens one timezone review per stack item from the calendar deep link', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    vi.mocked(loadStackItems).mockResolvedValueOnce([
      { ...loadedItems[0], configuration_status: 'needs_review' }, loadedItems[1],
    ])
    const firstUnknown = timelineRow('unknown-zone-first', undefined, {
      started_at: null, ended_at: null, timezone_review_required: true,
      stack_items: { archived: false, configuration_status: 'needs_review', migration_conflicts: [] },
    })
    const secondUnknown = timelineRow('unknown-zone-second', undefined, {
      started_at: null, ended_at: null, timezone_review_required: true,
      stack_items: { archived: false, configuration_status: 'needs_review', migration_conflicts: [] },
    })
    const { client } = v2Client({
      timelineResults: [{ data: [firstUnknown, secondUnknown], error: null }],
    })

    render(
      <MemoryRouter initialEntries={['/my-stack?review=timezone&stackItem=other-1']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getAllByLabelText('my_stack_course_timezone')).toHaveLength(1))
    expect(screen.getByRole('heading', { name: qaName })).toBeTruthy()
  })

  it('keeps the timezone deep link until a failed timeline load is retried', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    vi.mocked(loadStackItems).mockResolvedValueOnce([
      { ...loadedItems[0], configuration_status: 'needs_review' }, loadedItems[1],
    ])
    const unknown = timelineRow('unknown-zone-retry', undefined, {
      started_at: null, ended_at: null, timezone_review_required: true,
      stack_items: { archived: false, configuration_status: 'needs_review', migration_conflicts: [] },
    })
    const { client, timelineQuery } = v2Client({
      timelineResults: [
        { data: null, error: { message: 'offline' } },
        { data: [unknown], error: null },
      ],
    })

    render(
      <MemoryRouter initialEntries={['/my-stack?review=timezone&stackItem=other-1']}>
        <LocationProbe />
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('my_stack_plan_load_error'))
    expect(screen.getByTestId('location-search').textContent).toContain('review=timezone')
    fireEvent.click(screen.getByRole('button', { name: 'lab_retry' }))
    await waitFor(() => expect(timelineQuery).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getAllByLabelText('my_stack_course_timezone')).toHaveLength(1))
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toBe(''))
  })

  it('keeps both conflict choices when the timeline refresh fails after resolution', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const needsReviewItem = { ...loadedItems[0], configuration_status: 'needs_review' as const }
    const resolvedItem = { ...needsReviewItem, configuration_status: 'complete' as const }
    vi.mocked(loadStackItems)
      .mockResolvedValueOnce([needsReviewItem, loadedItems[1]])
      .mockResolvedValueOnce([resolvedItem, loadedItems[1]])
    const first = timelineRow('cycle-refresh-timeline-first')
    const kept = timelineRow('cycle-refresh-timeline-kept')
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name === 'resolve_cycle_migration_conflict') {
        return { data: { cycle_id: params.p_keep_cycle_id }, error: null }
      }
      return { data: null, error: { message: `Unexpected RPC: ${name}` } }
    })
    const { client } = v2Client({
      timelineResults: [
        { data: [first, kept], error: null },
        { data: null, error: { message: 'timeline refresh failed' } },
      ],
      rpc,
      singleRows: { 'cycle-refresh-timeline-kept': kept },
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    await openPlanFor(qaName)
    fireEvent.click(within(screen.getByTestId('plan-management-cycle-refresh-timeline-kept')).getByRole('button', {
      name: 'my_stack_plan_conflict_keep',
    }))

    await screen.findByText('my_stack_plan_conflict_error')
    expect(screen.getAllByRole('button', { name: 'my_stack_plan_conflict_keep' })).toHaveLength(2)
    expect(screen.queryByText('my_stack_plan_next_intake')).toBeNull()
  })

  it('keeps both conflict choices when the item refresh fails after resolution', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const needsReviewItem = { ...loadedItems[0], configuration_status: 'needs_review' as const }
    vi.mocked(loadStackItems)
      .mockResolvedValueOnce([needsReviewItem, loadedItems[1]])
      .mockRejectedValueOnce(new Error('item refresh failed'))
    const first = timelineRow('cycle-refresh-item-first')
    const kept = timelineRow('cycle-refresh-item-kept')
    const closed = timelineRow('cycle-refresh-item-first', first.versions, {
      ended_at: '2026-09-19T08:00:00.000Z',
    })
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name === 'resolve_cycle_migration_conflict') {
        return { data: { cycle_id: params.p_keep_cycle_id }, error: null }
      }
      return { data: null, error: { message: `Unexpected RPC: ${name}` } }
    })
    const { client } = v2Client({
      timelineResults: [
        { data: [first, kept], error: null },
        { data: [closed, kept], error: null },
      ],
      rpc,
      singleRows: { 'cycle-refresh-item-kept': kept },
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    await openPlanFor(qaName)
    fireEvent.click(within(screen.getByTestId('plan-management-cycle-refresh-item-kept')).getByRole('button', {
      name: 'my_stack_plan_conflict_keep',
    }))

    await screen.findByText('my_stack_plan_conflict_error')
    expect(screen.getAllByRole('button', { name: 'my_stack_plan_conflict_keep' })).toHaveLength(2)
    expect(screen.queryByText('my_stack_plan_next_intake')).toBeNull()
  })

  it('uses the refreshed item status after resolving inside the cycle-manager dialog', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const needsReviewItem = {
      ...loadedItems[0],
      dosage_form: 'vial' as const,
      configuration_status: 'needs_review' as const,
    }
    const resolvedItem = { ...needsReviewItem, configuration_status: 'complete' as const }
    vi.mocked(loadStackItems)
      .mockResolvedValueOnce([needsReviewItem, loadedItems[1]])
      .mockResolvedValueOnce([resolvedItem, loadedItems[1]])
    const first = timelineRow('cycle-manager-first')
    const kept = timelineRow('cycle-manager-kept')
    const closed = timelineRow('cycle-manager-first', first.versions, {
      ended_at: '2026-09-19T08:00:00.000Z',
    })
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name === 'resolve_cycle_migration_conflict') {
        return { data: { cycle_id: params.p_keep_cycle_id }, error: null }
      }
      return { data: null, error: { message: `Unexpected RPC: ${name}` } }
    })
    const { client } = v2Client({
      timelineResults: [
        { data: [first, kept], error: null },
        { data: [closed, kept], error: null },
      ],
      legacyCycles: [activeCycle],
      rpc,
      singleRows: { 'cycle-manager-kept': kept },
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    const stageButton = (await screen.findAllByRole('button', { name: qaName }))
      .find(button => button.hasAttribute('data-vial-index'))!
    fireEvent.click(stageButton)
    if (!screen.queryByRole('button', { name: 'my_stack_plan_open_overview' })) fireEvent.click(stageButton)
    fireEvent.click(await screen.findByRole('button', { name: 'my_stack_plan_open_overview' }))
    const managerChoices = await screen.findAllByRole('button', { name: 'my_stack_plan_conflict_keep' })
    expect(managerChoices).toHaveLength(2)
    fireEvent.click(within(screen.getByTestId('plan-management-cycle-manager-kept')).getByRole('button', {
      name: 'my_stack_plan_conflict_keep',
    }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'my_stack_plan_conflict_keep' })).toBeNull())
    expect(screen.getByText('my_stack_plan_next_intake')).toBeTruthy()
  })

  it('keeps safe stack content visible and retries a failed initial V2 timeline load', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const row = timelineRow('cycle-recovered')
    const { client, timelineQuery } = v2Client({
      timelineResults: [
        { data: null, error: { message: 'offline' } },
        { data: [row], error: null },
      ],
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('my_stack_plan_load_error'))
    expect(visibleCardFor(qaName)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'lab_retry' }))
    await waitFor(() => expect(timelineQuery).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).toBeNull()

    await openPlanFor(qaName)
    expect(await screen.findByTestId('plan-management-cycle-recovered')).toBeTruthy()
  })

  it('shows the stack without waiting for secondary timeline data', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const neverResolvingTimeline = new Promise<never>(() => undefined)
    const client = {
      from: vi.fn((table: string) => {
        if (table !== 'cycles') throw new Error(`Unexpected table: ${table}`)
        return {
          select: vi.fn((columns: string) => ({
            eq: vi.fn(() => columns === '*'
              ? Promise.resolve({ data: [activeCycle], error: null })
              : { order: vi.fn(() => neverResolvingTimeline) }),
          })),
        }
      }),
    }

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )

    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull(), { timeout: 500 })
  })

  it('does not duplicate initial stack queries under StrictMode', async () => {
    localStorage.setItem('tyd_peptide_view', 'list')

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/my-stack']}>
          <MyStackPage />
        </MemoryRouter>
      </StrictMode>,
    )

    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    const activeItemLoads = vi.mocked(loadStackItems).mock.calls.filter(([, archived]) => archived === false)
    expect(activeItemLoads).toHaveLength(1)
  })

  it('refreshes canonical V2 timelines after creating a new setup', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const created = timelineRow('cycle-created')
    const rpc = vi.fn(async (name: string) => {
      if (name === 'save_stack_item_with_plan') return { data: loadedItems[0], error: null }
      return { data: null, error: { message: `Unexpected RPC: ${name}` } }
    })
    const { client, timelineQuery } = v2Client({
      timelineResults: [
        { data: [], error: null },
        { data: [created], error: null },
      ],
      rpc,
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(document.querySelector('[data-my-stack-add]')).not.toBeNull())
    fireEvent.click(document.querySelector<HTMLElement>('[data-my-stack-add]')!)
    fireEvent.click(screen.getByRole('button', { name: 'save hydrated plan' }))

    await waitFor(() => expect(timelineQuery).toHaveBeenCalledTimes(2))
    await openPlanFor(qaName)
    expect(await screen.findByTestId('plan-management-cycle-created')).toBeTruthy()
  })

  it('inserts a restarted cycle as a separately identified visible timeline', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const ended = timelineRow('cycle-ended', undefined, { ended_at: '2026-09-18T08:00:00.000Z' })
    const restarted = timelineRow('cycle-restarted')
    const rpc = vi.fn(async (name: string) => {
      if (name === 'restart_cycle') return { data: { cycle_id: 'cycle-restarted' }, error: null }
      return { data: null, error: { message: `Unexpected RPC: ${name}` } }
    })
    const { client } = v2Client({
      timelineResults: [{ data: [ended], error: null }],
      rpc,
      singleRows: { 'cycle-restarted': restarted },
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    await openPlanFor(qaName)
    const endedSection = await screen.findByTestId('plan-management-cycle-ended')
    fireEvent.click(within(endedSection).getByRole('button', { name: 'my_stack_plan_restart' }))

    expect(await screen.findByTestId('plan-management-cycle-restarted')).toBeTruthy()
    expect(screen.getByTestId('plan-management-cycle-ended')).toBeTruthy()
    expect(rpc).toHaveBeenCalledWith('restart_cycle', expect.objectContaining({
      p_source_cycle_id: 'cycle-ended',
    }))
  })

  it('reuses a plan-change key and retries only refresh after the committed write', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const current = timelineRow('cycle-plan-change')
    const createCalls: Array<Record<string, unknown>> = []
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name !== 'create_plan_version') {
        return { data: null, error: { message: `Unexpected RPC: ${name}` } }
      }
      createCalls.push(params)
      if (createCalls.length === 1) return { data: null, error: { message: 'temporary write failure' } }
      return { data: normalizedVersion('version-committed', 'cycle-plan-change'), error: null }
    })
    const { client, timelineQuery } = v2Client({
      timelineResults: [
        { data: [current], error: null },
        { data: null, error: { message: 'refresh failed after commit' } },
        { data: [current], error: null },
      ],
      rpc,
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    await openPlanFor(qaName)
    const section = await screen.findByTestId('plan-management-cycle-plan-change')
    fireEvent.click(within(section).getByRole('button', { name: 'my_stack_plan_adjust_schedule' }))

    const save = screen.getByRole('button', { name: 'save version change' })
    fireEvent.click(save)
    await waitFor(() => expect(createCalls).toHaveLength(1))
    fireEvent.click(save)
    await waitFor(() => expect(timelineQuery).toHaveBeenCalledTimes(2))
    fireEvent.click(save)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'stack-item-wizard' })).toBeNull())

    expect(createCalls).toHaveLength(2)
    expect(createCalls[0].p_idempotency_key).toBe(createCalls[1].p_idempotency_key)
    expect(timelineQuery).toHaveBeenCalledTimes(3)
  })

  it('writes an edited real-wizard submission after refresh-only retrying the unchanged one', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    visibilityMocks.realWizard = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const current = timelineRow('cycle-real-wizard')
    const requestedDoses: number[] = []
    const requestedKeys: string[] = []
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name !== 'create_plan_version') {
        return { data: null, error: { message: `Unexpected RPC: ${name}` } }
      }
      requestedDoses.push((params.p_schedule as { dose: number }).dose)
      requestedKeys.push(params.p_idempotency_key as string)
      return { data: normalizedVersion(`version-${requestedDoses.length}`, 'cycle-real-wizard'), error: null }
    })
    const { client, timelineQuery } = v2Client({
      timelineResults: [
        { data: [current], error: null },
        { data: null, error: { message: 'first refresh failed' } },
        { data: null, error: { message: 'unchanged retry refresh failed' } },
        { data: [current], error: null },
      ],
      rpc,
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    await openPlanFor(qaName)
    const section = await screen.findByTestId('plan-management-cycle-real-wizard')
    fireEvent.click(within(section).getByRole('button', { name: 'my_stack_plan_adjust_schedule' }))

    const dose = screen.getByLabelText(/my_stack_plan_quantity$/)
    fireEvent.change(dose, { target: { value: '125' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(await screen.findByText('my_stack_save_error')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(timelineQuery).toHaveBeenCalledTimes(3))
    expect(requestedDoses).toEqual([125])

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    await waitFor(() => expect(screen.queryByLabelText(/my_stack_plan_quantity$/)).toBeNull())
    fireEvent.click(within(section).getByRole('button', { name: 'my_stack_plan_adjust_schedule' }))
    fireEvent.change(screen.getByLabelText(/my_stack_plan_quantity$/), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(screen.queryByLabelText(/my_stack_plan_quantity$/)).toBeNull())

    expect(requestedDoses).toEqual([125, 150])
    expect(requestedKeys[1]).not.toBe(requestedKeys[0])
    expect(timelineQuery).toHaveBeenCalledTimes(4)
  })

  it('adds a titration step behind the last one through the real wizard', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    visibilityMocks.realWizard = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const current = timelineRow('cycle-add-step')
    const calls: Record<string, unknown>[] = []
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name !== 'create_plan_version') {
        return { data: null, error: { message: `Unexpected RPC: ${name}` } }
      }
      calls.push(params)
      return { data: normalizedVersion('version-step', 'cycle-add-step'), error: null }
    })
    const { client } = v2Client({
      timelineResults: [{ data: [current], error: null }, { data: [current], error: null }],
      rpc,
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    await openPlanFor(qaName)
    const section = await screen.findByTestId('plan-management-cycle-add-step')
    fireEvent.click(within(section).getByRole('button', { name: 'my_stack_plan_add_step' }))

    // Dasselbe Formular wie „Plan anpassen", nur mit einem Tag vorbelegt.
    expect((screen.getByRole('radio', { name: 'my_stack_plan_effective_now' }) as HTMLInputElement).checked).toBe(false)
    const date = screen.getByLabelText('my_stack_plan_effective_date', { selector: 'input[type="date"]' }) as HTMLInputElement
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
    expect(date.value > today).toBe(true)
    fireEvent.change(screen.getByLabelText(/my_stack_plan_quantity$/), { target: { value: '175' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toMatchObject({
      p_cycle_id: 'cycle-add-step',
      p_effective_kind: 'local_date',
      p_effective_local_date: date.value,
      p_change_kind: 'titration',
    })
    expect((calls[0].p_schedule as { dose: number }).dose).toBe(175)
  })

  it('saves a plan change together with the confirmed planned steps', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    visibilityMocks.realWizard = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const currentVersion = normalizedVersion('version-current', 'cycle-adopt')
    const futureVersion = normalizedVersion('version-future', 'cycle-adopt', {
      change_kind: 'titration',
      effective_local_date: '2099-10-01',
      dose: 200,
    })
    const laterVersion = normalizedVersion('version-later', 'cycle-adopt', {
      change_kind: 'titration',
      effective_local_date: '2099-10-15',
      dose: 300,
    })
    const current = timelineRow('cycle-adopt', [currentVersion, futureVersion, laterVersion])
    const calls: Array<[string, Record<string, unknown>]> = []
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      calls.push([name, params])
      if (name === 'create_plan_version') return { data: normalizedVersion('version-new', 'cycle-adopt'), error: null }
      if (name === 'replace_future_plan_version') return { data: futureVersion, error: null }
      if (name === 'remove_future_plan_version') return { data: { removed: true }, error: null }
      return { data: null, error: { message: `Unexpected RPC: ${name}` } }
    })
    const { client } = v2Client({
      timelineResults: [{ data: [current], error: null }, { data: [current], error: null }],
      rpc,
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    await openPlanFor(qaName)
    const section = await screen.findByTestId('plan-management-cycle-adopt')
    fireEvent.click(within(section).getByRole('button', { name: 'my_stack_plan_adjust_schedule' }))

    fireEvent.change(screen.getByLabelText('my_stack_plan_time_short my_stack_plan_optional'), { target: { value: '21:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    // Erst die geplanten Stufen, dann speichern.
    expect(await screen.findByText('my_stack_plan_review_title')).toBeTruthy()
    expect(calls).toHaveLength(0)
    const later = document.querySelector('[data-review-step="version-later"]') as HTMLElement
    fireEvent.click(within(later).getByRole('button', { name: 'my_stack_plan_review_remove' }))

    fireEvent.click(screen.getByRole('button', { name: 'my_stack_plan_review_confirm' }))
    await waitFor(() => expect(calls).toHaveLength(3))
    expect(calls.map(([name]) => name)).toEqual(['create_plan_version', 'remove_future_plan_version', 'replace_future_plan_version'])
    expect(calls[1][1]).toMatchObject({ p_version_id: 'version-later' })
    expect(calls[2][1]).toMatchObject({
      p_version_id: 'version-future',
      p_effective_kind: 'local_date',
      p_effective_local_date: '2099-10-01',
      // Gegenueber dem neuen Plan aendert die Stufe nur die Menge.
      p_change_kind: 'titration',
    })
    expect(calls[2][1].p_schedule).toMatchObject({ intake_time_custom: '21:00', dose: 200 })
  })

  it('does not repeat a committed future removal when only canonical refresh failed', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    localStorage.setItem('tyd_peptide_view', 'list')
    const currentVersion = normalizedVersion('version-current', 'cycle-remove')
    const futureVersion = normalizedVersion('version-future', 'cycle-remove', {
      change_kind: 'schedule',
      effective_local_date: '2099-10-01',
    })
    const before = timelineRow('cycle-remove', [currentVersion, futureVersion])
    const after = timelineRow('cycle-remove', [currentVersion])
    const removeCalls: Array<Record<string, unknown>> = []
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name !== 'remove_future_plan_version') {
        return { data: null, error: { message: `Unexpected RPC: ${name}` } }
      }
      removeCalls.push(params)
      return { data: { removed: true }, error: null }
    })
    const { client, timelineQuery } = v2Client({
      timelineResults: [
        { data: [before], error: null },
        { data: null, error: { message: 'refresh failed after removal' } },
        { data: [after], error: null },
      ],
      rpc,
    })

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={client as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    await openPlanFor(qaName)
    const section = await screen.findByTestId('plan-management-cycle-remove')
    fireEvent.click(within(section).getByRole('button', { name: 'my_stack_plan_remove_future' }))
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_plan_remove_future_confirm' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_plan_remove_future_confirm' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'my_stack_plan_remove_future_title' })).toBeNull())

    expect(removeCalls).toHaveLength(1)
    expect(removeCalls[0].p_idempotency_key).toEqual(expect.any(String))
    expect(timelineQuery).toHaveBeenCalledTimes(3)
    expect(within(screen.getByTestId('plan-management-cycle-remove')).queryByRole('button', {
      name: 'my_stack_plan_remove_future',
    })).toBeNull()
  })
})

describe('Füllstandsanzeige im Karussell', () => {
  it('bindet die Prozentzeile an die Form statt an die Darreichungsform', () => {
    // Die Buehne liegt seit der Aufteilung in page/VialCarousel.tsx.
    const source = ['MyStackPage.tsx', 'page/VialCarousel.tsx', 'page/model.ts']
      .map(file => readFileSync(resolve(`src/features/my-stack/${file}`), 'utf8'))
      .join('\n')

    expect(source).toContain('hasMeaningfulFill')
    // Eine Regel fuer Karussell und Ladesilhouette (zeigtPegel in model.ts)
    expect(source).toContain("return fuellstandFuer(p) !== null || anbruchArt(p.dosage_form) === 'vial'")
    expect(source).toContain('const showsFillPct = zeigtPegel(p)')
    expect(source).toContain('isActive && showsFillPct')
    // no branching on the dosage form itself — a new form must only have to
    // declare its capabilities, not be added here as well
    expect(source).not.toMatch(/dosage_form === '/)
  })

  it('kennt die Glasformen mit aussagekräftigem Füllstand', () => {
    expect(getDosageForm('vial').stageForm?.hasMeaningfulFill).toBe(true)
    // Flaschen, die man ueber Wochen leert — mit gefuehrtem Bestand.
    for (const form of ['spray', 'nasal_spray', 'drops'] as const) {
      expect(getDosageForm(form).stageForm?.hasMeaningfulFill, form).toBe(true)
    }
    expect(getDosageForm('ampoule').stageForm?.hasMeaningfulFill).toBe(false)
  })
})
