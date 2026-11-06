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

  it('Ansehen als Web ohne Antwort (Web-Link aus): die 404 des Webs mit Band', async () => {
    const { container } = renderAt('/u/mara?als=web')
    await waitFor(() => expect(container.querySelector('[data-web-not-found]')).toBeTruthy())
    expect(container.querySelector('[data-view-as="web"]')).toBeTruthy()
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

  it('Web-Seite: nur, was die Stufe web liefert — keine Berichte, keine Werte', async () => {
    db.view = {
      username: 'max', display_name: 'Max Muster', own: false, avatar: null, private: false,
      fields: { bio: 'Hallo', goals: ['kraft'], country: 'DE', streak: { days: 41 }, progress: { tier: 30 },
        badges: ['streak_7', 'workouts_250', 'streak_30', 'first_pr'], reviews: { count: 2 } },
      card: { member_since: { unit: 'months', n: 7 }, web_value_count: 9, entry_count: 1240 },
      web_indexable: false,
    }
    const { container, getByText } = renderAt('/u/max')
    await waitFor(() => expect(container.querySelector('[data-web-profile]')).toBeTruthy())
    expect(getByText('Max Muster')).toBeTruthy()
    expect(getByText('@max')).toBeTruthy()
    expect(container.querySelector('[data-profile-bio]')?.textContent).toBe('Hallo')
    // jsdom meldet sich wie ein Rechner: der Knopf klappt Hoku-Code und Browser-Weg auf
    fireEvent.click(container.querySelector('[data-web-open]')!)
    expect(container.querySelector('[data-web-desktop-open] [data-hoku-code]')).toBeTruthy()
    expect(container.querySelector('[data-web-progress="30"]')).toBeTruthy()
    expect(container.querySelector('[data-web-values="9"]')).toBeTruthy()
    expect(container.querySelector('[data-web-member]')).toBeTruthy()
    expect(container.querySelector('[data-web-reviews-hint]')).toBeTruthy()
    // Schwerste zuerst: zwei offen, die dritte Kachel verdeckt mit „+2“
    expect([...container.querySelectorAll('[data-web-badges-row] [data-badge]')].map(n => n.getAttribute('data-badge')))
      .toEqual(['workouts_250', 'streak_30'])
    expect(container.querySelector('[data-web-badges-more="2"]')).toBeTruthy()
    expect(container.querySelector('[data-profile-tile]')).toBeNull()
    expect(container.querySelector('[data-report-open], [data-report-profile]')).toBeNull()
    expect(rpcNamen()).toEqual(['profile_view'])
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
  })

  it('Titel: Chip unter dem Namen, wenn die Stufe web ihn liefert', async () => {
    db.view = { username: 'max', display_name: 'Max Muster', own: false, fields: { title: { kind: 'badge', id: 'run_50' } } }
    const { container } = renderAt('/u/max')
    await waitFor(() => expect(container.querySelector('[data-web-profile]')).toBeTruthy())
    const chip = container.querySelector('[data-profile-title="run_50"]')
    expect(chip?.getAttribute('data-profile-title-kind')).toBe('badge')
    expect(chip?.textContent).toContain('Läufer')
    expect(chip?.querySelector('.uppercase.font-mono')).toBeTruthy()
    // Reihenfolge: Name, Titel, @nick
    const name = container.querySelector('[data-profile-name]')!
    const nick = container.querySelector('[data-profile-nick]')!
    expect(name.compareDocumentPosition(chip!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(chip!.compareDocumentPosition(nick) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('Titel: Rang ebenso; unbekannte oder persönliche IDs und fehlender Titel → kein Chip', async () => {
    db.view = { username: 'max', own: false, fields: { title: { kind: 'rank', id: 'rank_5' } } }
    const rang = renderAt('/u/max')
    await waitFor(() => expect(rang.container.querySelector('[data-profile-title="rank_5"]')?.textContent).toContain('Veteran'))
    cleanup()
    for (const title of [undefined, { kind: 'badge', id: 'gibts_nicht' }, { kind: 'rank', id: 'run_50' }, { kind: 'badge', id: 'streak_7' }, { kind: 'badge', id: 'body_fat_10' }, 'Läufer']) {
      db.view = { username: 'max', own: false, fields: title === undefined ? {} : { title } }
      const { container } = renderAt('/u/max')
      await waitFor(() => expect(container.querySelector('[data-web-profile]')).toBeTruthy())
      expect(container.querySelector('[data-profile-title]'), JSON.stringify(title)).toBeNull()
      cleanup()
    }
  })

  it('ohne Berichte keine Zeile über Verborgenes; web_indexable hebt noindex auf', async () => {
    db.view = { username: 'max', own: false, fields: {}, web_indexable: true }
    const { container } = renderAt('/u/max')
    await waitFor(() => expect(container.querySelector('[data-web-profile]')).toBeTruthy())
    expect(container.querySelector('[data-web-reviews-hint]')).toBeNull()
    expect(container.querySelector('[data-web-progress]')).toBeNull()
    expect(container.querySelector('[data-web-badges]')).toBeNull()
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })

  it('Profil melden ohne Konto: Grund und E-Mail an report_public_profile_web', async () => {
    db.view = { username: 'max', own: false, fields: {} }
    const { container } = renderAt('/u/max')
    await waitFor(() => expect(container.querySelector('[data-web-report]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-web-report]')!)
    fireEvent.click(document.querySelector('[data-report-reason="spam"]')!)
    fireEvent.change(document.querySelector('[data-report-email]')!, { target: { value: ' a@b.de ' } })
    fireEvent.click(document.querySelector('[data-report-send]')!)
    await waitFor(() => expect(rpcNamen()).toContain('report_public_profile_web'))
    expect(db.calls.find(c => c.name === 'report_public_profile_web')!.params)
      .toEqual({ p_username: 'max', p_reason: 'spam', p_details: null, p_contact: 'a@b.de' })
  })

  it('null: „Seite nicht gefunden“', async () => {
    const { container } = renderAt('/u/max')
    await waitFor(() => expect(container.querySelector('[data-web-not-found]')).toBeTruthy())
    expect(container.querySelector('[data-web-about]')).toBeTruthy()
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
  })
})
