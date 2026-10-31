// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const eq = vi.fn()
const update = vi.fn(() => ({ eq }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: () => ({ update }) } }))
const toastError = vi.fn()
vi.mock('react-hot-toast', () => ({ default: { error: (m: string) => toastError(m), success: vi.fn() } }))

import type { GoalTag } from '../lib/profileFields'
import { UeberDichKarte } from './UeberDichKarte'

beforeEach(() => {
  // jsdom kennt scrollTo nicht (GlassSegmented holt die Auswahl damit in die Mitte)
  Element.prototype.scrollTo = vi.fn()
  eq.mockReset(); update.mockClear(); toastError.mockClear()
  eq.mockResolvedValue({ error: null })
})
afterEach(cleanup)

function renderKarte(over: Partial<Parameters<typeof UeberDichKarte>[0]> = {}) {
  const props = { userId: 'u1', goals: ['kraft'] as GoalTag[], country: null, gender: null, onChange: vi.fn(), ...over }
  return { props, ...render(<UeberDichKarte {...props} />) }
}

describe('UeberDichKarte', () => {
  it('zeigt alle neun Ziele in einer einzigen waagerecht scrollbaren Zeile', () => {
    const { container, getByText } = renderKarte()
    const zeile = container.querySelector<HTMLElement>('[data-goals-row]')!
    expect(zeile.style.overflowX).toBe('auto')
    expect(zeile.querySelectorAll('button')).toHaveLength(9)
    expect(getByText('ziel_kraft').getAttribute('aria-pressed')).toBe('true')
    expect(getByText('ziel_schlaf').getAttribute('aria-pressed')).toBe('false')
  })

  it('Tippen fuegt ein Ziel hinzu und speichert sofort die ganze Liste', async () => {
    const { getByText, props } = renderKarte()
    fireEvent.click(getByText('ziel_schlaf'))
    expect(props.onChange).toHaveBeenCalledWith({ goals: ['kraft', 'schlaf'] })
    expect(update).toHaveBeenCalledWith({ goals: ['kraft', 'schlaf'] })
    await waitFor(() => expect(eq).toHaveBeenCalledWith('id', 'u1'))
  })

  it('nochmal Tippen nimmt das Ziel wieder heraus, auch das letzte', () => {
    const { getByText, props } = renderKarte()
    fireEvent.click(getByText('ziel_kraft'))
    expect(props.onChange).toHaveBeenCalledWith({ goals: [] })
    expect(update).toHaveBeenCalledWith({ goals: [] })
  })

  it('Fehler beim Speichern: Toast und alter Stand zurueck', async () => {
    eq.mockResolvedValue({ error: { message: 'x' } })
    const { getByText, props } = renderKarte()
    fireEvent.click(getByText('ziel_schlaf'))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('fehler_speichern'))
    expect(props.onChange).toHaveBeenLastCalledWith({ goals: ['kraft'] })
  })

  it('Geschlecht speichert profile_gender und fasst bio_sex nicht an', async () => {
    const { getByRole, props } = renderKarte()
    fireEvent.click(getByRole('button', { name: 'geschlecht_female' }))
    expect(props.onChange).toHaveBeenCalledWith({ profile_gender: 'female' })
    expect(update).toHaveBeenCalledWith({ profile_gender: 'female' })
    expect(JSON.stringify(update.mock.calls)).not.toContain('bio_sex')
  })

  it('Keine Angabe schreibt null', () => {
    const { getByRole, props } = renderKarte({ gender: 'male' })
    fireEvent.click(getByRole('button', { name: 'geschlecht_none' }))
    expect(props.onChange).toHaveBeenCalledWith({ profile_gender: null })
    expect(update).toHaveBeenCalledWith({ profile_gender: null })
  })

  it('Land: Sheet mit Suche, Keine Angabe zuerst, Auswahl speichert den Code', () => {
    const { getByRole, getAllByRole, getByPlaceholderText, props } = renderKarte()
    fireEvent.click(getByRole('button', { name: /profil_land/ }))
    const eintraege = Array.from(document.querySelectorAll('[data-country-option]'))
    expect(eintraege[0].getAttribute('data-country-option')).toBe('')
    fireEvent.change(getByPlaceholderText('profil_land_suchen'), { target: { value: 'Germany' } })
    fireEvent.click(getAllByRole('button').find(b => b.getAttribute('data-country-option') === 'DE')!)
    expect(props.onChange).toHaveBeenCalledWith({ country: 'DE' })
    expect(update).toHaveBeenCalledWith({ country: 'DE' })
  })

  it('Land: Keine Angabe schreibt null', () => {
    const { getByRole, getAllByRole, props } = renderKarte({ country: 'DE' })
    fireEvent.click(getByRole('button', { name: /profil_land/ }))
    fireEvent.click(getAllByRole('button').find(b => b.getAttribute('data-country-option') === '')!)
    expect(props.onChange).toHaveBeenCalledWith({ country: null })
    expect(update).toHaveBeenCalledWith({ country: null })
  })
})
