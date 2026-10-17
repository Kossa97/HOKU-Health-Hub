// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FortschrittHeader } from './FortschrittHeader'

afterEach(cleanup)

describe('FortschrittHeader', () => {
  it('lädt ohne heutigen Eintrag mit dem getönten Glas-Knopf ein — erst wenn die Daten da sind', () => {
    const { getByRole, rerender } = render(<FortschrittHeader rangeLabel="x" onLogToday={() => {}} />)
    const button = getByRole('button', { name: 'fortschritt_log_today' })
    expect(button.className).toContain('lg-btn-tint')
    expect(button.getAttribute('data-invite')).toBe('false')
    rerender(<FortschrittHeader rangeLabel="x" onLogToday={() => {}} dataReady />)
    expect(getByRole('button', { name: 'fortschritt_log_today' }).getAttribute('data-invite')).toBe('true')
  })

  it('mit heutigem Eintrag: erledigt-Hinweis und Glas-Knopf zum Bearbeiten', () => {
    const { getByRole, getByText } = render(<FortschrittHeader rangeLabel="x" onLogToday={() => {}} hasTodayEntry />)
    expect(getByText('fortschritt_done')).toBeTruthy()
    expect(getByRole('button', { name: 'fortschritt_edit_today' }).className).toContain('lg-btn-glass')
  })
})
