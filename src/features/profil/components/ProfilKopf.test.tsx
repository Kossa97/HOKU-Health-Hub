// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/profileMedia', () => ({ signedMediaUrl: vi.fn(async (p: string) => `https://x/${p}`) }))

import { ProfilKopf } from './ProfilKopf'

afterEach(cleanup)

describe('ProfilKopf', () => {
  it('Name, Zeichen, Flagge mit Kürzel und @nick; Zahlenzeile nach sichtbarer Anzahl', () => {
    const { container } = render(
      <ProfilKopf name="Mara K." username="mara.lifts" avatarPath={null}
        fields={{ gender: 'female', country: 'DE', workouts: { total: 86, perWeek: 3 } }} />,
    )
    expect(container.querySelector('[data-profile-gender-symbol]')?.textContent).toBe('♀')
    expect(container.querySelector('[data-profile-country]')?.textContent).toBe('🇩🇪 DE')
    expect(container.querySelector('[data-profile-nick]')?.textContent).toBe('@mara.lifts')
    const zahlen = container.querySelector<HTMLElement>('[data-profile-counts]')!
    expect(zahlen.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))')
    expect(container.querySelectorAll('[data-vis-chip]')).toHaveLength(0)
  })

  it('ohne Werte keine Bio-, Ziel-, Meta- oder Zahlenzeile', () => {
    const { container } = render(<ProfilKopf name="Max" username="max" avatarPath={null} fields={{}} />)
    for (const sel of ['[data-profile-bio]', '[data-profile-goals]', '[data-profile-meta]', '[data-profile-counts]', '[data-profile-country]']) {
      expect(container.querySelector(sel)).toBeNull()
    }
  })

  it('eigene Sicht: Chips an Zeichen, Herkunft, Bio, Zielen, Streak, Mitglied seit, Titelbild', () => {
    const { container } = render(
      <ProfilKopf name="Mara" username="mara" avatarPath={null} visibility={{ bio: 'all' }} onChangeVisibility={vi.fn()}
        fields={{ gender: 'male', country: 'AT', bio: 'Hallo', goals: ['kraft'], streak: { days: 4 }, member_since: '2026-03', cover: 'u/c.jpg' }} />,
    )
    const chips = [...container.querySelectorAll('[data-vis-chip]')].map(c => c.getAttribute('data-vis-chip'))
    expect(chips.sort()).toEqual(['bio', 'country', 'cover', 'gender', 'goals', 'member_since', 'streak'])
  })
})
