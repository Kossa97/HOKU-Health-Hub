// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Outlet } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'

const state = vi.hoisted(() => ({ signedIn: true, language: 'de' }))
vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ session: state.signedIn ? { user: { id: 'test-user' } } : null, loading: false }),
}))
vi.mock('./components/Layout', () => ({ Layout: () => <Outlet /> }))
vi.mock('./features/dot/DotLayer', () => ({ DotLayer: () => null }))
vi.mock('./features/compliance/components/ConsentGate', () => ({ ConsentGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('./pages/Auth', () => ({ Auth: () => <h1>Sign in</h1> }))
vi.mock('./pages/__VialPreview', () => ({ VialPreview: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: state.language }, t: (key: string) => key }) }))

afterEach(() => { cleanup(); state.signedIn = true; state.language = 'de' })
function show(path: string) {
  window.history.replaceState({}, '', path)
  return render(<App />)
}

it('keeps app list, profile and back navigation inside the app without a calculator', async () => {
  show('/lab/peptipedia')
  fireEvent.click(await screen.findByRole('link', { name: 'BPC-157' }))
  expect(window.location.pathname).toBe('/lab/peptipedia/bpc-157')
  expect(screen.getAllByRole('tab')).toHaveLength(5)
  expect(screen.queryByRole('tab', { name: 'Rechner' })).toBeNull()
  expect(document.getElementById('panel-calculator')).toBeNull()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Studienprotokolle' }), { key: 'ArrowRight' })
  expect(screen.getByRole('tab', { name: 'Sicherheit' }).getAttribute('aria-selected')).toBe('true')
  fireEvent.click(screen.getByRole('link', { name: 'Zurück zur Peptipedia' }))
  expect(window.location.pathname).toBe('/lab/peptipedia')
  expect(screen.getByRole('heading', { name: 'Peptipedia' })).toBeTruthy()
})

it.each([['de', 'rechner', 'Überblick'], ['en', 'calculator', 'Overview']])('ignores a calculator hash in the %s app view', async (language, hash, overview) => {
  state.language = language
  show(`/lab/peptipedia/bpc-157#${hash}`)
  expect((await screen.findByRole('tab', { name: overview })).getAttribute('aria-selected')).toBe('true')
  expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(5)
  expect(document.querySelector('link[rel="canonical"]')).toBeNull()
})

it('keeps the website calculator available even with an app session', async () => {
  show('/en/peptipedia/bpc-157#calculator')
  expect((await screen.findByRole('tab', { name: 'Calculator' })).getAttribute('aria-selected')).toBe('true')
  expect(screen.getAllByRole('tab')).toHaveLength(6)
})

it.each(['/lab/peptipedia', '/lab/peptipedia/bpc-157'])('requires sign-in for %s', async path => {
  state.signedIn = false
  show(path)
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
  expect(window.location.pathname).toBe('/auth')
})
