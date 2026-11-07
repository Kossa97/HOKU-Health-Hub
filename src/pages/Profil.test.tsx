// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  view: null as unknown,
  viewError: null as unknown,
  updateError: null as unknown,
  updates: [] as Record<string, unknown>[],
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve(db.row ? { data: db.row, error: null } : { data: null, error: { message: 'offline' } }) }) }),
      update: (patch: Record<string, unknown>) => ({ eq: () => { db.updates.push(patch); return Promise.resolve({ error: db.updateError }) } }),
    }),
    rpc: (name: string) => Promise.resolve(name === 'profile_view' ? { data: db.view, error: db.viewError } : { data: null, error: null }),
  },
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.c' }, signOut: vi.fn() }) }))
const toastError = vi.fn()
vi.mock('react-hot-toast', () => ({ default: { error: (m: string) => toastError(m), success: vi.fn() } }))
vi.mock('../features/profil/hooks/useProfileSnapshotSync', () => ({ requestProfileSnapshot: vi.fn() }))
vi.mock('../features/profil/services/profileMedia', () => ({ signedMediaUrl: vi.fn(async () => null) }))
vi.mock('../features/profil/services/profileSnapshotStore', () => ({ loadProfileSnapshotInput: vi.fn(async () => ({})) }))
vi.mock('../features/profil/lib/profileSnapshot', () => ({ buildProfileSnapshot: () => ({ age: { v: 41 } }) }))

import { Profil } from './Profil'

const ZEILE = { username: 'mara', display_name: 'Mara', public_bio: 'Lokal', field_visibility: {}, created_at: '2026-03-01T00:00:00Z' }
const renderPage = () => render(<MemoryRouter><Profil /></MemoryRouter>)

beforeEach(() => {
  db.row = { ...ZEILE }
  db.view = { username: 'mara', display_name: 'Mara', own: true, fields: { age: { v: 29 }, bio: 'Vom Server' }, visibility: { age: 'friends' } }
  db.viewError = null
  db.updateError = null
  db.updates = []
  toastError.mockClear()
})
afterEach(cleanup)

describe('Profil (eigene Ansicht)', () => {
  it('zeigt die eigene Sicht aus profile_view mit Stufen', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('[data-profile-bio]')?.textContent).toContain('Vom Server'))
    expect(container.querySelector('[data-vis-chip="age"]')?.getAttribute('data-vis')).toBe('friends')
    expect(container.querySelector('[data-profile-settings]')?.getAttribute('href')).toBe('/profil/einstellungen')
  })

  it('profile_view fehlt: rechnet lokal und zeigt trotzdem alles', async () => {
    db.viewError = { message: 'function profile_view does not exist' }
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('[data-profile-bio]')?.textContent).toContain('Lokal'))
    expect(container.querySelector('[data-profile-tile="age"] [data-profile-value]')?.textContent).toBe('41')
  })

  it('Chip schaltet weiter und speichert sofort die ganze Stufenkarte', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('[data-vis-chip="age"]')).not.toBeNull())
    await act(async () => { fireEvent.click(container.querySelector('[data-vis-chip="age"]')!) })
    expect(db.updates.at(-1)).toEqual({ field_visibility: { age: 'all' } })
    expect(container.querySelector('[data-vis-chip="age"]')?.getAttribute('data-vis')).toBe('all')
  })

  it('Speicherfehler: Stufe zurück, Meldung', async () => {
    db.updateError = { message: 'offline' }
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('[data-vis-chip="age"]')).not.toBeNull())
    await act(async () => { fireEvent.click(container.querySelector('[data-vis-chip="age"]')!) })
    expect(container.querySelector('[data-vis-chip="age"]')?.getAttribute('data-vis')).toBe('friends')
    expect(toastError).toHaveBeenCalledWith('fehler_speichern')
  })

  it('Ladefehler der Profilzeile: Hinweis statt leerer Seite', async () => {
    db.row = null
    const { findByRole } = renderPage()
    expect((await findByRole('alert')).textContent).toContain('profil_laden_fehler')
  })
})
