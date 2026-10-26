// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CyclePlanVersion, CycleTimeline } from '../../../lib/planTimeline'
import { PlanManagementSection, type PlanManagementSectionProps } from './PlanManagementSection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'de' },
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        my_stack_rhythm_unit_day: 'Tagen',
        my_stack_rhythm_unit_week: 'Wochen',
        my_stack_rhythm_unit_month: 'Monaten',
      }
      let value = translations[key] ?? String(options?.defaultValue ?? key)
      for (const [name, replacement] of Object.entries(options ?? {})) {
        value = value.replaceAll(`{{${name}}}`, String(replacement))
      }
      return value
    },
  }),
}))

const now = new Date('2026-09-19T08:00:00.000Z')

function version(
  id: string,
  dose: number,
  effectiveLocalDate: string,
  changes: Partial<CyclePlanVersion> = {},
): CyclePlanVersion {
  return {
    id,
    cycle_id: 'cycle-1',
    effective_kind: 'local_date',
    effective_at: null,
    effective_local_date: effectiveLocalDate,
    change_kind: id === 'version-current' ? 'initial' : 'dose',
    frequency: 'daily',
    x_days_interval: null,
    interval_unit: null,
    cycle_on_days: null,
    cycle_off_days: null,
    schedule_days: [],
    intake_time: 'abends',
    intake_time_custom: '20:00',
    slot_doses: null,
    slot_days: null,
    dose,
    unit: 'mg',
    method: 'Oral',
    ...changes,
  }
}

function timeline(changes: Partial<CycleTimeline> = {}): CycleTimeline {
  return {
    cycle: {
      id: 'cycle-1',
      stack_item_id: 'stack-1',
      started_at: '2026-09-01T08:00:00.000Z',
      ended_at: null,
    },
    versions: [
      version('version-current', 5, '2026-09-01'),
      version('version-future', 10, '2026-09-21'),
    ],
    pauses: [],
    ...changes,
  }
}

function callbacks(overrides: Partial<PlanManagementSectionProps> = {}): PlanManagementSectionProps {
  return {
    timeline: timeline(),
    now,
    timeZone: 'Europe/Berlin',
    onAdjustPlan: vi.fn(),
    onAddStep: vi.fn(),
    onEditFuture: vi.fn(),
    onRemoveFuture: vi.fn(async () => undefined),
    onPause: vi.fn(async () => undefined),
    onSetPauseEnd: vi.fn(async () => undefined),
    onResume: vi.fn(async () => undefined),
    onEnd: vi.fn(async () => undefined),
    onRestart: vi.fn(),
    needsReview: false,
    onResolveConflict: vi.fn(async () => undefined),
    ...overrides,
  }
}

afterEach(cleanup)

describe('PlanManagementSection', () => {
  it('replaces every ordinary plan presentation with a history-preserving conflict choice', async () => {
    const onResolveConflict = vi.fn(async () => undefined)
    render(<PlanManagementSection {...callbacks({ needsReview: true, onResolveConflict })} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.textContent).toContain('Welcher Plan läuft wirklich?')
    expect(section.textContent).toContain('Deine bisherigen Einnahmen und der gesamte Verlauf bleiben erhalten.')
    expect(section.textContent).not.toContain('Aktiv')
    expect(section.textContent).not.toContain('5 mg')
    expect(section.textContent).not.toContain('Nächste Einnahme')
    expect(section.textContent).not.toContain('Nächste Änderung')
    expect(within(section).queryByRole('button', { name: 'Plan anpassen' })).toBeNull()
    expect(within(section).queryByRole('button', { name: 'Stufe hinzufügen' })).toBeNull()

    fireEvent.click(within(section).getByRole('button', { name: 'Diesen laufenden Plan behalten' }))
    await waitFor(() => expect(onResolveConflict).toHaveBeenCalledTimes(1))
  })

  it('shows the resolved current plan, next intake, and the next exact future change', () => {
    render(<PlanManagementSection {...callbacks()} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.textContent).toContain('Aktiv')
    expect(section.textContent).toContain('5 mg')
    expect(section.textContent).toContain('Täglich')
    expect(section.textContent).toContain('20:00')
    expect(section.textContent).toContain('21.09.2026')
    // Ein Knopf fuer jede Aenderung ab jetzt — Dosis oder Plan erkennt das Speichern.
    expect(within(section).getAllByRole('button', { name: /anpassen/ })).toHaveLength(1)
    expect(within(section).getByRole('button', { name: 'Plan anpassen' })).toBeTruthy()
    expect(within(section).queryByRole('button', { name: 'Bearbeiten' })).toBeNull()
  })

  it('identifies the running plan as the active cycle instead of a generic status', () => {
    render(<PlanManagementSection {...callbacks()} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.dataset.cycleStatus).toBe('active')
    expect(within(section).getByRole('status', { name: 'Aktiver Zyklus' })).toBeTruthy()
  })

  it('allows edit and removal only for the selected future version', async () => {
    const onEditFuture = vi.fn()
    const onRemoveFuture = vi.fn(async () => undefined)
    render(<PlanManagementSection {...callbacks({ onEditFuture, onRemoveFuture })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Geplante Änderung vom 21.09.2026 bearbeiten' }))
    expect(onEditFuture).toHaveBeenCalledWith(expect.objectContaining({ id: 'version-future' }))

    expect(screen.queryByRole('button', { name: 'Version version-current entfernen' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Geplante Änderung vom 21.09.2026 entfernen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Änderung entfernen' }))
    await waitFor(() => expect(onRemoveFuture).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'version-future' }),
    ))
  })

  it('passes an optional pause end and keeps the dialog open with retry copy after failure', async () => {
    let rejectPause: ((error: Error) => void) | undefined
    const onPause = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectPause = reject }))
    render(<PlanManagementSection {...callbacks({ onPause })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause bestätigen' }))
    expect(onPause).toHaveBeenCalledWith(null)
    expect((screen.getByRole('button', { name: 'Pause bestätigen' }) as HTMLButtonElement).disabled).toBe(true)

    rejectPause?.(new Error('network'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Bitte versuche es erneut'))
    expect(screen.getByRole('dialog', { name: 'Plan pausieren' })).toBeTruthy()
  })

  it('converts pause and pause-end wall clocks to deterministic timezone-safe instants', async () => {
    const onPause = vi.fn(async () => undefined)
    const onSetPauseEnd = vi.fn(async () => undefined)
    const { rerender } = render(<PlanManagementSection {...callbacks({ onPause, onSetPauseEnd })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    fireEvent.change(screen.getByLabelText('Pausieren bis (optional)'), {
      target: { value: '2026-09-19T10:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Pause bestätigen' }))
    await waitFor(() => expect(onPause).toHaveBeenCalledWith('2026-09-19T08:30:00.000Z'))

    const paused = timeline({
      pauses: [{
        id: 'pause-1',
        cycle_id: 'cycle-1',
        paused_at: '2026-09-18T10:00:00.000Z',
        ends_at: null,
      }],
    })
    rerender(<PlanManagementSection {...callbacks({ timeline: paused, onPause, onSetPauseEnd })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pausenende festlegen' }))
    fireEvent.change(screen.getByLabelText('Pausieren bis'), {
      target: { value: '2026-10-25T02:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Pausenende speichern' }))
    await waitFor(() => expect(onSetPauseEnd).toHaveBeenCalledWith('2026-10-25T00:30:00.000Z'))
  })

  it('rejects a DST-gap wall clock without closing the pause dialog', async () => {
    const onPause = vi.fn(async () => undefined)
    render(<PlanManagementSection {...callbacks({ onPause })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    fireEvent.change(screen.getByLabelText('Pausieren bis (optional)'), {
      target: { value: '2026-03-29T02:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Pause bestätigen' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Bitte versuche es erneut'))
    expect(onPause).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Plan pausieren' })).toBeTruthy()
  })

  it('does not let a canceled invalid pause value block ending the plan', async () => {
    const onEnd = vi.fn(async () => undefined)
    render(<PlanManagementSection {...callbacks({ onEnd })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    fireEvent.change(screen.getByLabelText('Pausieren bis (optional)'), {
      target: { value: '2026-03-29T02:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

    fireEvent.click(screen.getByRole('button', { name: 'Beenden' }))
    fireEvent.click(screen.getByRole('button', { name: 'Plan beenden' }))

    await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not let a canceled invalid pause value block removing a future version', async () => {
    const onRemoveFuture = vi.fn(async () => undefined)
    render(<PlanManagementSection {...callbacks({ onRemoveFuture })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    fireEvent.change(screen.getByLabelText('Pausieren bis (optional)'), {
      target: { value: '2026-03-29T02:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

    fireEvent.click(screen.getByRole('button', { name: 'Geplante Änderung vom 21.09.2026 entfernen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Änderung entfernen' }))

    await waitFor(() => expect(onRemoveFuture).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('describes a pause neutrally without due, missed, or skipped language', () => {
    const paused = timeline({
      pauses: [{
        id: 'pause-1',
        cycle_id: 'cycle-1',
        paused_at: '2026-09-18T10:00:00.000Z',
        ends_at: null,
      }],
    })
    render(<PlanManagementSection {...callbacks({ timeline: paused })} />)

    expect(screen.getByText('Während der Pause ist keine Einnahme fällig.')).toBeTruthy()
    expect(screen.getByTestId('plan-management-cycle-1').textContent).not.toMatch(/verpasst|übersprungen/i)
    expect(screen.getByRole('button', { name: 'Fortsetzen' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pausenende festlegen' })).toBeTruthy()
  })

  it('shows ended plans as read-only history with restart as the only action', () => {
    const ended = timeline({
      cycle: {
        id: 'cycle-1',
        stack_item_id: 'stack-1',
        started_at: '2026-09-01T08:00:00.000Z',
        ended_at: '2026-09-18T08:00:00.000Z',
      },
    })
    render(<PlanManagementSection {...callbacks({ timeline: ended })} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.textContent).toContain('01.09.2026 – 18.09.2026')
    expect(section.textContent).toContain('18 Tage')
    expect(screen.getByText('Zuletzt')).toBeTruthy()
    expect(section.textContent).toContain('5 mg')
    // Die Stufe vom 21.09. lag nach dem Ende und galt nie.
    expect(section.textContent).not.toContain('10 mg')
    expect(screen.queryByText('Dosisverlauf')).toBeNull()
    expect(screen.getByRole('button', { name: 'Neu starten' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Plan anpassen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stufe hinzufügen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pausieren' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Beenden' })).toBeNull()
    expect(screen.queryByRole('button', { name: /bearbeiten/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /entfernen/i })).toBeNull()
  })

  it('never shows a step dated after the end, even once that date has passed', () => {
    const ended = timeline({
      cycle: {
        id: 'cycle-1',
        stack_item_id: 'stack-1',
        started_at: '2026-09-01T08:00:00.000Z',
        ended_at: '2026-09-18T08:00:00.000Z',
      },
      versions: [
        version('version-current', 5, '2026-09-01'),
        version('version-mid', 7, '2026-09-10'),
        version('version-future', 10, '2026-09-21'),
      ],
    })
    render(<PlanManagementSection {...callbacks({ timeline: ended, now: new Date('2026-09-25T08:00:00.000Z') })} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.textContent).toContain('Dosisverlauf')
    expect(section.textContent).toContain('7 mg')
    expect(section.textContent).not.toContain('10 mg')
    expect(section.textContent).not.toContain('gilt jetzt')
  })

  it('shows only the start date for a cycle ended before it began', () => {
    const neverRan = timeline({
      cycle: {
        id: 'cycle-1',
        stack_item_id: 'stack-1',
        started_at: '2026-09-30T22:00:00.000Z',
        ended_at: '2026-09-18T08:00:00.000Z',
        start_local_date: '2026-10-01',
      },
      versions: [version('version-planned', 5, '2026-10-01', { change_kind: 'initial' })],
    })
    render(<PlanManagementSection {...callbacks({ timeline: neverRan })} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.textContent).toContain('01.10.2026')
    expect(section.textContent).not.toContain('18.09.2026')
    expect(section.textContent).not.toMatch(/\d+ Tage?\b/)
  })

  it('keeps ended history visible while restart is pending and retryable after failure', async () => {
    let rejectRestart: ((error: Error) => void) | undefined
    const onRestart = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectRestart = reject }))
    const ended = timeline({
      cycle: {
        id: 'cycle-1',
        stack_item_id: 'stack-1',
        started_at: '2026-09-01T08:00:00.000Z',
        ended_at: '2026-09-18T08:00:00.000Z',
      },
    })
    render(<PlanManagementSection {...callbacks({ timeline: ended, onRestart })} />)

    const restart = screen.getByRole('button', { name: 'Neu starten' }) as HTMLButtonElement
    fireEvent.click(restart)
    expect(restart.disabled).toBe(true)
    expect(screen.getByText('Zuletzt')).toBeTruthy()

    rejectRestart?.(new Error('network'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Bitte versuche es erneut'))
    expect(restart.disabled).toBe(false)
    expect(screen.getByText('Zuletzt')).toBeTruthy()
  })

  it('treats a planned initial version as an editable future preview with its next intake', async () => {
    const planned = timeline({
      cycle: {
        id: 'cycle-1',
        stack_item_id: 'stack-1',
        started_at: '2026-09-20T08:00:00.000Z',
        ended_at: null,
      },
      versions: [version('version-planned', 5, '2026-09-20', { change_kind: 'initial' })],
    })
    render(<PlanManagementSection {...callbacks({ timeline: planned })} />)
    expect(screen.getByRole('button', { name: /Geplante Änderung.*entfernen/ }).getAttribute('aria-disabled')).toBe('true')

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.textContent).toContain('Geplant')
    expect(section.textContent).toContain('Morgen · 20:00')
    expect(within(section).getByRole('button', { name: 'Geplante Änderung vom 20.09.2026 bearbeiten' })).toBeTruthy()
    fireEvent.click(within(section).getByRole('button', { name: 'Geplante Änderung vom 20.09.2026 entfernen' }))
    expect(screen.queryByRole('dialog', { name: 'Geplante Änderung entfernen' })).toBeNull()
    expect(within(section).queryByRole('button', { name: 'Plan anpassen' })).toBeNull()
    // Eine Titration laesst sich schon vor dem Start anlegen.
    expect(within(section).getByRole('button', { name: 'Stufe hinzufügen' })).toBeTruthy()
  })

  it('adds a step after the last planned one, a week later by default', () => {
    const onAddStep = vi.fn()
    render(<PlanManagementSection {...callbacks({ onAddStep })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Stufe hinzufügen' }))
    // Letzte Stufe: 21.09. (geplant). Frühestens am Tag danach, vorgeschlagen eine Woche später.
    expect(onAddStep).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'version-future' }),
      { minDate: '2026-09-22', maxDate: null, defaultDate: '2026-09-28' },
    )
  })

  it('offers a step even with a single one, starting tomorrow at the earliest', () => {
    const onAddStep = vi.fn()
    const single = timeline({ versions: [version('version-current', 5, '2026-09-01')] })
    render(<PlanManagementSection {...callbacks({ timeline: single, onAddStep })} />)

    expect(screen.queryByText('Dosisverlauf')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stufe hinzufügen' }))
    expect(onAddStep).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'version-current' }),
      { minDate: '2026-09-20', maxDate: null, defaultDate: '2026-09-26' },
    )
  })

  it('keeps a new step inside a scheduled end, and offers none when no day is left', () => {
    const cycle = {
      id: 'cycle-1',
      stack_item_id: 'stack-1',
      started_at: '2026-09-01T08:00:00.000Z',
      ended_at: '2026-09-25T22:00:00.000Z',
      start_local_date: '2026-09-01',
      end_local_date: '2026-09-26',
    }
    const onAddStep = vi.fn()
    render(<PlanManagementSection {...callbacks({ timeline: timeline({ cycle }), onAddStep })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Stufe hinzufügen' }))
    // Letzte Stufe 21.09., letzter Zyklustag 25.09.: der Vorschlag (28.09.) wird aufs Ende gekürzt.
    expect(onAddStep).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'version-future' }),
      { minDate: '2026-09-22', maxDate: '2026-09-25', defaultDate: '2026-09-25' },
    )
    cleanup()

    const full = timeline({
      cycle,
      versions: [version('version-current', 5, '2026-09-01'), version('version-future', 10, '2026-09-25')],
    })
    render(<PlanManagementSection {...callbacks({ timeline: full })} />)
    expect(screen.queryByRole('button', { name: 'Stufe hinzufügen' })).toBeNull()
  })

  it('shows the cycle period with its running day and an open end', () => {
    render(<PlanManagementSection {...callbacks()} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.textContent).toContain('01.09.2026 – Ende offen')
    expect(section.textContent).toContain('Tag 19')
    expect(section.textContent).toContain('gilt seit 01.09.2026')
  })

  it('counts the running day against a scheduled end', () => {
    const scheduled = timeline({
      cycle: {
        id: 'cycle-1',
        stack_item_id: 'stack-1',
        started_at: '2026-09-01T08:00:00.000Z',
        ended_at: '2026-10-01T08:00:00.000Z',
        start_local_date: '2026-09-01',
        end_local_date: '2026-10-01',
      },
    })
    render(<PlanManagementSection {...callbacks({ timeline: scheduled })} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.textContent).toContain('01.09.2026 – 30.09.2026')
    expect(section.textContent).toContain('Tag 19 von 30')
  })

  it('lists every intake time with its own weekdays and dose', () => {
    const twoSlots = timeline({
      versions: [version('version-current', 5, '2026-09-01', {
        intake_time: 'morgens,abends',
        intake_time_custom: '08:00,20:00',
        slot_doses: '500,250',
        slot_days: ',Mo|Mi|Fr',
        unit: 'mcg',
      })],
    })
    render(<PlanManagementSection {...callbacks({ timeline: twoSlots })} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    const rows = within(section).getAllByRole('listitem')
    expect(rows[0].textContent).toContain('Morgens · 08:00')
    expect(rows[0].textContent).toContain('500 mcg')
    expect(rows[1].textContent).toContain('Abends · 20:00')
    expect(rows[1].textContent).toContain('250 mcg')
    expect(rows[1].textContent).toContain('Mo, Mi, Fr')
    expect(section.textContent).toContain('2 Einnahmezeiten')
    // Eine einzige Stufe steht schon oben.
    expect(screen.queryByText('Dosisverlauf')).toBeNull()
  })

  it('zeigt bei bestimmten Wochentagen je Tag eine Zeile, der Tag zuerst', () => {
    // TestoE: Montag abends, Freitag morgens. Vorher stand die Tageszeit
    // zuerst und der Tag als Leiste darunter.
    const proTag = timeline({
      versions: [version('version-current', 125, '2026-09-01', {
        frequency: 'weekdays',
        schedule_days: ['Mo', 'Fr'],
        intake_time: 'abends,morgens',
        intake_time_custom: ',',
        slot_doses: '125,125',
        slot_days: 'Mo,Fr',
        unit: 'mg',
      })],
    })
    render(<PlanManagementSection {...callbacks({ timeline: proTag })} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    const tage = [...section.querySelectorAll('[data-plan-day]')]
    expect(tage.map(tag => tag.getAttribute('data-plan-day'))).toEqual(['Mo', 'Fr'])
    expect(tage[0].textContent).toContain('Abends')
    expect(tage[1].textContent).toContain('Morgens')
    // Ohne eigene Uhrzeit keine erfundene Standardzeit.
    expect(tage[0].textContent).not.toMatch(/\d{2}:\d{2}/)
    expect(tage[1].textContent).toContain('125 mg')
  })

  it('shows the whole plan in every step and marks what changed', () => {
    const slots = {
      intake_time: 'morgens,abends',
      intake_time_custom: '08:00,20:00',
      slot_days: ',Mo|Mi|Fr',
      unit: 'mcg',
    }
    const titrated = timeline({
      versions: [
        version('version-current', 250, '2026-07-15', { ...slots, slot_doses: '250,250' }),
        version('version-step', 500, '2026-09-01', { ...slots, slot_doses: '500,250', change_kind: 'titration' }),
        version('version-future', 750, '2026-10-01', { ...slots, slot_doses: '750,250' }),
      ],
    })
    render(<PlanManagementSection {...callbacks({ timeline: titrated })} />)

    expect(screen.getByText('Dosisverlauf')).toBeTruthy()
    const steps = within(screen.getByText('Dosisverlauf').closest('div')!.parentElement!).getAllByRole('listitem')
      .filter(item => item.parentElement?.tagName === 'OL')
    expect(steps).toHaveLength(3)

    expect(steps[0].textContent).toContain('15.07.2026 · Start')
    expect(steps[0].textContent).not.toContain('gleich')

    expect(steps[1].textContent).toContain('01.09.2026 · Titration')
    expect(steps[1].textContent).toContain('gilt jetzt')
    expect(steps[1].textContent).toContain('250 mcg →500 mcg')
    expect(steps[1].textContent).toContain('erhöht')
    expect(steps[1].textContent).toContain('Abends · 20:00')
    expect(steps[1].textContent).toContain('gleich')

    expect(steps[2].textContent).toContain('geplant')
    expect(steps[2].textContent).toContain('500 mcg →750 mcg')
    expect(within(steps[2]).getByRole('button', { name: 'Geplante Änderung vom 01.10.2026 bearbeiten' })).toBeTruthy()
  })

  it('marks an added and a dropped intake time', () => {
    const changed = timeline({
      versions: [
        version('version-current', 5, '2026-08-01', { intake_time: 'morgens', intake_time_custom: '08:00' }),
        version('version-step', 5, '2026-09-01', { intake_time: 'abends', intake_time_custom: '20:00', change_kind: 'schedule' }),
      ],
    })
    render(<PlanManagementSection {...callbacks({ timeline: changed })} />)

    const history = screen.getByText('Dosisverlauf').closest('div')!.parentElement!
    expect(history.textContent).toContain('neu')
    expect(history.textContent).toContain('entfällt')
  })

  it.each([
    {
      label: 'interval',
      changes: { frequency: 'interval', x_days_interval: 10, interval_unit: 'week' },
      expected: 'Alle 10 Wochen',
    },
    {
      label: 'weekdays',
      changes: { frequency: 'weekdays', schedule_days: ['Mo', 'Mi'] },
      expected: 'Mo, Mi',
    },
    {
      label: 'cycle',
      changes: { frequency: 'cycle', cycle_on_days: 5, cycle_off_days: 2 },
      expected: '5 Tage an, 2 Tage Pause',
    },
  ])('shows the complete $label rhythm summary', ({ changes, expected }) => {
    const detailed = timeline({
      versions: [version('version-current', 5, '2026-09-01', changes)],
    })
    render(<PlanManagementSection {...callbacks({ timeline: detailed })} />)

    expect(screen.getByTestId('plan-management-cycle-1').textContent).toContain(expected)
  })

  it('portals confirmations to the viewport and restores focus after Escape', async () => {
    const { container } = render(<PlanManagementSection {...callbacks()} />)
    const pause = screen.getByRole('button', { name: 'Pausieren' })
    pause.focus()
    fireEvent.click(pause)

    const dialog = screen.getByRole('dialog', { name: 'Plan pausieren' })
    const input = screen.getByLabelText('Pausieren bis (optional)')
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect(container.contains(dialog)).toBe(false)
    expect((container as HTMLElement).inert).toBe(true)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Plan pausieren' })).toBeNull())
    expect(document.activeElement).toBe(pause)
    expect((container as HTMLElement).inert).not.toBe(true)
  })

  it('contains focus and disables the pause input throughout a pending mutation', async () => {
    let resolvePause: (() => void) | undefined
    const onPause = vi.fn(() => new Promise<void>(resolve => { resolvePause = resolve }))
    render(<PlanManagementSection {...callbacks({ onPause })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    const dialog = screen.getByRole('dialog', { name: 'Plan pausieren' })
    const input = screen.getByLabelText('Pausieren bis (optional)') as HTMLInputElement
    const confirm = screen.getByRole('button', { name: 'Pause bestätigen' }) as HTMLButtonElement
    const cancel = screen.getByRole('button', { name: 'Abbrechen' }) as HTMLButtonElement
    const close = screen.getByRole('button', { name: 'Schließen' })

    confirm.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    close.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)

    fireEvent.click(confirm)
    expect(input.disabled).toBe(true)
    expect(confirm.disabled).toBe(true)
    expect(cancel.disabled).toBe(true)
    resolvePause?.()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Plan pausieren' })).toBeNull())
  })

  it('keeps duplicate-looking timelines independent by cycle identity', () => {
    const firstAdjust = vi.fn()
    const secondAdjust = vi.fn()
    const second = timeline({
      cycle: {
        id: 'cycle-2',
        stack_item_id: 'stack-2',
        started_at: '2026-09-01T08:00:00.000Z',
        ended_at: null,
      },
      versions: [version('second-current', 5, '2026-09-01', { cycle_id: 'cycle-2' })],
    })

    render(
      <>
        <PlanManagementSection {...callbacks({ onAdjustPlan: firstAdjust })} />
        <PlanManagementSection {...callbacks({ timeline: second, onAdjustPlan: secondAdjust })} />
      </>,
    )

    fireEvent.click(within(screen.getByTestId('plan-management-cycle-2')).getByRole('button', {
      name: 'Plan anpassen',
    }))
    expect(secondAdjust).toHaveBeenCalledWith(expect.objectContaining({ cycle_id: 'cycle-2' }))
    expect(firstAdjust).not.toHaveBeenCalled()
  })
})
