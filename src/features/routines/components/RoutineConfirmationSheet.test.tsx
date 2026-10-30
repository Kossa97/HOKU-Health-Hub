// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoutineConfirmationEntry, RoutineGroupModel, RoutineIntake } from '../intakeGroups'
import { RoutineConfirmationSheet } from './RoutineConfirmationSheet'
import { InventoryConfirmationError } from '../../my-stack/services/stackInventory'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      let value = typeof options?.defaultValue === 'string' ? options.defaultValue : key
      for (const [name, replacement] of Object.entries(options ?? {})) {
        if (name !== 'defaultValue') value = value.replace(`{{${name}}}`, String(replacement))
      }
      return value
    },
    i18n: { language: 'de' },
  }),
}))

function intake(overrides: Partial<RoutineIntake> = {}): RoutineIntake {
  return {
    key: 'd3',
    cycleId: 'cycle-d3',
    planVersionId: null,
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
    ...overrides,
  }
}

function group(): RoutineGroupModel {
  return {
    key: 'morning',
    items: [
      intake(),
      intake({
        key: 'zinc',
        cycleId: 'cycle-zinc',
        stackItemId: 'stack-zinc',
        stackItemName: 'Zink',
        trackingLevel: 'with_amount',
        dose: 25,
        unit: 'mg',
      }),
      intake({
        key: 'testosterone',
        cycleId: 'cycle-testosterone',
        stackItemId: 'stack-testosterone',
        stackItemName: 'Testosteron',
        trackingLevel: 'complete',
        dose: 100,
        unit: 'mg',
        method: 'Subkutan',
        injectable: true,
      }),
    ],
  }
}

afterEach(cleanup)

describe('RoutineConfirmationSheet', () => {
  it('starts every entry selected and lets a user deselect one', () => {
    render(<RoutineConfirmationSheet group={group()} onClose={() => undefined} onConfirm={async () => []} />)

    const d3 = screen.getByRole('checkbox', { name: 'Vitamin D3 auswählen' }) as HTMLInputElement
    const zinc = screen.getByRole('checkbox', { name: 'Zink auswählen' }) as HTMLInputElement
    const testosterone = screen.getByRole('checkbox', { name: 'Testosteron auswählen' }) as HTMLInputElement
    expect([d3.checked, zinc.checked, testosterone.checked]).toEqual([true, true, true])

    fireEvent.click(zinc)
    expect(zinc.checked).toBe(false)
  })

  it('shows planned amounts and offers a one-off deviation only for quantified entries', () => {
    render(<RoutineConfirmationSheet group={group()} onClose={() => undefined} onConfirm={async () => []} />)

    expect(screen.getAllByRole('button', { name: 'Einmalige Abweichung' })).toHaveLength(2)
    expect(screen.getByText('25 mg')).toBeTruthy()
    expect(screen.getByText('100 mg')).toBeTruthy()
    expect(screen.queryByText('Menge nicht getrackt')).toBeNull()
    expect(screen.queryByLabelText('Menge für Vitamin D3')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Einmalige Abweichung' })[0])
    expect((screen.getByLabelText('Menge für Zink') as HTMLInputElement).value).toBe('25')
  })

  it('marks a one-off change and recalculates the syringe units from it', () => {
    const einheitenFuer = vi.fn((stackItemId: string, dose: number | null) => (
      stackItemId === 'stack-testosterone' && dose != null ? dose / 10 : null
    ))
    render(<RoutineConfirmationSheet group={group()} onClose={() => undefined} onConfirm={async () => []} einheitenFuer={einheitenFuer} />)

    expect(screen.getByText('10 Einheiten aufziehen')).toBeTruthy()
    expect(screen.queryByText('einmalig')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Einmalige Abweichung' })[1])
    fireEvent.change(screen.getByLabelText('Menge für Testosteron'), { target: { value: '120' } })
    expect(screen.getByText('12 Einheiten aufziehen')).toBeTruthy()
    expect(screen.getByText('einmalig')).toBeTruthy()
    // Die geplante Menge bleibt durchgestrichen stehen.
    expect(screen.getByText('100 mg').tagName).toBe('S')
    expect(screen.getByText('120 mg')).toBeTruthy()

    // Zurück auf den Plan: kein „einmalig" mehr, Einheiten wieder wie geplant.
    fireEvent.click(screen.getAllByRole('button', { name: 'Einmalige Abweichung' })[1])
    expect(screen.queryByText('einmalig')).toBeNull()
    expect(screen.getByText('10 Einheiten aufziehen')).toBeTruthy()
  })

  it('submits an actual-dose override without mutating the planned intake', async () => {
    const plannedGroup = group()
    const onConfirm = vi.fn(async (_entries: RoutineConfirmationEntry[]) => ['log-d3', 'log-zinc', 'log-testosterone'])
    render(<RoutineConfirmationSheet group={plannedGroup} onClose={() => undefined} onConfirm={onConfirm} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Einmalige Abweichung' })[0])
    fireEvent.change(screen.getByLabelText('Menge für Zink'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Alle als eingenommen markieren' }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm.mock.calls[0][0].find(item => item.key === 'zinc')).toMatchObject({
      dose: 25,
      actualDose: 30,
    })
    expect(plannedGroup.items.find(item => item.key === 'zinc')?.dose).toBe(25)
  })

  it('restores the planned quantity when the one-off editor is collapsed', async () => {
    const onConfirm = vi.fn(async (_entries: RoutineConfirmationEntry[]) => ['log-d3', 'log-zinc', 'log-testosterone'])
    render(<RoutineConfirmationSheet group={group()} onClose={() => undefined} onConfirm={onConfirm} />)

    const deviationButton = screen.getAllByRole('button', { name: 'Einmalige Abweichung' })[0]
    fireEvent.click(deviationButton)
    fireEvent.change(screen.getByLabelText('Menge für Zink'), { target: { value: '30' } })
    fireEvent.click(deviationButton)
    fireEvent.click(screen.getByRole('button', { name: 'Alle als eingenommen markieren' }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm.mock.calls[0][0].find(item => item.key === 'zinc')).toMatchObject({
      dose: 25,
      unit: 'mg',
      actualDose: 25,
      actualUnit: 'mg',
    })
  })

  it('confirms without requiring an injection site and exposes site tracking afterward', async () => {
    const onConfirm = vi.fn(async (_entries: RoutineConfirmationEntry[]) => ['log-d3', 'log-zinc', 'log-testosterone'])
    const onAddInjection = vi.fn()
    render(
      <RoutineConfirmationSheet
        group={group()}
        onClose={() => undefined}
        onConfirm={onConfirm}
        onAddInjection={onAddInjection}
      />,
    )

    const confirmButton = screen.getByRole('button', { name: 'Alle als eingenommen markieren' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(false)
    expect(screen.queryByRole('button', { name: /Injektionsstelle ergänzen/ })).toBeNull()

    fireEvent.click(confirmButton)

    const injectionButton = await screen.findByRole('button', { name: 'Injektionsstelle ergänzen für Testosteron' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm.mock.calls[0][0]).toHaveLength(3)
    fireEvent.click(injectionButton)
    expect(onAddInjection).toHaveBeenCalledWith(expect.objectContaining({ key: 'testosterone' }), 'log-testosterone')
  })

  it('preserves edits and selections after a failed save and retries the same local state', async () => {
    const onConfirm = vi.fn(async (_entries: RoutineConfirmationEntry[]) => ['log-d3', 'log-zinc'])
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(['log-d3', 'log-zinc'])
    render(<RoutineConfirmationSheet group={group()} onClose={() => undefined} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Testosteron auswählen' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Einmalige Abweichung' })[0])
    const amount = screen.getByLabelText('Menge für Zink') as HTMLInputElement
    fireEvent.change(amount, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Alle als eingenommen markieren' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Gruppe konnte nicht gespeichert werden.')
    expect((screen.getByRole('checkbox', { name: 'Testosteron auswählen' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('Menge für Zink') as HTMLInputElement).value).toBe('30')

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2))
    const retriedEntries = onConfirm.mock.calls[1][0]
    expect(retriedEntries.find((item: { key: string }) => item.key === 'zinc')).toMatchObject({ actualDose: 30 })
    expect(retriedEntries.find((item: { key: string }) => item.key === 'testosterone')).toMatchObject({ selected: false })
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).toBeNull()
  })

  it('never offers an RPC retry after commit when post-confirm work rejects', async () => {
    const onConfirm = vi.fn(async (_entries: RoutineConfirmationEntry[]) => [
      'log-d3',
      'log-zinc',
      'log-testosterone',
    ])
    const onAfterConfirm = vi.fn(async () => {
      throw new Error('reload failed')
    })
    render(
      <RoutineConfirmationSheet
        group={group()}
        onClose={() => undefined}
        onConfirm={onConfirm}
        onAfterConfirm={onAfterConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Alle als eingenommen markieren' }))

    expect(await screen.findByText('Routine gespeichert')).toBeTruthy()
    await waitFor(() => expect(onAfterConfirm).toHaveBeenCalledTimes(1))
    expect(onAfterConfirm).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ key: 'd3' })]),
      ['log-d3', 'log-zinc', 'log-testosterone'],
    )
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('retries only inventory after a committed group when inventory application fails', async () => {
    const onConfirm = vi.fn(async (_entries: RoutineConfirmationEntry[]) => [
      'log-d3',
      'log-zinc',
      'log-testosterone',
    ])
    const onAfterConfirm = vi.fn(async () => undefined)
      .mockRejectedValueOnce(new InventoryConfirmationError(['log-zinc']))
    render(
      <RoutineConfirmationSheet
        group={group()}
        onClose={() => undefined}
        onConfirm={onConfirm}
        onAfterConfirm={onAfterConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Alle als eingenommen markieren' }))

    expect(await screen.findByText('Routine gespeichert')).toBeTruthy()
    const retry = await screen.findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(onConfirm).toHaveBeenCalledTimes(1)

    fireEvent.click(retry)
    await waitFor(() => expect(onAfterConfirm).toHaveBeenCalledTimes(2))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Bestand erneut versuchen' })).toBeNull())
  })
})
