// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Fremdes Profil /u/<name> (Profil 2a): zeigt genau, was `profile_view`
 * liefert; ohne Anmeldung nie Erfahrungsberichte.
 */

const db = vi.hoisted(() => ({
  view: null as unknown,
  reviews: null as unknown,
  calls: [] as { name: string; params: Record<string, unknown> }[],
  user: { id: 'u1' } as { id: string } | null,
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (name: string, params: Record<string, unknown>) => {
      db.calls.push({ name, params })
      if (name === 'profile_view') return Promise.resolve({ data: db.view, error: null })
      if (name === 'public_profile_reviews') return Promise.resolve({ data: db.reviews, error: null })
      return Promise.resolve({ data: null, error: null })
    },
  },
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: db.user, loading: false }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../features/profil/services/profileMedia', () => ({ signedMediaUrl: vi.fn(async (p: string) => `https://signiert/${p}`) }))

import { PublicProfile } from './PublicProfile'

const bericht = {
  id: 'r1', substanz: 'BPC-157', rating: 4, title: 'Geteilt', body: null, pros: null, cons: null,
  wirkung: null, vertraeglichkeit: null, wieder_nehmen: null, monat: '2026-09',
}

beforeEach(() => {
  db.view = null
  db.reviews = null
  db.calls = []
  db.user = { id: 'u1' }
})
afterEach(cleanup)

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/u/:username" element={<PublicProfile />} />
        <Route path="/profil" element={<p>eigenes Profil</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const rpcNamen = () => db.calls.map(c => c.name)

describe('PublicProfile angemeldet', () => {
  it('zeigt nur gelieferte Felder ohne Chips; ⋯ öffnet Melden und Blockieren', async () => {
    db.view = { username: 'max', display_name: 'Max', own: false, blocked: false, private: false, avatar: null,
      fields: { age: { v: 30 }, weight: { v: 80, unit: 'kg' } } }
    const { container, getByText } = renderAt('/u/max')
    await waitFor(() => expect(container.querySelector('[data-public-profile]')).toBeTruthy())
    expect(getByText('Max')).toBeTruthy()
    expect(container.querySelectorAll('[data-profile-tile]')).toHaveLength(2)
    expect(container.querySelector('[data-vis-chip]')).toBeNull()
    expect(container.querySelector('[data-public-reviews]')).toBeNull()
    expect(rpcNamen()).toEqual(['profile_view'])
    expect(db.calls[0].params).toEqual({ p_username: 'max', p_as: null })

    fireEvent.click(container.querySelector('[data-profile-more]')!)
    expect(document.querySelector('[data-report-profile]')).toBeTruthy()
    expect(document.querySelector('[data-block-open]')).toBeTruthy()
  })

  it('Erfahrungsberichte nur bei freigegebenem Feld, dann über public_profile_reviews', async () => {
    db.view = { username: 'max', own: false, fields: { reviews: { count: 1, avgRating: 4 } } }
    db.reviews = { username: 'max', reviews: [bericht] }
    const { container } = renderAt('/u/max')
    await waitFor(() => expect(container.querySelectorAll('[data-public-review]')).toHaveLength(1))
    expect(rpcNamen()).toEqual(['profile_view', 'public_profile_reviews'])
    expect(container.querySelector('[data-report-open]')).toBeTruthy()
  })

  it('privat: Kopf und Karte „Privates Profil“, keine Werte', async () => {
    db.view = { username: 'max', display_name: 'Max', own: false, private: true, avatar: 'x/a.jpg', fields: { age: { v: 30 } } }
    const { container } = renderAt('/u/max')
    await waitFor(() => expect(container.querySelector('[data-profile-private]')).toBeTruthy())
    expect(container.querySelector('[data-profile-tile]')).toBeNull()
    await waitFor(() => expect(container.querySelector('[data-profile-avatar] img')?.getAttribute('src')).toBe('https://signiert/x/a.jpg'))
  })

  it('blockiert: wie bisher mit Entsperren', async () => {
    db.view = { username: 'max', blocked: true, own: false }
    const { container } = renderAt('/u/max')
    await waitFor(() => expect(container.querySelector('[data-profile-blocked]')).toBeTruthy())
    expect(container.querySelector('[data-unblock]')).toBeTruthy()
  })

  it('nicht gefunden: neutrale Ansicht', async () => {
    const { container } = renderAt('/u/gibtsnicht')
    await waitFor(() => expect(container.querySelector('[data-profile-not-found]')).toBeTruthy())
  })

  it('eigenes Profil ohne „Ansehen als“ führt zu /profil', async () => {
    db.view = { username: 'mara', own: true, as: 'owner', fields: {} }
    const { findByText } = renderAt('/u/mara')
    expect(await findByText('eigenes Profil')).toBeTruthy()
  })

  it('Ansehen als App-Nutzer: Band mit Zurück, ohne ⋯', async () => {
    db.view = { username: 'mara', own: true, as: 'all', private: false, fields: { age: { v: 29 } } }
    const { container } = renderAt('/u/mara?als=all')
    await waitFor(() => expect(container.querySelector('[data-view-as="all"]')).toBeTruthy())
    expect(db.calls[0].params).toEqual({ p_username: 'mara', p_as: 'all' })
    expect(container.querySelector('[data-view-as-back]')?.getAttribute('href')).toBe('/profil/einstellungen')
    expect(container.querySelector('[data-profile-more]')).toBeNull()
    expect(container.querySelector('[data-profile-tile="age"]')).toBeTruthy()
  })

  it('Ansehen als Web: Web-Ansicht', async () => {
    db.view = { username: 'mara', own: true, as: 'web', fields: { bio: 'Hallo' } }
    const { container } = renderAt('/u/mara?als=web')
    await waitFor(() => expect(container.querySelector('[data-web-profile]')).toBeTruthy())
    expect(container.querySelector('[data-view-as="web"]')).toBeTruthy()
    expect(container.querySelector('[data-profile-bio]')?.textContent).toBe('Hallo')
  })
})

describe('PublicProfile ohne Anmeldung', () => {
  beforeEach(() => { db.user = null })

  it('nur Bild, Name, Nickname, Bio und „In Hoku öffnen“ — keine Berichte', async () => {
    db.view = { username: 'max', display_name: 'Max', own: false, avatar: null, fields: { bio: 'Hallo', reviews: { count: 2, avgRating: 5 } } }
    const { container, getByText } = renderAt('/u/max')
    await waitFor(() => expect(container.querySelector('[data-web-profile]')).toBeTruthy())
    expect(getByText('Max')).toBeTruthy()
    expect(getByText('@max')).toBeTruthy()
    expect(container.querySelector('[data-web-open]')).toBeTruthy()
    expect(container.querySelector('[data-web-app-only]')).toBeTruthy()
    expect(container.querySelector('[data-profile-tile]')).toBeNull()
    expect(container.querySelector('[data-report-open], [data-report-profile]')).toBeNull()
    expect(rpcNamen()).toEqual(['profile_view'])
  })

  it('null: „Seite nicht gefunden“', async () => {
    const { container } = renderAt('/u/max')
    await waitFor(() => expect(container.querySelector('[data-web-not-found]')).toBeTruthy())
  })
})
