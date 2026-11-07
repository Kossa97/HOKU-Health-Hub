// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Legal } from './Legal'

const scrollIntoView = vi.fn()
beforeEach(() => {
  scrollIntoView.mockClear()
  Element.prototype.scrollIntoView = scrollIntoView
})
afterEach(cleanup)

function show(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Legal /></MemoryRouter>)
}

it('springt zum Abschnitt aus der Sprungmarke', () => {
  show('/datenschutz#gesundheitsdaten')
  expect(scrollIntoView).toHaveBeenCalledTimes(1)
  expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('gesundheitsdaten'))
})

it('springt zum Abschnitt Profil und Sichtbarkeit', () => {
  show('/datenschutz#profil-sichtbarkeit')
  const ziel = document.getElementById('profil-sichtbarkeit')
  expect(ziel?.querySelector('h2')?.textContent).toBe('6. Profile and visibility')
  expect(scrollIntoView.mock.contexts[0]).toBe(ziel)
})

it('stuerzt bei kaputter Sprungmarke wie #% nicht ab', () => {
  show('/datenschutz#%')
  expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
  expect(scrollIntoView).not.toHaveBeenCalled()
})
