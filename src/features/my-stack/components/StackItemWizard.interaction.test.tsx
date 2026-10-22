// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IntakePlanDraft, StackItem, StackItemSetupDraft, SubstanceCatalogEntry } from '../types'
import type { PlanChangeSubmission, WizardSaveMode } from '../lib/wizardState'
import { emptyRhythm } from '../lib/intakeRhythm'
import type { PlanRpcClient } from '../services/planLifecycle'
import { planScheduleSnapshot, savePlanChange } from '../services/stackItems'
import { StackItemWizard, type StackItemWizardProps } from './StackItemWizard'
import { SubstanceSearch } from './SubstanceSearch'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'de' } }),
}))

const vitaminD3: SubstanceCatalogEntry = {
  id: 'vitamin-d3',
  canonical_name: 'Vitamin D3',
  aliases: ['Cholecalciferol'],
  default_category: 'vitamin',
  suggested_units: ['IU'],
  suggested_dosage_forms: ['capsule'],
  pk_profile_id: null,
  active: true,
}

const vitaminK2: SubstanceCatalogEntry = {
  ...vitaminD3,
  id: 'vitamin-k2',
  canonical_name: 'Vitamin K2',
  aliases: ['Menachinon'],
}

const d3k2: SubstanceCatalogEntry = {
  ...vitaminD3,
  id: 'd3-k2',
  canonical_name: 'Vitamin D3 + K2',
  aliases: ['D3K2'],
  suggested_units: ['IU', 'mcg'],
  component_names: ['Vitamin D3', 'Vitamin K2'],
}

const existingVitaminD: StackItem = {
  id: 'stack-1',
  user_id: 'user-1',
  display_name: 'Vitamin D3',
  category: 'vitamin',
  dosage_form: 'capsule',
  brand: 'Example Brand',
  color_hex: '#abcdef',
  notes: 'With breakfast',
  configuration_status: 'complete',
  tracking_level: 'complete',
  pk_profile_method: null,
  archived: false,
  archived_at: null,
  created_at: '2026-07-21T10:00:00.000Z',
  updated_at: '2026-07-21T10:00:00.000Z',
  ingredients: [{
    id: 'ingredient-1',
    stack_item_id: 'stack-1',
    catalog_substance_id: 'vitamin-d3',
    custom_name: '',
    amount_value: 5_000,
    amount_unit: 'IU',
    basis_value: 1,
    basis_unit: 'capsule',
    position: 0,
  }],
}

const pkVitaminD3: SubstanceCatalogEntry = {
  ...vitaminD3,
  suggested_units: ['mg'],
  pk_profile_id: 'pk-vitamin-d3',
}

const existingPlan: IntakePlanDraft = {
  id: 'cycle-1',
  name: 'Vitamin D breakfast',
  unit: 'IU',
  method: 'Oral',
  rhythm: emptyRhythm(),
  startDate: '2025-01-01',
  endDate: null,
  slots: [{ routineGroup: 'morning', time: '08:30', dose: 5000, weekdays: [] }],
  reminders: ['on_time'],
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function renderWizard(overrides: Partial<StackItemWizardProps> = {}) {
  const onClose = vi.fn()
  const onOpenExisting = vi.fn()
  const onSave = vi.fn<(
    draft: StackItemSetupDraft,
    mode: WizardSaveMode,
    idempotencyKey: string,
  ) => Promise<void>>(
    async () => undefined,
  )
  const props = {
    catalogEntries: [vitaminD3, vitaminK2],
    existingItems: [],
    onClose,
    onOpenExisting,
    onSave,
    ...overrides,
  } as StackItemWizardProps
  const result = render(<StackItemWizard {...props} />)

  return { ...result, onClose, onOpenExisting, onSave }
}

/**
 * Die Route setzen, WENN sie überhaupt gefragt wird. Bei Tablette und Kapsel
 * folgt sie aus der Form und das Feld fehlt — genau das ist der Sinn.
 */
/**
 * Bis zum Planschritt weiterklicken, statt Klicks zu zaehlen. Die Schrittzahl
 * haengt an der Tracking-Tiefe und an der Form; jede Aenderung daran liess
 * sonst eine feste Zahl von `continue`-Klicks danebenliegen — und ein Klick
 * zu viel fiel nur deshalb nicht auf, weil ihn die Validierung schluckte.
 */
function advanceToPlanStep(): void {
  for (let i = 0; i < 10; i += 1) {
    if (document.querySelector('[data-field="plan.frequency"]')) return
    continueWizard()
  }
  throw new Error('Planschritt nicht erreicht')
}

/** Bis zur Zusammenfassung weiterklicken — aus demselben Grund. */
function advanceToReview(): void {
  for (let i = 0; i < 10; i += 1) {
    if (screen.queryByRole('button', { name: 'save' })) return
    continueWizard()
  }
  throw new Error('Zusammenfassung nicht erreicht; Felder: ' + [...document.querySelectorAll('[data-field]')].map(e => e.getAttribute('data-field')).join(','))
}

function setMethodIfAsked(value = 'Oral'): void {
  // Die Methode ist eine Knopfgruppe; gefragt wird sie nur, wo die Form mehrere Wege kennt.
  const gruppe = screen.queryByRole('radiogroup', { name: 'my_stack_plan_method' })
  if (!gruppe) return
  const knopf = within(gruppe).queryAllByRole('radio').find(radio => radio.textContent?.toLowerCase().includes(value.toLowerCase().slice(0, 4)))
  fireEvent.click(knopf ?? within(gruppe).getAllByRole('radio')[0])
}

function continueWizard(): void {
  fireEvent.click(screen.getByRole('button', { name: 'continue' }))
}

/** Name und Kategorie — Form und Farbe stehen danach auf derselben Seite. */
function startCustom(name: string): void {
  fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('my_stack_category'), { target: { value: 'supplement' } })
}

/** Eine Form im Karussell der Substanzseite; „Andere Form" klappt die uebrigen auf. */
function waehleForm(form: string): void {
  const karte = screen.queryByRole('radio', { name: `dosage_form_${form}` })
  if (!karte) fireEvent.click(screen.getByRole('button', { name: 'my_stack_form_more' }))
  fireEvent.click(screen.getByRole('radio', { name: `dosage_form_${form}` }))
}

function completeCustomFlow(name = 'Custom Product'): void {
  startCustom(name)
  waehleForm('capsule')
  continueWizard()
  continueWizard()
  fireEvent.change(screen.getByLabelText('my_stack_strength_value'), { target: { value: '100' } })
  fireEvent.change(screen.getByLabelText('my_stack_strength_unit'), { target: { value: 'mg' } })
  fireEvent.change(screen.getByLabelText('my_stack_basis_value'), { target: { value: '1' } })
  continueWizard()
  setMethodIfAsked()
  fireEvent.change(screen.getByLabelText(/my_stack_plan_quantity$/), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('my_stack_plan_unit'), { target: { value: 'capsule' } })
  advanceToReview()
}

describe('StackItemWizard — Substanzseite mit Form und Farbe', () => {
  it('zeigt die Formen erst, wenn feststeht, was es ist, und die Farbe erst nach der Form', () => {
    renderWizard()
    fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'Kreatin' } })
    expect(document.querySelector('[data-form-carousel]')).toBeNull()

    fireEvent.change(screen.getByLabelText('my_stack_category'), { target: { value: 'supplement' } })
    expect(document.querySelector('[data-form-carousel]')).not.toBeNull()
    expect(document.querySelector('[data-form-color]')).toBeNull()

    waehleForm('powder')
    const farbe = document.querySelector('[data-form-color]')!
    expect(farbe.querySelectorAll('[data-swatch]').length).toBe(13)
    expect(farbe.querySelector('input[type="text"]')).toBeNull()

    // Die gewaehlte Karte im Karussell faerbt sich mit.
    const deckel = () => document.querySelector('[data-form-option="powder"] [data-powder-detail="lid"]')?.getAttribute('fill')
    fireEvent.click(farbe.querySelector('[data-swatch="#0a84ff"]')!)
    expect(farbe.querySelector('[data-swatch="#0a84ff"]')!.getAttribute('aria-checked')).toBe('true')
    expect(deckel()).toBe('#0a84ff')

    // „Eigene Farbe": die Flaeche erscheint, die Pfeiltasten faerben.
    fireEvent.click(farbe.querySelector('[data-swatch="custom"]')!)
    expect(document.querySelector('[data-form-color] [data-color-field="area"]')).not.toBeNull()
    fireEvent.keyDown(document.querySelector('[data-form-color] [data-color-field="hue"]') as HTMLElement, { key: 'ArrowRight' })
    expect(deckel()).not.toBe('#0a84ff')
    expect(deckel()).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('waehlt die einzige Form, die der Katalog kennt, und bietet die uebrigen an', () => {
    renderWizard()
    fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'Vitamin' } })
    fireEvent.click(screen.getByRole('option', { name: /Vitamin D3/ }))

    expect(screen.getByRole('radio', { name: 'dosage_form_capsule' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByRole('radio', { name: 'dosage_form_drops' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_form_more' }))
    expect(screen.getByRole('radio', { name: 'dosage_form_drops' })).toBeTruthy()
  })

  it('geht ohne Form nicht weiter und sagt es am Karussell', () => {
    renderWizard()
    startCustom('Kreatin')
    continueWizard()
    expect(screen.getByLabelText('my_stack_question')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('my_stack_dosage_form_required')
  })

  it('zeigt die Vorschauzeile erst ab der Zusammensetzung und nicht beim Zurueckgehen', () => {
    renderWizard()
    startCustom('Kreatin Monohydrat')
    waehleForm('powder')
    expect(document.querySelector('[data-wizard-preview]')).toBeNull()

    continueWizard()
    const vorschau = document.querySelector('[data-wizard-preview-compact]')
    expect(vorschau).not.toBeNull()
    expect(vorschau!.textContent).toContain('Kreatin Monohydrat')
    expect(vorschau!.querySelector('[data-stack-renderer="powder"]')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(screen.getByLabelText('my_stack_question')).toBeTruthy()
    expect(document.querySelector('[data-wizard-preview]')).toBeNull()
  })

  it('zeigt fuer Formen ohne Buehnengrafik keine Vorschau und keine Farbe', () => {
    renderWizard()
    startCustom('Saft')
    waehleForm('other')
    expect(document.querySelector('[data-form-color]')).toBeNull()
    continueWizard()
    expect(document.querySelector('[data-wizard-preview]')).toBeNull()
  })

  it('hat vier Seiten fuer eine Katalogsubstanz', () => {
    renderWizard()
    fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'Vitamin' } })
    fireEvent.click(screen.getByRole('option', { name: /Vitamin D3/ }))
    expect(document.querySelector('[role="progressbar"]')!.getAttribute('aria-valuemax')).toBe('4')
  })
})

describe('StackItemWizard — Zusammensetzung', () => {
  function zurZusammensetzung(): void {
    fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'Vitamin' } })
    fireEvent.click(screen.getByRole('option', { name: /Vitamin D3/ }))
    continueWizard()
  }

  it('laesst die Staerke ueberspringen und zuruecknehmen', () => {
    renderWizard()
    zurZusammensetzung()
    expect(screen.getByLabelText('my_stack_strength_value')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'my_stack_strength_skip' }))
    expect(document.querySelector('[data-strength-skipped]')).not.toBeNull()
    expect(screen.queryByLabelText('my_stack_strength_value')).toBeNull()
    // Ohne Staerke geht es trotzdem weiter.
    continueWizard()
    expect(document.querySelector('[data-field="plan.frequency"]')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_strength_unskip' }))
    expect(screen.getByLabelText('my_stack_strength_value')).toBeTruthy()
  })

  it('fragt bei der Kapsel nur das Ablaufdatum, beim Pulver-Vial nach dem Anmischen', () => {
    renderWizard()
    zurZusammensetzung()
    expect(document.querySelector('[data-haltbarkeit]')!.getAttribute('data-haltbarkeit')).toBe('ablauf')
    expect(document.querySelector('[data-haltbarkeit] [data-field="inventory.openedAt"]')).toBeNull()
    expect(document.querySelector('[data-haltbarkeit] [data-field="inventory.expiresAt"]')).not.toBeNull()
    cleanup()

    renderWizard()
    fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'BPC' } })
    fireEvent.change(screen.getByLabelText('my_stack_category'), { target: { value: 'peptide' } })
    waehleForm('vial')
    advanceTo('[data-haltbarkeit]')
    expect(document.querySelector('[data-haltbarkeit]')!.getAttribute('data-haltbarkeit')).toBe('angemischt')
    expect(screen.getByLabelText(/my_stack_shelf_opened_angemischt/)).toBeTruthy()
  })

  it('rechnet aus Anbruch und Haltbarkeit das Aufbrauchen-bis-Datum', () => {
    renderWizard()
    startCustom('Testo')
    waehleForm('vial')
    advanceTo('[data-haltbarkeit]')
    expect(document.querySelector('[data-haltbarkeit]')!.getAttribute('data-haltbarkeit')).toBe('angebrochen')
    fireEvent.change(document.querySelector('[data-field="inventory.openedAt"]')!, { target: { value: '2026-10-20' } })
    fireEvent.change(document.querySelector('[data-field="inventory.useWithinDays"]')!, { target: { value: '28' } })
    expect(document.querySelector('[data-haltbarkeit-bis]')!.textContent).toContain('17.11.2026')
  })
})

/** Weiterklicken, bis ein Element da ist. */
function advanceTo(selektor: string): void {
  for (let i = 0; i < 10; i += 1) {
    if (document.querySelector(selektor)) return
    continueWizard()
  }
  throw new Error(`${selektor} nicht erreicht`)
}

function completeCatalogFlow(): void {
  fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'Vitamin' } })
  fireEvent.click(screen.getByRole('option', { name: /Vitamin D3/ }))
  // Der Katalog kennt fuer D3 nur die Kapsel — sie ist schon gewaehlt.
  continueWizard()
  fireEvent.change(screen.getByLabelText('my_stack_strength_value'), { target: { value: '5000' } })
  fireEvent.change(screen.getByLabelText('my_stack_basis_value'), { target: { value: '1' } })
  advanceToPlanStep()
  setMethodIfAsked()
  fireEvent.change(screen.getByLabelText(/my_stack_plan_quantity$/), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('my_stack_plan_unit'), { target: { value: 'capsule' } })
  advanceToReview()
}

function reachExistingReview(changeForm = false): void {
  if (changeForm) waehleForm('drops')
  advanceToPlanStep()
  setMethodIfAsked()
  fireEvent.change(screen.getByLabelText(/my_stack_plan_quantity$/), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('my_stack_plan_unit'), { target: { value: changeForm ? 'ml' : 'capsule' } })
  advanceToReview()
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => (
    window.setTimeout(() => callback(performance.now()), 0)
  ))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('StackItemWizard interactions', () => {
  it('routes a current-plan dose change to a new instant version without creating a cycle', async () => {
    const rpc = vi.fn(async (_name: string, _params: Record<string, unknown>) => ({
      data: [{ id: 'new-version' }],
      error: null,
    }))
    const client = { rpc, from: vi.fn() } as unknown as PlanRpcClient
    const onSave = vi.fn(async () => undefined)
    const onSavePlanChange = vi.fn(async (submission: PlanChangeSubmission) => {
      await savePlanChange(
        client,
        submission.target,
        submission.snapshot,
        submission.effective,
        {
          changeKind: submission.changeKind,
          idempotencyKey: 'current-dose-change',
          timeZone: submission.timeZone,
        },
      )
    })

    renderWizard({
      existingItem: existingVitaminD,
      intent: 'plan',
      planEditContext: {
        target: { cycleId: 'cycle-1', versionId: null, mode: 'new_change' },
        snapshot: existingPlan,
        changeKind: 'dose',
        timeZone: 'Europe/Berlin',
      },
      onSave,
      onSavePlanChange,
    } as Partial<StackItemWizardProps>)

    expect((screen.getByRole('radio', {
      name: 'my_stack_plan_effective_now',
    }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('radio', { name: 'my_stack_plan_effective_date' })).toBeTruthy()
    expect(screen.queryByLabelText('my_stack_plan_start_date')).toBeNull()
    expect(screen.queryByLabelText('my_stack_plan_end_date')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'reminder_on_time' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'my_stack_pk_method_confirm' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'my_stack_plan_effective_date' }))
    expect((screen.getByLabelText('my_stack_plan_effective_date', { selector: 'input[type="date"]' }) as HTMLInputElement).min).not.toBe('')
    fireEvent.click(screen.getByRole('radio', { name: 'my_stack_plan_effective_now' }))
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    expect(rpc.mock.calls[0][0]).toBe('create_plan_version')
    expect(rpc.mock.calls[0][1]).toEqual({
      p_cycle_id: 'cycle-1',
      p_effective_kind: 'instant',
      p_effective_at: expect.any(String),
      p_effective_local_date: null,
      p_change_kind: 'dose',
      p_schedule: {
        _timezone: 'Europe/Berlin',
        _effective_now: true,
        frequency: 'Täglich',
        x_days_interval: null,
        interval_unit: null,
        cycle_on_days: null,
        cycle_off_days: null,
        schedule_days: [],
        intake_time: 'morgens',
        intake_time_custom: '08:30',
        slot_doses: null,
        slot_days: null,
        dose: 5000,
        unit: 'IU',
        method: 'Oral',
      },
      p_idempotency_key: 'current-dose-change',
    })
    expect(onSave).not.toHaveBeenCalled()
    expect(rpc.mock.calls.some(([name]) => name === 'save_stack_item_with_plan')).toBe(false)
  })

  it('routes the selected future snapshot to replacement with its exact version id and date', async () => {
    const futurePlan: IntakePlanDraft = {
      ...existingPlan,
      startDate: '2099-10-01',
      slots: [{ ...existingPlan.slots[0], dose: 7000 }],
    }
    const rpc = vi.fn(async (_name: string, _params: Record<string, unknown>) => ({
      data: [{ id: 'future-version-2' }],
      error: null,
    }))
    const client = { rpc, from: vi.fn() } as unknown as PlanRpcClient
    const onSavePlanChange = vi.fn(async (submission: PlanChangeSubmission) => {
      await savePlanChange(
        client,
        submission.target,
        submission.snapshot,
        submission.effective,
        {
          changeKind: submission.changeKind,
          idempotencyKey: 'future-change',
          timeZone: submission.timeZone,
        },
      )
    })

    renderWizard({
      existingItem: existingVitaminD,
      intent: 'plan',
      planEditContext: {
        target: {
          cycleId: 'cycle-1',
          versionId: 'future-version-2',
          mode: 'replace_future',
        },
        snapshot: futurePlan,
        changeKind: 'schedule',
        timeZone: 'Europe/Berlin',
      },
      onSavePlanChange,
    } as Partial<StackItemWizardProps>)

    expect(screen.queryByRole('radio', { name: 'my_stack_plan_effective_now' })).toBeNull()
    const boundaryDate = screen.getByLabelText('my_stack_plan_effective_date') as HTMLInputElement
    expect(boundaryDate.value).toBe('2099-10-01')
    expect(boundaryDate.min).not.toBe('')
    expect(boundaryDate.value >= boundaryDate.min).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    expect(rpc).toHaveBeenCalledWith('replace_future_plan_version', {
      p_version_id: 'future-version-2',
      p_effective_kind: 'local_date',
      p_effective_at: null,
      p_effective_local_date: '2099-10-01',
      p_change_kind: 'schedule',
      p_schedule: {
        frequency: 'Täglich',
        x_days_interval: null,
        interval_unit: null,
        cycle_on_days: null,
        cycle_off_days: null,
        schedule_days: [],
        intake_time: 'morgens',
        intake_time_custom: '08:30',
        slot_doses: null,
        slot_days: null,
        dose: 7000,
        unit: 'IU',
        method: 'Oral',
      },
      p_timezone: 'Europe/Berlin',
      p_idempotency_key: 'future-change',
    })
  })

  it('adds a step in the same form as a plan change, preset to a day, dose-only as titration', async () => {
    const onSavePlanChange = vi.fn(async (_submission: PlanChangeSubmission) => undefined)
    renderWizard({
      existingItem: existingVitaminD,
      intent: 'plan',
      planEditContext: {
        target: { cycleId: 'cycle-1', versionId: null, mode: 'new_change' },
        snapshot: existingPlan,
        changeKind: 'titration',
        purpose: 'add_step',
        timeZone: 'Europe/Berlin',
        initialEffective: { kind: 'date', localDate: '2099-10-08' },
        minEffectiveDate: '2099-10-02',
      },
      onSavePlanChange,
    } as Partial<StackItemWizardProps>)

    expect(screen.getByRole('heading', { name: 'my_stack_plan_add_step' })).toBeTruthy()
    // Eine Dosisstufe ist nur Plan: Produkt, Marke und Notizen gehoeren zur Substanz.
    expect(screen.queryByLabelText('my_stack_notes_optional')).toBeNull()
    expect(screen.queryByRole('button', { name: /my_stack_product/ })).toBeNull()
    expect((screen.getByRole('radio', { name: 'my_stack_plan_effective_now' }) as HTMLInputElement).checked).toBe(false)
    const boundaryDate = screen.getByLabelText('my_stack_plan_effective_date', { selector: 'input[type="date"]' }) as HTMLInputElement
    expect(boundaryDate.value).toBe('2099-10-08')
    expect(boundaryDate.min).toBe('2099-10-02')

    fireEvent.change(boundaryDate, { target: { value: '2099-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(await screen.findByText('my_stack_plan_effective_too_early')).toBeTruthy()
    expect(onSavePlanChange).not.toHaveBeenCalled()

    fireEvent.change(boundaryDate, { target: { value: '2099-10-02' } })
    fireEvent.change(screen.getByLabelText(/my_stack_plan_quantity$/), { target: { value: '10000' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSavePlanChange).toHaveBeenCalledTimes(1))
    expect(onSavePlanChange.mock.calls[0][0]).toMatchObject({
      target: { cycleId: 'cycle-1', versionId: null, mode: 'new_change' },
      effective: { kind: 'date', localDate: '2099-10-02' },
      changeKind: 'titration',
      snapshot: { dose: 10000, intake_time_custom: '08:30' },
    })
  })

  it.each([
    ['a day that already has a step', '2099-10-05', 'my_stack_plan_effective_taken'],
    ['a day after the cycle ends', '2099-10-20', 'my_stack_plan_effective_too_late'],
    ['no day at all', '', 'my_stack_plan_effective_required'],
  ])('refuses %s before saving', async (_label, day, message) => {
    const onSavePlanChange = vi.fn(async (_submission: PlanChangeSubmission) => undefined)
    renderWizard({
      existingItem: existingVitaminD,
      intent: 'plan',
      planEditContext: {
        target: { cycleId: 'cycle-1', versionId: null, mode: 'new_change' },
        snapshot: existingPlan,
        changeKind: 'dose',
        purpose: 'adjust',
        timeZone: 'Europe/Berlin',
        takenEffectiveDates: ['2099-10-05'],
        maxEffectiveDate: '2099-10-15',
      },
      onSavePlanChange,
    } as Partial<StackItemWizardProps>)

    fireEvent.click(screen.getByRole('radio', { name: 'my_stack_plan_effective_date' }))
    const boundaryDate = screen.getByLabelText('my_stack_plan_effective_date', { selector: 'input[type="date"]' }) as HTMLInputElement
    // Vorbelegt mit dem fruehesten erlaubten Tag, nicht mit dem Zyklusbeginn.
    expect(boundaryDate.value).toBe(boundaryDate.min)
    expect(boundaryDate.max).toBe('2099-10-15')
    fireEvent.change(boundaryDate, { target: { value: day } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(await screen.findByText(message)).toBeTruthy()
    expect(onSavePlanChange).not.toHaveBeenCalled()
  })

  it('measures an edited future step against the step before it', async () => {
    const onSavePlanChange = vi.fn(async (_submission: PlanChangeSubmission) => undefined)
    const previous: IntakePlanDraft = existingPlan
    const future: IntakePlanDraft = {
      ...existingPlan,
      startDate: '2099-10-01',
      slots: [{ ...existingPlan.slots[0], time: '09:30', dose: 7000 }],
    }
    renderWizard({
      existingItem: existingVitaminD,
      intent: 'plan',
      planEditContext: {
        target: { cycleId: 'cycle-1', versionId: 'future-1', mode: 'replace_future' },
        snapshot: future,
        baseline: previous,
        changeKind: 'dose',
        purpose: 'edit_future',
        timeZone: 'Europe/Berlin',
        initialEffective: { kind: 'date', localDate: '2099-10-01' },
      },
      onSavePlanChange,
    } as Partial<StackItemWizardProps>)

    // Uhrzeit zurueck auf die der Stufe davor: uebrig bleibt eine reine Dosisaenderung.
    fireEvent.change(screen.getByLabelText('my_stack_plan_time_short my_stack_plan_optional'), { target: { value: '08:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSavePlanChange).toHaveBeenCalledTimes(1))
    expect(onSavePlanChange.mock.calls[0][0]).toMatchObject({
      changeKind: 'dose',
      snapshot: { dose: 7000, intake_time_custom: '08:30' },
    })
  })

  function laterStep(versionId: string, date: string, plan: IntakePlanDraft) {
    return {
      versionId,
      effectiveLocalDate: date,
      changeKind: 'titration' as const,
      snapshot: planScheduleSnapshot(plan, existingVitaminD.tracking_level),
      draft: plan,
    }
  }
  const withDose = (dose: number): IntakePlanDraft => ({ ...existingPlan, slots: [{ ...existingPlan.slots[0], dose }] })

  it('shows the planned steps with the new plan before saving and saves them as confirmed', async () => {
    const onSavePlanChange = vi.fn(async (_submission: PlanChangeSubmission) => undefined)
    renderWizard({
      existingItem: existingVitaminD,
      intent: 'plan',
      planEditContext: {
        target: { cycleId: 'cycle-1', versionId: null, mode: 'new_change' },
        snapshot: existingPlan,
        changeKind: 'dose',
        purpose: 'adjust',
        timeZone: 'Europe/Berlin',
        laterSteps: [laterStep('future-1', '2099-10-08', withDose(7000))],
      },
      onSavePlanChange,
    } as Partial<StackItemWizardProps>)

    // Tageszeiten offen, Tage und Methode zugeklappt dahinter.
    const summary = document.querySelector('[data-plan-schedule-summary]')!
    const time = screen.getByLabelText('my_stack_plan_time_short my_stack_plan_optional')
    expect(summary).toBeTruthy()
    expect(time.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Gesagt wird, was der Tag bedeutet: die jetzige Stufe endet, dahinter ist schon etwas geplant.
    expect(screen.getByText('my_stack_plan_note_current_ends')).toBeTruthy()
    expect(screen.getByText('my_stack_plan_note_planned_one')).toBeTruthy()

    fireEvent.change(time, { target: { value: '09:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(await screen.findByText('my_stack_plan_review_title')).toBeTruthy()
    expect(onSavePlanChange).not.toHaveBeenCalled()

    // Die Stufe steht mit dem neuen Plan da, ihre Menge zum Anpassen.
    const card = document.querySelector('[data-review-step="future-1"]') as HTMLElement
    expect(within(card).getByText('my_stack_plan_review_takes_plan')).toBeTruthy()
    const amount = within(card).getByRole('textbox') as HTMLInputElement
    expect(amount.value).toBe('7000')
    fireEvent.change(amount, { target: { value: '8000' } })

    fireEvent.click(screen.getByRole('button', { name: 'my_stack_plan_review_confirm' }))
    await waitFor(() => expect(onSavePlanChange).toHaveBeenCalledTimes(1))
    expect(onSavePlanChange.mock.calls[0][0]).toMatchObject({
      changeKind: 'schedule',
      snapshot: { intake_time_custom: '09:00', dose: 5000 },
      laterChanges: [{
        kind: 'replace',
        versionId: 'future-1',
        effectiveLocalDate: '2099-10-08',
        changeKind: 'titration',
        schedule: { intake_time_custom: '09:00', dose: 8000 },
      }],
    })
  })

  it('lets a planned step be moved or removed, and refuses a day another step still starts on', async () => {
    const onSavePlanChange = vi.fn(async (_submission: PlanChangeSubmission) => undefined)
    renderWizard({
      existingItem: existingVitaminD,
      intent: 'plan',
      planEditContext: {
        target: { cycleId: 'cycle-1', versionId: null, mode: 'new_change' },
        snapshot: existingPlan,
        changeKind: 'dose',
        purpose: 'adjust',
        timeZone: 'Europe/Berlin',
        laterSteps: [laterStep('f1', '2099-10-08', withDose(7000)), laterStep('f2', '2099-10-15', withDose(9000))],
      },
      onSavePlanChange,
    } as Partial<StackItemWizardProps>)

    expect(screen.getByText('my_stack_plan_note_planned_many')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/my_stack_plan_quantity$/), { target: { value: '6000' } })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    await screen.findByText('my_stack_plan_review_title')

    const second = document.querySelector('[data-review-step="f2"]') as HTMLElement
    fireEvent.change(within(second).getByLabelText('my_stack_plan_review_starts'), { target: { value: '2099-10-08' } })
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_plan_review_confirm' }))
    expect(await within(second).findByText('my_stack_plan_effective_taken')).toBeTruthy()
    expect(onSavePlanChange).not.toHaveBeenCalled()

    // Wird die erste entfernt, ist ihr Tag frei.
    const first = document.querySelector('[data-review-step="f1"]') as HTMLElement
    fireEvent.click(within(first).getByRole('button', { name: 'my_stack_plan_review_remove' }))
    expect(within(first).getByText('my_stack_plan_review_removed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_plan_review_confirm' }))

    await waitFor(() => expect(onSavePlanChange).toHaveBeenCalledTimes(1))
    const submission = onSavePlanChange.mock.calls[0][0]
    expect(submission.changeKind).toBe('dose')
    expect(submission.laterChanges).toEqual([
      { kind: 'remove', versionId: 'f1' },
      expect.objectContaining({ kind: 'replace', versionId: 'f2', effectiveLocalDate: '2099-10-08' }),
    ])
  })

  it('goes back from the planned steps to the form without saving and keeps what was done there', async () => {
    const onSavePlanChange = vi.fn(async (_submission: PlanChangeSubmission) => undefined)
    renderWizard({
      existingItem: existingVitaminD,
      intent: 'plan',
      planEditContext: {
        target: { cycleId: 'cycle-1', versionId: null, mode: 'new_change' },
        snapshot: existingPlan,
        changeKind: 'dose',
        purpose: 'adjust',
        timeZone: 'Europe/Berlin',
        laterSteps: [laterStep('f1', '2099-10-08', withDose(7000))],
      },
      onSavePlanChange,
    } as Partial<StackItemWizardProps>)

    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    await screen.findByText('my_stack_plan_review_title')
    fireEvent.click(within(document.querySelector('[data-review-step="f1"]') as HTMLElement).getByRole('button', { name: 'my_stack_plan_review_remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(screen.queryByText('my_stack_plan_review_title')).toBeNull()
    expect(screen.getByLabelText(/my_stack_plan_quantity$/)).toBeTruthy()
    expect(onSavePlanChange).not.toHaveBeenCalled()

    // Wieder vor: was man dort getan hat, ist noch da.
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    await screen.findByText('my_stack_plan_review_title')
    expect(within(document.querySelector('[data-review-step="f1"]') as HTMLElement).getByText('my_stack_plan_review_removed')).toBeTruthy()
  })

  it('prefills a new step with the plan in force on the chosen day until the plan is touched', () => {
    renderWizard({
      existingItem: existingVitaminD,
      intent: 'plan',
      planEditContext: {
        target: { cycleId: 'cycle-1', versionId: null, mode: 'new_change' },
        snapshot: withDose(9000),
        current: existingPlan,
        changeKind: 'titration',
        purpose: 'add_step',
        timeZone: 'Europe/Berlin',
        initialEffective: { kind: 'date', localDate: '2099-10-15' },
        laterSteps: [laterStep('last', '2099-10-08', withDose(9000))],
      },
      onSavePlanChange: vi.fn(),
    } as Partial<StackItemWizardProps>)

    const quantity = () => screen.getByLabelText(/my_stack_plan_quantity$/) as HTMLInputElement
    expect(quantity().value).toBe('9000')
    expect(screen.getByText('my_stack_plan_note_inside_planned')).toBeTruthy()

    // Ab sofort gilt die jetzige Menge — und die geplante Stufe liegt dahinter.
    fireEvent.click(screen.getByRole('radio', { name: 'my_stack_plan_effective_now' }))
    expect(quantity().value).toBe('5000')
    expect(screen.getByText('my_stack_plan_note_current_ends')).toBeTruthy()
    expect(screen.getByText('my_stack_plan_note_planned_one')).toBeTruthy()

    // Einmal selbst geaendert, bleibt die Eingabe.
    fireEvent.change(quantity(), { target: { value: '6000' } })
    fireEvent.click(screen.getByRole('radio', { name: 'my_stack_plan_effective_date' }))
    expect(quantity().value).toBe('6000')
  })

  it('reuses the same setup key after a visible save failure', async () => {
    const onSave = vi.fn()
      .mockRejectedValueOnce(new Error('RPC failed'))
      .mockResolvedValueOnce(undefined)
    renderWizard({ onSave })
    completeCustomFlow('Stable Retry Product')

    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(await screen.findByText('my_stack_save_error')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[0][2]).toEqual(expect.any(String))
    expect(onSave.mock.calls[1][2]).toBe(onSave.mock.calls[0][2])
  })

  it('uses the first profile-bearing ingredient by position for PK confirmation and save', async () => {
    const pkItem: StackItem = {
      ...existingVitaminD,
      pk_profile_method: null,
      ingredients: [{
        ...existingVitaminD.ingredients[0],
        id: 'ingredient-k2',
        catalog_substance_id: vitaminK2.id,
        position: 0,
      }, {
        ...existingVitaminD.ingredients[0],
        id: 'ingredient-d3',
        catalog_substance_id: pkVitaminD3.id,
        position: 1,
      }],
    }
    const pkPlan: IntakePlanDraft = {
      ...existingPlan,
      unit: 'mg',
      slots: [{ routineGroup: 'morning', time: '08:30', dose: 1, weekdays: [] }],
    }
    const { onSave } = renderWizard({
      catalogEntries: [vitaminK2, pkVitaminD3],
      existingItem: pkItem,
      existingPlan: pkPlan,
      intent: 'pk',
    })

    const confirmation = screen.getByRole('checkbox', { name: 'my_stack_pk_method_confirm' })
    fireEvent.click(confirmation)
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].pkProfileMethod).toBe('Oral')
  })

  it('zeigt mit intent="plan" nur den Einnahmeplan', () => {
    // „Plan ändern" führt jetzt durch den Assistenten statt durch ein eigenes
    // Zyklusformular — dort schrieb es am RPC vorbei. Wer nur den Plan
    // ändert, soll aber nicht durch Substanz, Form und Farbe geführt werden.
    renderWizard({
      existingItem: existingVitaminD,
      existingPlan,
      intent: 'plan',
    })

    expect(document.querySelector('[data-plan-summary]')).not.toBeNull()
    expect(screen.queryByText('my_stack_step_substance')).toBeNull()
    expect(screen.queryByText('my_stack_step_dosage_form')).toBeNull()
    expect(screen.queryByText('my_stack_step_color')).toBeNull()
  })

  it('includes missing complete-strength fields in a PK upgrade flow', () => {
    const pkItem: StackItem = {
      ...existingVitaminD,
      tracking_level: 'with_amount',
      pk_profile_method: null,
      ingredients: existingVitaminD.ingredients.map(ingredient => ({
        ...ingredient,
        amount_value: null,
        amount_unit: null,
        basis_value: null,
        basis_unit: null,
      })),
    }
    const pkPlan: IntakePlanDraft = {
      ...existingPlan,
      unit: 'mg',
      slots: [{ routineGroup: 'morning', time: null, dose: 1, weekdays: [] }],
    }
    renderWizard({
      catalogEntries: [pkVitaminD3],
      existingItem: pkItem,
      existingPlan: pkPlan,
      intent: 'pk',
    })

    // „PK vervollstaendigen" startet gruendlich auf der Zusammensetzung.
    expect(screen.getByLabelText('my_stack_strength_value')).toBeTruthy()
    expect(screen.queryByLabelText('my_stack_question')).toBeNull()
  })

  it('shows only the missing complete-tracking step for a PK edit intent', async () => {
    const pkItem: StackItem = {
      ...existingVitaminD,
      tracking_level: 'with_amount',
      pk_profile_method: 'Oral',
    }
    const pkPlan: IntakePlanDraft = {
      ...existingPlan,
      unit: 'mg',
      slots: [{ routineGroup: 'morning', time: '08:30', dose: 1, weekdays: [] }],
    }
    const { onSave } = renderWizard({
      catalogEntries: [pkVitaminD3],
      existingItem: pkItem,
      existingPlan: pkPlan,
      intent: 'pk',
    })

    expect(screen.getByLabelText('my_stack_strength_value')).toBeTruthy()
    expect(screen.queryByLabelText('my_stack_question')).toBeNull()
    expect(document.querySelector('[data-rhythm-kind="daily"]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).toMatchObject({
      trackingLevel: 'complete',
      pkProfileMethod: 'Oral',
      plan: { unit: 'mg', slots: [{ routineGroup: 'morning', time: '08:30', dose: 1, weekdays: [] }] },
    })
  })

  it('opens on the missing PK plan fields and requires explicit method confirmation', async () => {
    const pkItem: StackItem = {
      ...existingVitaminD,
      pk_profile_method: null,
    }
    const pkPlan: IntakePlanDraft = {
      ...existingPlan,
      unit: 'mg',
      slots: [{ routineGroup: 'morning', time: null, dose: 1, weekdays: [] }],
    }
    const { onSave } = renderWizard({
      catalogEntries: [pkVitaminD3],
      existingItem: pkItem,
      existingPlan: pkPlan,
      intent: 'pk',
    })

    expect(document.querySelector('[data-rhythm-kind="daily"]')).not.toBeNull()
    expect(screen.queryByRole('group', { name: 'my_stack_tracking_question' })).toBeNull()
    fireEvent.change(screen.getByLabelText('my_stack_plan_time_short my_stack_plan_optional'), { target: { value: '08:30' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'my_stack_pk_method_confirm' }))
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).toMatchObject({
      pkProfileMethod: 'Oral',
      plan: { method: 'Oral', unit: 'mg', slots: [{ routineGroup: 'morning', time: '08:30', dose: 1, weekdays: [] }] },
    })
  })

  it('verknuepft das Profil ohne Haekchen, wenn es fuer die Route im Plan gilt', async () => {
    const pkItem: StackItem = { ...existingVitaminD, pk_profile_method: null }
    const pkPlan: IntakePlanDraft = {
      ...existingPlan,
      unit: 'mg',
      slots: [{ routineGroup: 'morning', time: '08:30', dose: 1, weekdays: [] }],
    }
    const { onSave } = renderWizard({
      catalogEntries: [{ ...pkVitaminD3, pk_profiles: { routes: ['Oral'] } }],
      existingItem: pkItem,
      existingPlan: pkPlan,
      intent: 'pk',
    })

    expect(screen.queryByRole('checkbox', { name: 'my_stack_pk_method_confirm' })).toBeNull()
    expect(document.querySelector('[data-pk-route="covered"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    // Die Deckung durch das Profil wird nicht als Bestaetigung gespeichert.
    expect(onSave.mock.calls[0][0].pkProfileMethod).toBeNull()
  })

  it('sagt es, wenn das Profil nicht fuer die Route im Plan gilt, und speichert nicht', async () => {
    const pkItem: StackItem = { ...existingVitaminD, pk_profile_method: null }
    const pkPlan: IntakePlanDraft = {
      ...existingPlan,
      unit: 'mg',
      slots: [{ routineGroup: 'morning', time: '08:30', dose: 1, weekdays: [] }],
    }
    const { onSave } = renderWizard({
      catalogEntries: [{ ...pkVitaminD3, pk_profiles: { routes: ['Subkutan'] } }],
      existingItem: pkItem,
      existingPlan: pkPlan,
      intent: 'pk',
    })

    expect(screen.queryByRole('checkbox', { name: 'my_stack_pk_method_confirm' })).toBeNull()
    expect(document.querySelector('[data-pk-route="mismatch"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(await screen.findByText('my_stack_pk_route_mismatch_save')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('preserves raw multi-word typing and a chosen custom category', () => {
    renderWizard()
    const input = screen.getByLabelText('my_stack_question') as HTMLInputElement
    const category = screen.getByLabelText('my_stack_category') as HTMLSelectElement

    fireEvent.change(input, { target: { value: 'Vitamin' } })
    fireEvent.change(category, { target: { value: 'supplement' } })
    fireEvent.change(input, { target: { value: 'Vitamin ' } })

    expect(input.value).toBe('Vitamin ')
    expect(category.value).toBe('supplement')

    fireEvent.change(input, { target: { value: 'Vitamin D' } })
    expect(input.value).toBe('Vitamin D')
    expect(category.value).toBe('supplement')
  })

  it('bietet „Sonstiges" als letzte Kategorie an und laesst weitergehen', () => {
    // Der Katalog hat 182 Eintraege und deckt trotzdem nicht alles ab. Wer
    // seine Substanz frei eintraegt, musste sie bisher in eines von fuenf
    // Faechern zwingen — und jede dieser Wahlen ist eine Behauptung, die die
    // App spaeter auswertet. „Sonstiges" ist die ehrliche Antwort darauf.
    renderWizard()
    const kategorie = screen.getByLabelText('my_stack_category') as HTMLSelectElement

    const werte = Array.from(kategorie.options).map(option => option.value)
    expect(werte).toEqual(['', 'peptide', 'medication', 'hormone', 'supplement', 'vitamin', 'other'])

    fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'Rotlichtlampe' } })
    fireEvent.click(screen.getByText('my_stack_add_custom'))
    fireEvent.change(kategorie, { target: { value: 'other' } })
    expect(kategorie.value).toBe('other')
    waehleForm('other')
    continueWizard()

    // Der Schritt ist beantwortet: keine Pflichtmeldung, und die Frage nach
    // der Substanz steht nicht mehr da.
    expect(screen.queryByText('my_stack_name_required')).toBeNull()
    expect(screen.queryByText('my_stack_category_required')).toBeNull()
    expect(screen.queryByLabelText('my_stack_question')).toBeNull()
  })

  it('füllt beim Kombipräparat beide Zutatenzeilen', () => {
    // Der Zweck eines Kombi-Eintrags: einmal wählen, beide Wirkstoffe stehen
    // da — jeder mit seinem eigenen Katalogbezug, also mit Einheiten und
    // PK-Profil. Vorher war der zweite Wirkstoff reiner Freitext.
    renderWizard({ catalogEntries: [vitaminD3, vitaminK2, d3k2] })

    fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'D3 +' } })
    fireEvent.click(screen.getByRole('option', { name: /Vitamin D3 \+ K2/ }))

    // Der Substanzschritt zeigt das Produkt, nicht seinen ersten Bestandteil.
    expect(document.querySelector('[data-substance-selected="d3-k2"]')).not.toBeNull()
    expect(document.querySelector('[data-substance-selected-hint]')?.textContent)
      .toBe('my_stack_combination · Vitamin D3 + Vitamin K2')

    // Die Kapsel ist die einzige Form des Eintrags und schon gewaehlt.
    continueWizard()

    // Kein Zutatenschritt mehr: beide Namen kommen aus dem Katalog, dort
    // wäre nichts mehr zu entscheiden. Der nächste Schritt ist die Stärke —
    // und die fragt je Wirkstoff, mit seinem Namen über der Karte.
    expect(screen.queryByLabelText('my_stack_ingredient_1')).toBeNull()
    expect(document.querySelector('#stack-strength-0-amount-value')).not.toBeNull()
    expect(document.querySelector('#stack-strength-1-amount-value')).not.toBeNull()
    expect(document.body.textContent).toContain('Vitamin D3')
    expect(document.body.textContent).toContain('Vitamin K2')
  })

  it('lässt aus dem Stärkeschritt einen weiteren Wirkstoff nachtragen', () => {
    // Die Tür für den Fall, den der Katalog nicht kennt: das eigene Produkt
    // ist ein Blend. Ohne sie säße man fest, weil der Zutatenschritt bei
    // einer Katalogauswahl gar nicht mehr kommt.
    renderWizard({ catalogEntries: [vitaminD3, vitaminK2, d3k2] })

    fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'D3 +' } })
    fireEvent.click(screen.getByRole('option', { name: /Vitamin D3 \+ K2/ }))
    // Die Kapsel ist die einzige Form des Eintrags und schon gewaehlt.
    continueWizard()

    fireEvent.click(screen.getByRole('button', { name: 'my_stack_strength_add_ingredient' }))

    // Die neue Zeile hat keinen Namen — also ist der Zutatenschritt wieder da,
    // und man steht darin.
    expect(screen.getByLabelText('my_stack_ingredient_3')).not.toBeNull()
  })

  it('weist ein Kombipräparat schon in der Trefferliste aus', () => {
    renderWizard({ catalogEntries: [vitaminD3, vitaminK2, d3k2] })

    fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'Vitamin' } })

    const treffer = document.querySelectorAll('[data-substance-combination]')
    expect(treffer).toHaveLength(1)
    expect(treffer[0].textContent).toBe('my_stack_combination · Vitamin D3 + Vitamin K2')
  })

  it('macht die Katalogwahl sichtbar und nimmt das Suchfeld weg', () => {
    // Vorher sah der Bildschirm nach der Wahl aus wie davor: Trefferliste
    // offen, „eigene Substanz“ daneben, kein Zeichen, dass etwas gewaehlt ist.
    renderWizard()
    const input = screen.getByLabelText('my_stack_question') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'Vitamin' } })
    fireEvent.click(screen.getByRole('option', { name: /Vitamin D3/ }))

    expect(document.querySelector('[data-substance-selected="vitamin-d3"]')).not.toBeNull()
    expect(screen.queryByLabelText('my_stack_question')).toBeNull()
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'my_stack_add_custom' })).toBeNull()
  })

  it('wirft die Katalogverknuepfung nicht mehr lautlos weg', async () => {
    // Der Befund, der diesen Umbau ausgeloest hat: ein Tastendruck nach der
    // Wahl setzte Katalog-ID, Kategorie und Einheit auf null — samt PK-Profil,
    // also genau dem, wofuer man die tiefste Stufe waehlt. Loesen geht jetzt
    // nur ueber das Kreuz, und dabei bleibt, was der Nutzer selbst gesetzt hat.
    const { onSave } = renderWizard()
    const input = screen.getByLabelText('my_stack_question') as HTMLInputElement

    // Vor der Wahl steht das Kategoriefeld da — es gilt der freien Eingabe.
    expect(screen.getByLabelText('my_stack_category')).toBeTruthy()

    fireEvent.change(input, { target: { value: 'Vitamin' } })
    fireEvent.click(screen.getByRole('option', { name: /Vitamin D3/ }))

    // Nach der Wahl ist es verschwunden: der Katalogeintrag bringt seine
    // Kategorie mit, und ein Pflichtfeld mit feststehender Antwort ist eines
    // zu viel. Gesetzt ist sie trotzdem — das prueft der Speicheraufruf unten.
    expect(screen.queryByLabelText('my_stack_category')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'my_stack_detach_catalog' }))

    // Suchfeld wieder da, Name erhalten, Kategorie erhalten — und das
    // Kategoriefeld auch, denn ohne Katalogeintrag wird es wieder gebraucht.
    // Weg ist nur die Verknuepfung, und zwar weil jemand darauf geklickt hat.
    const wieder = screen.getByLabelText('my_stack_question') as HTMLInputElement
    expect(wieder.value).toBe('Vitamin D3')
    expect((screen.getByLabelText('my_stack_category') as HTMLSelectElement).value).toBe('vitamin')

    // Die Kapsel bleibt gewaehlt; die Staerke wird uebersprungen.
    advanceTo('[data-strength-skip]')
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_strength_skip' }))
    advanceToPlanStep()
    setMethodIfAsked()
    fireEvent.change(screen.getByLabelText(/my_stack_plan_quantity$/), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('my_stack_plan_unit'), { target: { value: 'capsule' } })
    advanceToReview()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].ingredients[0].catalog_substance_id).toBeNull()
    expect(onSave.mock.calls[0][0].ingredients[0].custom_name).toBe('Vitamin D3')
    expect(onSave.mock.calls[0][0].category).toBe('vitamin')
  })

  it('supports listbox navigation and selection keys', () => {
    const onSelect = vi.fn()
    render(
      <SubstanceSearch
        query="Vitamin"
        entries={[vitaminD3, vitaminK2]}
        category={null}
        onQueryChange={() => undefined}
        onSelect={onSelect}
        onAddCustom={() => undefined}
        onDetach={() => undefined}
        onCategoryChange={() => undefined}
      />,
    )
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')

    expect(options[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(options[1].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(listbox, { key: 'Home' })
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(listbox, { key: 'End' })
    expect(options[1].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(listbox, { key: 'ArrowUp' })
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(vitaminD3)
  })

  it('uses Escape to dismiss results without closing the dialog and reopens on input', () => {
    const { onClose } = renderWizard()
    const input = screen.getByLabelText('my_stack_question') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Vitamin' } })
    const listbox = screen.getByRole('listbox')

    fireEvent.keyDown(listbox, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()

    fireEvent.change(input, { target: { value: 'Vitamin D' } })
    expect(screen.getByRole('listbox')).toBeTruthy()
  })

  it('zeigt den Namensfehler dort, wo der Name steht', async () => {
    // Frueher gab es ihn zweimal: im Suchfeld und noch einmal unter
    // „Produktname“ im Inhaltsstoff-Schritt. Es gibt nur einen Namen, also
    // auch nur einen Ort, an dem er fehlen kann.
    renderWizard()
    const suche = screen.getByLabelText('my_stack_question') as HTMLInputElement
    fireEvent.change(suche, { target: { value: 'Custom Product' } })
    fireEvent.change(screen.getByLabelText('my_stack_category'), { target: { value: 'supplement' } })
    fireEvent.change(suche, { target: { value: '' } })
    continueWizard()

    expect(screen.getByText('my_stack_name_required')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(suche))
    expect(screen.queryByText('my_stack_dosage_form')).toBeNull()
  })

  it('traps focus and restores it to the opener on unmount', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { unmount } = renderWizard()
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    const close = screen.getByRole('button', { name: 'close' })
    const next = screen.getByRole('button', { name: 'continue' })
    next.focus()
    fireEvent.keyDown(next, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(next)

    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('startet gruendlich: nach der Form kommen die Wirkstoffnamen', () => {
    // Die Tiefe wird nicht mehr gefragt. Wer weniger will, ueberspringt die
    // Staerke in der Zusammensetzung.
    renderWizard()
    startCustom('Choice Required')
    waehleForm('capsule')
    continueWizard()
    expect(screen.queryByRole('radio', { name: /my_stack_tracking_/ })).toBeNull()
    expect(screen.getByLabelText('my_stack_ingredient_1')).toBeTruthy()
  })

  it('geht nach dem Ueberspringen der Staerke direkt zum Plan', () => {
    renderWizard()
    startCustom('Choice Required')
    waehleForm('capsule')
    advanceTo('[data-strength-skip]')
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_strength_skip' }))
    continueWizard()
    expect(document.querySelector('[data-rhythm-kind="daily"]')).not.toBeNull()
  })

  it('speichert ohne Staerke mit Menge und ohne Umweg zurueck zur Staerke', async () => {
    const { onSave } = renderWizard()
    startCustom('Simple Product')
    waehleForm('capsule')
    advanceTo('[data-strength-skip]')
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_strength_skip' }))
    advanceToPlanStep()
    setMethodIfAsked()
    fireEvent.change(screen.getByLabelText(/my_stack_plan_quantity$/), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('my_stack_plan_unit'), { target: { value: 'capsule' } })
    advanceToReview()

    expect(screen.getByText('my_stack_daily_with_amount')).toBeTruthy()
    expect(screen.getByText('dosage_form_capsule')).toBeTruthy()
    // Der Rhythmus steht als Schlüssel da: die Zusammenfassung wird übersetzt, nicht zusammengebaut.
    expect(document.querySelector('[data-review-rhythm]')?.textContent).toBe('my_stack_rhythm_daily')

    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].trackingLevel).toBe('with_amount')
    expect(onSave.mock.calls[0][0].plan.slots[0].dose).toBe(1)
    expect(onSave.mock.calls[0][1]).toBe('create')
    expect(screen.queryByLabelText('my_stack_strength_value')).toBeNull()
  })

  it('hydrates the active plan and clears its id only when creating a duplicate', async () => {
    const updateRun = renderWizard({ existingItem: existingVitaminD, existingPlan })
    reachExistingReview()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(updateRun.onSave).toHaveBeenCalledTimes(1))
    expect(updateRun.onSave.mock.calls[0][0].plan).toMatchObject({
      id: 'cycle-1',
      name: 'Vitamin D breakfast',
      method: 'Oral',
      // `reachExistingReview` tippt unterwegs eine 1 in das Mengenfeld — die
      // Menge steht jetzt am Zeitpunkt, also kommt sie dort an.
      slots: [{ routineGroup: 'morning', time: '08:30', dose: 1, weekdays: [] }],
    })
    cleanup()

    const duplicateRun = renderWizard({ existingItem: existingVitaminD, existingPlan })
    reachExistingReview(true)
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_create_variant' }))
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(duplicateRun.onSave).toHaveBeenCalledTimes(1))
    expect(duplicateRun.onSave.mock.calls[0][0].plan.id).toBeUndefined()
  })
  it('reviews complete tracking, routine, quantity, PK status, and product details', () => {
    renderWizard({ existingItem: existingVitaminD })
    reachExistingReview()

    expect(screen.getByText('my_stack_daily_complete')).toBeTruthy()
    // Die Zusammenfassung nennt Tageszeit, Uhrzeit UND Menge in einer Zeile,
    // damit bei mehreren Einnahmen am Tag nichts verschwiegen wird.
    expect(document.querySelector('[data-review-slot="0"]')?.textContent)
      .toContain('my_stack_routine_morning')
    expect(document.querySelector('[data-review-rhythm]')?.textContent).toBe('my_stack_rhythm_daily')
    // Und das Ende, das es vorher im Formular gar nicht gab.
    expect(document.querySelector('[data-review-end-date]')?.textContent)
      .toBe('my_stack_plan_end_open')
    expect(screen.getByText('1 capsule')).toBeTruthy()
    expect(screen.getByText('my_stack_pk_unavailable')).toBeTruthy()
    expect(screen.getByText('Example Brand')).toBeTruthy()
  })
  it('fuehrt Marke und Bestand im Ueberblick, aufgeklappt', () => {
    renderWizard()
    completeCustomFlow('Inventory Product')

    const disclosure = screen.getByRole('button', { name: 'my_stack_product_inventory' })
    expect(disclosure.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByLabelText('my_stack_package_quantity')).toBeNull()
    fireEvent.change(screen.getByLabelText('my_stack_brand_optional'), { target: { value: 'Example Brand' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'my_stack_inventory_enabled' }))
    fireEvent.change(screen.getByLabelText('my_stack_package_quantity'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('my_stack_package_unit'), { target: { value: 'capsule' } })
    fireEvent.change(screen.getByLabelText('my_stack_remaining_quantity'), { target: { value: '42' } })
    // Das Ablaufdatum steht in der Zusammensetzung, hier nicht noch einmal.
    expect(screen.queryByLabelText(/my_stack_stock_expires_unopened|my_stack_expires_at_optional/)).toBeNull()

    expect(screen.getByText('42 capsule')).toBeTruthy()
    expect(screen.getAllByText('Example Brand').length).toBeGreaterThan(0)
  })

  it('behaelt den Bestand, wenn die Staerke spaeter uebersprungen wird', async () => {
    // Ob jemand Vorraete fuehrt, hat mit der Messgenauigkeit nichts zu tun.
    const { onSave } = renderWizard()
    completeCustomFlow('Lower Depth Product')
    fireEvent.click(screen.getByRole('checkbox', { name: 'my_stack_inventory_enabled' }))
    fireEvent.change(screen.getByLabelText('my_stack_package_quantity'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('my_stack_package_unit'), { target: { value: 'capsule' } })
    fireEvent.change(screen.getByLabelText('my_stack_remaining_quantity'), { target: { value: '42' } })

    while (!document.querySelector('[data-strength-skip]')) fireEvent.click(screen.getByRole('button', { name: 'back' }))
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_strength_skip' }))
    advanceToReview()
    // Ohne Staerke bucht nichts ab: ein Hinweis statt der Felder. Der Entwurf
    // behaelt die Angaben fuer „Doch angeben".
    expect(document.querySelector('[data-inventory-needs-strength]')).not.toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'my_stack_inventory_enabled' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].trackingLevel).toBe('with_amount')
    expect(onSave.mock.calls[0][0].inventory.enabled).toBe(true)
    expect(onSave.mock.calls[0][0].inventory.remainingQuantity).toBe(42)
  })
  it('emits create, update, and duplicate payload modes', async () => {
    const createRun = renderWizard()
    completeCustomFlow('Create Product')
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(createRun.onSave).toHaveBeenCalledTimes(1))
    expect(createRun.onSave.mock.calls[0][0].displayName).toBe('Create Product')
    expect(createRun.onSave.mock.calls[0][0].plan).toMatchObject({ unit: 'capsule' })
    expect(createRun.onSave.mock.calls[0][0].plan.slots[0].dose).toBe(1)
    expect(createRun.onSave.mock.calls[0][0].inventory.enabled).toBe(false)
    expect(createRun.onSave.mock.calls[0][1]).toBe('create')
    cleanup()

    const updateRun = renderWizard({ existingItem: existingVitaminD })
    reachExistingReview()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(updateRun.onSave).toHaveBeenCalledTimes(1))
    expect(updateRun.onSave.mock.calls[0][0].id).toBe('stack-1')
    expect(updateRun.onSave.mock.calls[0][1]).toBe('update')
    cleanup()

    const duplicateRun = renderWizard({ existingItem: existingVitaminD })
    reachExistingReview(true)
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_create_variant' }))
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(duplicateRun.onSave).toHaveBeenCalledTimes(1))
    expect(duplicateRun.onSave.mock.calls[0][0].id).toBeUndefined()
    expect(duplicateRun.onSave.mock.calls[0][1]).toBe('duplicate')
  })

  it('focuses duplicate actions and blocks competing navigation during separate save', async () => {
    const pending = deferred<void>()
    const onSave = vi.fn(() => pending.promise)
    const { onClose, onOpenExisting } = renderWizard({
      existingItems: [existingVitaminD],
      onSave,
    })
    completeCatalogFlow()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    const openExisting = await screen.findByRole('button', { name: 'my_stack_open_existing' }) as HTMLButtonElement
    const addSeparately = screen.getByRole('button', { name: 'my_stack_add_separately' }) as HTMLButtonElement
    const cancelDuplicate = screen.getAllByRole('button', { name: 'cancel' }).at(-1) as HTMLButtonElement
    await waitFor(() => expect(document.activeElement).toBe(openExisting))

    fireEvent.click(addSeparately)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(openExisting.disabled).toBe(true)
    expect(cancelDuplicate.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'close' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'back' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(openExisting)
    expect(onClose).not.toHaveBeenCalled()
    expect(onOpenExisting).not.toHaveBeenCalled()

    await act(async () => pending.reject(new Error('RPC failed')))
    expect(await screen.findByText('my_stack_save_error')).toBeTruthy()
    expect(openExisting.disabled).toBe(false)
    expect(cancelDuplicate.disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'close' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByRole('heading', { name: 'Vitamin D3' })).toBeTruthy()
  })

  it('keeps the complete draft open after a rejected save', async () => {
    const onSave = vi.fn(async () => { throw new Error('RPC failed') })
    const { onClose } = renderWizard({ onSave })
    completeCustomFlow('Multi Word Product')
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(await screen.findByText('my_stack_save_error')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Multi Word Product' })).toBeTruthy()

    while (!screen.queryByLabelText('my_stack_question')) {
      fireEvent.click(screen.getByRole('button', { name: 'back' }))
    }
    expect((screen.getByLabelText('my_stack_question') as HTMLInputElement).value)
      .toBe('Multi Word Product')
  })
})

describe('StackItemWizard — Bearbeiten-Übersicht', () => {
  function editSections(): string[] {
    return [...document.querySelectorAll('[data-edit-section]')].map(el => el.getAttribute('data-edit-section') ?? '')
  }

  it('öffnet beim Bearbeiten auf der Übersicht, ohne Plan und ohne Schrittbalken', () => {
    const { onClose } = renderWizard({ existingItem: existingVitaminD, existingPlan, metadataOnly: true })

    expect(screen.getByText('my_stack_edit_overview_hint')).toBeTruthy()
    expect(editSections()).toEqual(['substance', 'composition', 'product'])
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(document.querySelector('[data-review-rhythm]')).toBeNull()
    expect(screen.getByText('With breakfast')).toBeTruthy()
    // Kein Zurueck-Pfeil, der alle Aenderungen wortlos verwirft — nur das X.
    expect(screen.queryByRole('button', { name: 'cancel' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'back' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('zeigt die Zusammensetzung als eigenen Abschnitt und führt mit Zurück zur Übersicht', () => {
    renderWizard({ existingItem: existingVitaminD, existingPlan, catalogEntries: [vitaminD3], metadataOnly: true })

    // Nur Katalogzutaten: der Abschnitt ist allein die Stärke.
    fireEvent.click(document.querySelector('[data-edit-section="composition"]')!)
    expect(screen.getByRole('button', { name: 'my_stack_edit_done' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(document.querySelector('[data-edit-overview]')).not.toBeNull()
    expect(screen.getByText('5000 IU / 1 capsule')).toBeTruthy()
  })

  it('führt aus einem Abschnitt mit „Fertig" zurück zur Übersicht, nicht zum nächsten Schritt', async () => {
    renderWizard({ existingItem: existingVitaminD, existingPlan, metadataOnly: true })

    // Form und Farbe stehen im Substanz-Abschnitt — einmal „Fertig" genuegt.
    fireEvent.click(document.querySelector('[data-edit-section="substance"]')!)
    expect(screen.getByRole('radio', { name: 'dosage_form_capsule' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_edit_done' }))

    expect(editSections()).toHaveLength(3)
    await waitFor(() => expect(document.activeElement?.getAttribute('data-edit-section')).toBe('substance'))
  })

  it('fragt im Substanz-Abschnitt nicht nach „hinzufügen" und geht mit Zurück zur Übersicht', () => {
    renderWizard({ existingItem: existingVitaminD, existingPlan, metadataOnly: true })

    fireEvent.click(document.querySelector('[data-edit-section="substance"]')!)
    expect(screen.queryByText('my_stack_question')).toBeNull()
    expect(screen.getByText('my_stack_edit_substance_question')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(editSections()).toHaveLength(3)
  })

  it('speichert eine Änderung einmal auf der Übersicht', async () => {
    const { onSave } = renderWizard({ existingItem: existingVitaminD, existingPlan, metadataOnly: true })

    fireEvent.click(document.querySelector('[data-edit-section="product"]')!)
    fireEvent.change(screen.getByLabelText('my_stack_notes_optional'), { target: { value: 'Mit Fett' } })
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_edit_done' }))
    expect(screen.getByText('Mit Fett')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].notes).toBe('Mit Fett')
    expect(onSave.mock.calls[0][1]).toBe('update')
  })

  it('bleibt ohne Bearbeiten-Modus beim bisherigen Ablauf', () => {
    renderWizard({ existingItem: existingVitaminD, existingPlan })

    expect(document.querySelector('[data-edit-overview]')).toBeNull()
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })
})

describe('StackItemWizard — Speichern mit Grund statt Sammelmeldung', () => {
  const weekdayPlan: IntakePlanDraft = {
    ...existingPlan,
    rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Mo', 'Fr'] },
    slots: [
      { routineGroup: 'evening', time: null, dose: 100, weekdays: ['Mo'] },
      { routineGroup: 'morning', time: null, dose: 100, weekdays: ['Fr'] },
    ],
  }

  it('zeigt beim Fehlschlag den technischen Grund in einer eigenen Zeile', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { onSave } = renderWizard({ existingItem: existingVitaminD, existingPlan: weekdayPlan, intent: 'plan' })
    onSave.mockRejectedValueOnce(new Error('Invalid stack item setup draft: plan.method'))

    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(document.querySelector('[data-save-error-detail]')?.textContent)
      .toBe('Invalid stack item setup draft: plan.method'))
    expect(screen.getByText('my_stack_save_error')).toBeTruthy()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('sagt im Plan-Modus, dass bei der Substanz etwas fehlt, statt es erst beim Speichern scheitern zu lassen', async () => {
    const unvollstaendig = {
      ...existingVitaminD,
      ingredients: [{ ...existingVitaminD.ingredients[0], basis_value: null }],
    } as StackItem
    const { onSave } = renderWizard({ existingItem: unvollstaendig, existingPlan: weekdayPlan, intent: 'plan' })

    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(screen.getByText('my_stack_save_item_incomplete')).toBeTruthy())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('nennt einen unvollständigen Bestand, bevor der Speicherdienst ihn ablehnt', async () => {
    const mitBestand = {
      ...existingVitaminD,
      inventory: { enabled: true, package_quantity: null, package_unit: null, remaining_quantity: null, expires_at: null },
    } as unknown as StackItem
    const { onSave } = renderWizard({ existingItem: mitBestand, existingPlan: weekdayPlan, intent: 'plan' })

    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(screen.getByText('my_stack_save_item_incomplete')).toBeTruthy())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('springt zum fehlenden Schritt, wenn es ihn in diesem Ablauf gibt', async () => {
    const unvollstaendig = {
      ...existingVitaminD,
      ingredients: [{ ...existingVitaminD.ingredients[0], basis_value: null }],
    } as StackItem
    const { onSave } = renderWizard({ existingItem: unvollstaendig, existingPlan, metadataOnly: true })

    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(screen.getByLabelText('my_stack_basis_value')).toBeTruthy())
    expect(screen.queryByText('my_stack_save_item_incomplete')).toBeNull()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('speichert einen vollständigen Wochentagsplan ohne Umweg', async () => {
    const { onSave } = renderWizard({ existingItem: existingVitaminD, existingPlan: weekdayPlan, intent: 'plan' })

    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  })
})
