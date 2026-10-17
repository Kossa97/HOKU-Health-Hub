// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MetricChange } from '../../types'
import { TopChangesSection } from './TopChangesSection'

afterEach(cleanup)

const change = (key: string, delta: number, unit = 'kg'): MetricChange => ({ key, label: key, unit, from: 10, to: 10 + delta, delta, rank: 0 })
const props = {
  hasAnyData: true,
  hasEnoughForTrend: true,
  seriesFor: () => [{ date: '2026-01-01', value: 1 }, { date: '2026-01-02', value: 2 }],
  colorFor: () => '#f59e0b',
}

describe('TopChangesSection (Wisch-Karten)', () => {
  it('nur Karten mit Wirkung sind Knöpfe; Antippen wählt den Messwert', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <TopChangesSection {...props} changes={[change('weight', -3), change('energie', 2, '/10')]} onSelect={onSelect} canSelect={k => k !== 'energie'} />,
    )
    const cards = [...container.querySelectorAll('.fg-chg')]
    expect(cards.map(c => c.tagName)).toEqual(['BUTTON', 'DIV'])
    fireEvent.click(cards[0])
    expect(onSelect).toHaveBeenCalledWith('weight')
    expect(container.querySelectorAll('.fg-dots > i')).toHaveLength(2)
  })

  it('zeigt die Leer-Zustände statt Karten', () => {
    const { getByText, rerender } = render(<TopChangesSection {...props} changes={[]} hasAnyData={false} />)
    expect(getByText('fortschritt_no_values_title')).toBeTruthy()
    rerender(<TopChangesSection {...props} changes={[]} hasEnoughForTrend={false} />)
    expect(getByText('fortschritt_little_data_title')).toBeTruthy()
    rerender(<TopChangesSection {...props} changes={[]} />)
    expect(getByText('fortschritt_stable_title')).toBeTruthy()
  })
})
