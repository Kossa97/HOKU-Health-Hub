// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfileViewFields } from '../lib/profileView'
import { ProfilKarten } from './ProfilKarten'
import { SichtbarkeitsChip } from './SichtbarkeitsChip'

afterEach(cleanup)

const voll: ProfileViewFields = {
  age: { v: 29 }, height: { v: 172, unit: 'cm' }, weight: { v: 81, unit: 'kg' },
  body_fat: { v: 15.8, unit: '%' },
  markers: { count: 24 },
  workouts: { total: 86, perWeek: 3.6 }, routine: { name: 'Upper / Lower' },
  e1rm: { unit: 'kg', top: [{ id: 'a', name: 'Kreuzheben', v: 142 }, { id: 'b', name: 'Kniebeuge', v: 118 }, { id: 'c', name: 'Bank', v: 97 }] },
}

const karten = (c: HTMLElement) => [...c.querySelectorAll('[data-profile-card]')].map(e => e.getAttribute('data-profile-card'))

describe('ProfilKarten', () => {
  it('Über mich mit drei Werten als Dreierreihe', () => {
    const { container } = render(<ProfilKarten fields={voll} />)
    expect(container.querySelector('[data-profile-card="ueber"] [data-tile-layout]')?.getAttribute('data-tile-layout')).toBe('r3')
  })

  it('zwei Ein-Wert-Karten hintereinander stehen als Paar, ohne leere Karte', () => {
    const { container } = render(<ProfilKarten fields={{ body_fat: { v: 15, unit: '%' }, markers: { count: 3 } }} />)
    expect(karten(container)).toEqual(['koerper', 'blut'])
    expect(container.querySelectorAll('[data-profile-pair]')).toHaveLength(1)
  })

  it('eine einzelne Ein-Wert-Karte nimmt die volle Breite', () => {
    const { container } = render(<ProfilKarten fields={{ age: { v: 29 }, height: { v: 1, unit: 'cm' }, markers: { count: 3 } }} />)
    expect(container.querySelectorAll('[data-profile-pair]')).toHaveLength(0)
    expect(container.querySelector('[data-profile-card="blut"] [data-tile-layout]')?.getAttribute('data-tile-layout')).toBe('r1')
  })

  it('fremde Sicht: keine Chips, keine Platzhalter', () => {
    const { container } = render(<ProfilKarten fields={voll} />)
    expect(container.querySelectorAll('[data-vis-chip]')).toHaveLength(0)
    expect(container.querySelector('[data-profile-card="gesundheit"]')).toBeNull()
  })

  it('eigene Sicht: jeder Wert mit Chip, HRV/VO2max mit Strich', () => {
    const onChange = vi.fn()
    const { container } = render(<ProfilKarten fields={voll} visibility={{ age: 'friends' }} onChangeVisibility={onChange} />)
    expect(container.querySelector('[data-profile-tile="hrv"] [data-profile-value]')?.textContent).toBe('–')
    const chip = container.querySelector<HTMLElement>('[data-vis-chip="age"]')!
    expect(chip.getAttribute('data-vis')).toBe('friends')
    fireEvent.click(chip)
    expect(onChange).toHaveBeenCalledWith('age', 'all')
    // 8 Felder mit Wert + 2 Platzhalter
    expect(container.querySelectorAll('[data-vis-chip]')).toHaveLength(8 + 2)
  })

  it('Training: Zeilen und Bestleistungen als Dreierreihe', () => {
    const { container } = render(<ProfilKarten fields={voll} />)
    const training = container.querySelector('[data-profile-card="training"]')!
    expect(training.querySelectorAll('li')).toHaveLength(2)
    expect(training.querySelector('[data-profile-tile="e1rm"] .grid-cols-3')).not.toBeNull()
  })
})

describe('SichtbarkeitsChip', () => {
  it('Nur ich → Freunde → Alle → Nur ich; Freunde erklärt im Label', () => {
    const onChange = vi.fn()
    const { getByRole, rerender } = render(<SichtbarkeitsChip field="age" value="me" onChange={onChange} />)
    fireEvent.click(getByRole('button'))
    expect(onChange).toHaveBeenLastCalledWith('age', 'friends')
    rerender(<SichtbarkeitsChip field="age" value="friends" onChange={onChange} />)
    expect(getByRole('button').getAttribute('aria-label')).toContain('profil_stufe_freunde_hinweis')
    fireEvent.click(getByRole('button'))
    expect(onChange).toHaveBeenLastCalledWith('age', 'all')
    rerender(<SichtbarkeitsChip field="age" value="all" onChange={onChange} />)
    fireEvent.click(getByRole('button'))
    expect(onChange).toHaveBeenLastCalledWith('age', 'me')
  })
})
