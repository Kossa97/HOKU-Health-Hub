// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CycleSubstance } from '../../types'
import { CycleChips } from './CycleChips'
import { substancesInRange } from '../../lib/cycleSubstances'

afterEach(cleanup)

const cycle = (id: string, stackItemId: string, name: string, startDate: string, endDate: string | null): CycleSubstance => ({
  id, stackItemId, name, startDate, endDate, active: endDate == null, mode: 'cycle', color: '#3987e5',
})

describe('substancesInRange', () => {
  it('fasst Zyklen derselben Substanz zu einem Chip zusammen und lässt Zyklen außerhalb weg', () => {
    const result = substancesInRange([
      cycle('1', 'ipa', 'Ipamorelin', '2026-01-01', '2026-02-01'),
      cycle('2', 'ipa', 'Ipamorelin', '2026-03-01', null),
      cycle('3', 'mk', 'MK-677', '2025-01-01', '2025-03-01'),
    ], { from: '2026-01-15', to: '2026-04-01' })
    expect(result.map(s => [s.id, s.cycles.length])).toEqual([['ipa', 2]])
  })
})

describe('CycleChips', () => {
  const substances = [
    { id: 'a', name: 'BPC-157', color: '#3987e5', cycles: [cycle('1', 'a', 'BPC-157', '2026-01-01', null)] },
    { id: 'b', name: 'TB-500', color: '#d95926', cycles: [cycle('2', 'b', 'TB-500', '2026-01-10', '2026-02-10')] },
  ]

  it('zeigt anfangs keinen Zyklus an und weist mit dem ersten Chip darauf hin', () => {
    const { getAllByRole } = render(<CycleChips substances={substances} selected={new Set()} hint onToggle={() => {}} />)
    const chips = getAllByRole('button')
    expect(chips.map(c => c.getAttribute('aria-pressed'))).toEqual(['false', 'false'])
    expect(chips.map(c => c.getAttribute('data-hint'))).toEqual(['true', 'false'])
  })

  it('meldet das Antippen und zeigt die Auswahl', () => {
    const onToggle = vi.fn()
    const { getByRole } = render(<CycleChips substances={substances} selected={new Set(['b'])} hint={false} onToggle={onToggle} />)
    const tb = getByRole('button', { name: /TB-500/ })
    expect(tb.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(getByRole('button', { name: /BPC-157/ }))
    expect(onToggle).toHaveBeenCalledWith('a')
  })
})
