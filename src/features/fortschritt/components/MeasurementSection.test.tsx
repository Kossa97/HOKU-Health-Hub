// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BodyMeasurementEntry } from '../types'
import { MeasurementSection } from './MeasurementSection'

afterEach(cleanup)

const entries: BodyMeasurementEntry[] = [
  { measured_on: '2026-10-01', site: 'waist', value_cm: 88.5 },
  { measured_on: '2026-10-20', site: 'waist', value_cm: 86 },
]

function renderSection(over: Partial<Parameters<typeof MeasurementSection>[0]> = {}) {
  const props = {
    sites: ['waist' as const],
    entries,
    date: '2026-10-31',
    typed: {},
    onTyped: vi.fn(),
    onSitesChange: vi.fn() as Parameters<typeof MeasurementSection>[0]['onSitesChange'],
    ...over,
  }
  return { props, ...render(<MeasurementSection {...props} />) }
}

describe('MeasurementSection', () => {
  it('zeigt den letzten Wert nur als Platzhalter, das Feld bleibt leer', () => {
    const { getByLabelText } = renderSection()
    const input = getByLabelText('umfang_waist') as HTMLInputElement
    expect(input.value).toBe('')
    expect(input.placeholder).toContain('86')
    expect(input.placeholder).not.toContain('88')
  })

  it('zeigt für ein Datum mit gespeichertem Wert diesen Wert, nicht den davor', () => {
    const { getByLabelText } = renderSection({ date: '2026-10-20' })
    const input = getByLabelText('umfang_waist') as HTMLInputElement
    expect(input.placeholder).toContain('86')
    expect(input.placeholder).not.toContain('88')
  })

  it('meldet getippten Text an den Eintrag', () => {
    const { getByLabelText, props } = renderSection()
    fireEvent.change(getByLabelText('umfang_waist'), { target: { value: '85,5' } })
    expect(props.onTyped).toHaveBeenCalledWith('waist', '85,5')
  })

  it('ungültige Eingabe zeigt umfaenge_invalid, gültige nicht', () => {
    const bad = renderSection({ typed: { waist: '5' } })
    expect(bad.getByText('umfaenge_invalid')).toBeTruthy()
    cleanup()
    const good = renderSection({ typed: { waist: '85,5' } })
    expect(good.queryByText('umfaenge_invalid')).toBeNull()
  })

  it('ohne gewählte Stellen nur der Knopf zur Auswahl, keine Felder', () => {
    const { getByRole, queryByRole } = renderSection({ sites: [] })
    expect(getByRole('button', { name: 'umfaenge_choose_sites' })).toBeTruthy()
    expect(queryByRole('textbox')).toBeNull()
  })

  it('Auswahl bietet alle neun Stellen und meldet die neue Wahl', () => {
    const { getByRole, getAllByRole, props } = renderSection({ sites: [] })
    fireEvent.click(getByRole('button', { name: 'umfaenge_choose_sites' }))
    expect(getAllByRole('checkbox')).toHaveLength(9)
    fireEvent.click(getByRole('checkbox', { name: 'umfang_chest' }))
    expect(props.onSitesChange).toHaveBeenCalledWith(['chest'])
  })

  it('ohne geladene Wahl (onSitesChange null) ist die Auswahl gesperrt', () => {
    const { getByRole, queryAllByRole } = renderSection({ sites: [], onSitesChange: null })
    const knopf = getByRole('button', { name: 'umfaenge_choose_sites' }) as HTMLButtonElement
    expect(knopf.disabled).toBe(true)
    fireEvent.click(knopf)
    expect(queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('Abwählen entfernt die Stelle aus der Wahl', () => {
    const { getByRole, props } = renderSection({ sites: ['waist', 'chest'] })
    fireEvent.click(getByRole('button', { name: 'umfaenge_choose_sites' }))
    fireEvent.click(getByRole('checkbox', { name: 'umfang_waist' }))
    expect(props.onSitesChange).toHaveBeenCalledWith(['chest'])
  })

  it('ist einklappbar', () => {
    const { getByRole, queryByLabelText } = renderSection()
    const toggle = getByRole('button', { name: /umfaenge_title/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(queryByLabelText('umfang_waist')).toBeNull()
  })
})
