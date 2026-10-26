// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CyclePlanVersion, CycleTimeline } from '../../../lib/planTimeline'
import { PlanSummaryCard } from './PlanSummaryCard'
import { spritzenRechnung, type SpritzenRechnung } from '../lib/bestand'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'de' },
    t: (key: string, options?: Record<string, unknown>) => {
      let value = String(options?.defaultValue ?? key)
      for (const [name, replacement] of Object.entries(options ?? {})) {
        value = value.replaceAll(`{{${name}}}`, String(replacement))
      }
      return value
    },
  }),
}))

const now = new Date('2026-09-22T10:00:00.000Z')

function version(id: string, localDate: string, changes: Partial<CyclePlanVersion> = {}): CyclePlanVersion {
  return {
    id,
    cycle_id: 'cycle-1',
    effective_kind: 'local_date',
    effective_at: null,
    effective_local_date: localDate,
    change_kind: 'initial',
    frequency: 'daily',
    x_days_interval: null,
    interval_unit: null,
    cycle_on_days: null,
    cycle_off_days: null,
    schedule_days: [],
    intake_time: 'morgens,abends',
    intake_time_custom: '08:00,20:00',
    slot_doses: null,
    slot_days: null,
    dose: 100,
    unit: 'mcg',
    method: 'Subkutan',
    ...changes,
  }
}

function timeline(changes: Partial<CycleTimeline> = {}): CycleTimeline {
  return {
    cycle: { id: 'cycle-1', stack_item_id: 'stack-1', started_at: '2026-05-30T22:00:00.000Z', ended_at: null, start_local_date: '2026-05-31' },
    versions: [version('v1', '2026-05-31')],
    pauses: [],
    ...changes,
  }
}

function renderCard(timelines: CycleTimeline[], extra: { needsReview?: boolean; loadState?: 'ready' | 'loading' | 'error'; syringe?: SpritzenRechnung | null } = {}) {
  const onOpen = vi.fn()
  const onStartNew = vi.fn()
  render(<PlanSummaryCard timelines={timelines} now={now} timeZone="Europe/Berlin" onOpen={onOpen} onStartNew={onStartNew} {...extra} />)
  return { onOpen, onStartNew, card: screen.getByRole('region', { name: 'Einnahmeplan' }) }
}

afterEach(cleanup)

describe('PlanSummaryCard', () => {
  it('shows the running plan with its day, intake times and next intake, and opens the overview', () => {
    const { card, onOpen } = renderCard([timeline()])

    expect(card.dataset.planSummary).toBe('active')
    expect(card.textContent).toContain('Aktiver Zyklus')
    expect(card.textContent).toContain('seit 31.05.2026 · Tag 115')
    expect(card.textContent).toContain('2 Einnahmezeiten')
    expect(card.textContent).toContain('Morgens · 08:00')
    expect(card.textContent).toContain('100 mcg')
    expect(card.textContent).toContain('Heute · 20:00')
    // Ohne geplante Stufe kein Kasten dafür.
    expect(card.textContent).not.toContain('Nächste Stufe')

    fireEvent.click(screen.getByRole('button', { name: /Plan & Verlauf öffnen/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('zeigt einen Wochentagsplan wie jeden anderen: je Einnahmezeit eine Zeile, ohne Tagesleiste', () => {
    // So speichert der Editor „Mo und Fr, morgens und abends": vier Stellen.
    const { card } = renderCard([timeline({
      versions: [version('v1', '2026-05-31', {
        frequency: 'weekdays',
        schedule_days: ['Mo', 'Fr'],
        intake_time: 'morgens,abends,morgens,abends',
        intake_time_custom: '08:00,20:00,08:00,20:00',
        slot_doses: '50,50,50,50',
        slot_days: 'Mo,Mo,Fr,Fr',
        dose: 50,
        unit: 'mg',
      })],
    })])

    expect(card.textContent).toContain('2 Einnahmezeiten')
    expect(card.querySelectorAll('li')).toHaveLength(2)
    expect(card.textContent).not.toContain('4 Einnahmezeiten')
  })

  it('names a planned step by its new dose, or by its kind when several doses change', () => {
    const oneDose = timeline({ versions: [version('v1', '2026-05-31'), version('v2', '2026-10-01', { dose: 150, change_kind: 'titration' })] })
    const { card } = renderCard([oneDose])
    expect(card.textContent).toContain('Nächste Stufe01.10.2026 · 150 mcg')
    cleanup()

    const twoDoses = timeline({ versions: [
      version('v1', '2026-05-31'),
      version('v2', '2026-10-01', { slot_doses: '150,200', change_kind: 'titration' }),
    ] })
    expect(renderCard([twoDoses]).card.textContent).toContain('01.10.2026 · Titration')
  })

  it('prefers the running cycle over an ended one and describes a pause without a due intake', () => {
    const ended = timeline({
      cycle: { id: 'cycle-old', stack_item_id: 'stack-1', started_at: '2026-01-01T00:00:00.000Z', ended_at: '2026-02-01T00:00:00.000Z' },
    })
    const paused = timeline({ pauses: [{ id: 'p1', cycle_id: 'cycle-1', paused_at: '2026-09-20T08:00:00.000Z', ends_at: null }] })
    const { card } = renderCard([ended, paused])

    expect(card.dataset.planSummary).toBe('paused')
    expect(card.textContent).toContain('Pausiert')
    expect(card.textContent).toContain('Während der Pause ist keine Einnahme fällig.')
    expect(card.textContent).not.toContain('Nächste Einnahme')
  })

  it('offers a new cycle and the history when the last cycle has ended', () => {
    const ended = timeline({
      cycle: { id: 'cycle-1', stack_item_id: 'stack-1', started_at: '2026-05-30T22:00:00.000Z', ended_at: '2026-08-12T22:00:00.000Z', start_local_date: '2026-05-31', end_local_date: '2026-08-13' },
    })
    const { card, onOpen, onStartNew } = renderCard([ended])

    expect(card.textContent).toContain('Kein aktiver Zyklus')
    expect(card.textContent).toContain('Zuletzt: 31.05.2026 – 12.08.2026 · 74 Tage')
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Zyklus starten' }))
    fireEvent.click(screen.getByRole('button', { name: 'Verlauf ansehen' }))
    expect(onStartNew).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('invites a first cycle when there is none', () => {
    const { card } = renderCard([])
    expect(card.textContent).toContain('Noch kein Zyklus')
    expect(screen.queryByRole('button', { name: 'Verlauf ansehen' })).toBeNull()
  })

  it('does not name a new dose for a step that only moves the time', () => {
    const moved = timeline({ versions: [
      version('v1', '2026-05-31'),
      version('v2', '2026-10-01', { intake_time_custom: '09:00,20:00', change_kind: 'schedule' }),
    ] })
    const { card } = renderCard([moved])
    expect(card.textContent).toContain('01.10.2026 · Plan')
    expect(card.textContent).not.toContain('01.10.2026 · 100 mcg')
  })

  it('says the plans are loading or failed instead of claiming there is no cycle', () => {
    expect(renderCard([], { loadState: 'loading' }).card.textContent).toContain('Einnahmeplan wird geladen')
    expect(screen.queryByRole('button', { name: 'Neuen Zyklus starten' })).toBeNull()
    cleanup()

    renderCard([], { loadState: 'error' })
    expect(screen.getByRole('alert').textContent).toContain('konnten nicht geladen werden')
    expect(screen.queryByRole('button', { name: 'Neuen Zyklus starten' })).toBeNull()
  })

  it('names no due intake while a cycle waits for its timezone', () => {
    const review = timeline({ cycle: {
      id: 'cycle-1', stack_item_id: 'stack-1', started_at: '2026-05-30T22:00:00.000Z', ended_at: null,
      start_local_date: '2026-05-31', timezone_review_required: true,
    } })
    const { card } = renderCard([review])
    expect(card.dataset.planSummary).toBe('review')
    expect(card.textContent).toContain('Zeitzone')
    expect(card.textContent).not.toContain('Nächste Einnahme')
  })

  it('points a plan in conflict to the overview instead of guessing', () => {
    const { card } = renderCard([timeline()], { needsReview: true })
    expect(card.textContent).toContain('Welcher Plan läuft wirklich?')
    expect(card.textContent).not.toContain('100 mcg')
  })

  it('shows the syringe units to draw for a mixed vial, with where they come from', () => {
    // 50 mg auf 1,5 ml: 100 mcg = 0,003 ml = 0,3 E.
    const syringe = spritzenRechnung([{
      catalog_substance_id: null, custom_name: 'X', amount_value: 50, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial', position: 0,
    }], 1.5, '1 mL (100 Einheiten)')
    const { card } = renderCard([timeline({ versions: [version('v1', '2026-05-31', { dose: 1, unit: 'mg' })] })], { syringe })

    expect(card.querySelectorAll('li')[0].textContent).toContain('1 mg')
    expect(card.textContent).toContain('my_stack_plan_draw_units')
    expect(card.textContent).toContain('my_stack_plan_units_note')
  })

  it('shows no syringe units without a mixed vial', () => {
    const { card } = renderCard([timeline()])
    expect(card.textContent).not.toContain('my_stack_plan_draw_units')
  })
})
