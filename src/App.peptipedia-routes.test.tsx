// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./context/AuthContext', () => ({ AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('./components/ProtectedRoute', () => ({ ProtectedRoute: () => <div>PROTECTED_GATE</div> }))
vi.mock('./components/Layout', () => ({ Layout: () => null }))
vi.mock('./features/dot/DotLayer', () => ({ DotLayer: () => null }))
vi.mock('./pages/Auth', () => ({ Auth: () => <div>AUTH</div> }))
vi.mock('./pages/__VialPreview', () => ({ VialPreview: () => null }))
afterEach(cleanup)

it.each(['/peptipedia', '/en/peptipedia', '/peptipedia/bpc-157', '/en/peptipedia/bpc-157'])('opens %s outside the personal gate', async path => {
  window.history.replaceState({}, '', path)
  render(<App />)
  expect(await screen.findByRole('heading', { name: path.endsWith('bpc-157') ? 'BPC-157' : 'Peptipedia' })).toBeTruthy()
  expect(screen.queryByText('PROTECTED_GATE')).toBeNull()
})
it.each(['/', '/lab/admin', '/peptide', '/simulation'])('keeps %s protected', async path => {
  window.history.replaceState({}, '', path)
  render(<App />)
  expect(await screen.findByText('PROTECTED_GATE')).toBeTruthy()
})
it('redirects old substance slugs to their public equivalents', async () => {
  window.history.replaceState({}, '', '/lab/library/semaglutide')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Semaglutid' })).toBeTruthy()
  expect(window.location.pathname).toBe('/peptipedia/semaglutid')
})
