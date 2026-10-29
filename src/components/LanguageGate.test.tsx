// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setLanguage = vi.fn()

vi.mock('../i18n', () => ({
  LANGUAGES: [
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
  ],
  setLanguage: (code: string) => setLanguage(code),
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en-US' }, t: (key: string) => key }) }))

const { LanguageGate } = await import('./LanguageGate')

beforeEach(() => {
  localStorage.clear()
  setLanguage.mockClear()
})
afterEach(cleanup)

describe('LanguageGate', () => {
  it('bietet beim ersten Start genau Deutsch und Englisch an, Gerätesprache vorgewählt', () => {
    render(<LanguageGate />)
    const optionen = screen.getAllByRole('radio')
    expect(optionen.map(o => o.textContent)).toEqual(['🇩🇪Deutsch', '🇬🇧English'])
    expect(screen.getByRole('radio', { name: /English/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('wechselt sofort und merkt sich die Wahl pro Nutzer', () => {
    render(<LanguageGate />)
    fireEvent.click(screen.getByRole('radio', { name: /Deutsch/ }))
    expect(setLanguage).toHaveBeenLastCalledWith('de')

    fireEvent.click(screen.getByText('lang_gate_continue'))
    expect(setLanguage).toHaveBeenLastCalledWith('de')
    expect(localStorage.getItem('tyd_lang_picked_u1')).toBe('1')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('bleibt weg, wenn schon gewählt wurde', () => {
    localStorage.setItem('tyd_lang_picked_u1', '1')
    render(<LanguageGate />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
