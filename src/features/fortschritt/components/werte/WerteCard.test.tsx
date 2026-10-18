// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { DailyLogEntry } from '../../types'
import { WerteCard } from './WerteCard'

afterEach(cleanup)

const log = (log_date: string, v: number, body_fat_pct: number | null = null): DailyLogEntry => ({
  log_date, energie: v, schlaf: v, wohlbefinden: v, libido: null, body_fat_pct,
})
const range = { from: '2026-03-01', to: '2026-03-28' }
const logs = [
  log('2026-03-02', 4, 20), log('2026-03-05', 5, 20), log('2026-03-09', 5),
  log('2026-03-16', 7, 19), log('2026-03-20', 8, 19), log('2026-03-27', 8),
]

describe('WerteCard (Ringe)', () => {
  it('zeigt vier Ringe; ohne Daten bleibt der Ring leer', () => {
    const { getAllByRole, container } = render(<WerteCard dailyLogs={logs} range={range} />)
    expect(getAllByRole('button')).toHaveLength(4)
    const empty = [...container.querySelectorAll('.fg-rv')].map(r => r.getAttribute('data-empty'))
    expect(empty).toEqual(['false', 'false', 'false', 'true'])
  })

  it('Antippen klappt die letzten 14 Tage auf, erneutes Antippen zu', () => {
    const { getAllByRole, container } = render(<WerteCard dailyLogs={logs} range={range} />)
    const [energie] = getAllByRole('button')
    fireEvent.click(energie)
    expect(energie.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelectorAll('.fg-rd-bars > i')).toHaveLength(14)
    expect(container.querySelector('.fg-ring-more')?.getAttribute('data-open')).toBe('true')
    fireEvent.click(energie)
    expect(energie.getAttribute('aria-expanded')).toBe('false')
  })

  it('führt den Körperfett-Durchschnitt unter den Ringen weiter', () => {
    const { container } = render(<WerteCard dailyLogs={logs} range={range} />)
    expect(container.querySelector('.fg-ring-foot')?.textContent).toContain('19,0 %')
  })
})
