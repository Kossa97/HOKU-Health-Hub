// @vitest-environment jsdom

import { createElement } from 'react'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Profil 2a: Die lange Profilseite wurde aufgeteilt in Schaufenster (/profil
 * mit „Bearbeiten“) und Einstellungen (/profil/einstellungen, /sichtbarkeit,
 * /blockiert). Dieser Test hält fest, dass jeder Abschnitt der alten Seite
 * auf einer der neuen Seiten erreichbar ist.
 */

const db = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
  rpc: [] as string[],
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: db.row, error: null }) }) }),
      update: (patch: Record<string, unknown>) => ({ eq: () => { db.updates.push(patch); return Promise.resolve({ error: null }) } }),
    }),
    rpc: (name: string) => {
      db.rpc.push(name)
      if (name === 'my_blocked_profiles') return Promise.resolve({ data: [{ username: 'max' }], error: null })
      if (name === 'profile_view') return Promise.resolve({ data: null, error: { message: 'fehlt' } })
      return Promise.resolve({ data: null, error: null })
    },
  },
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.c' }, signOut: vi.fn() }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../features/profil/hooks/useProfileSnapshotSync', () => ({ requestProfileSnapshot: vi.fn() }))
const media = vi.hoisted(() => ({
  check: vi.fn(async (_k: string): Promise<string | null> => 'pending'),
  dismiss: vi.fn(async (_u: string, _k: string): Promise<void> => undefined),
}))
vi.mock('../features/profil/services/profileMedia', () => ({
  signedMediaUrl: vi.fn(async () => null),
  checkProfileMedia: (k: string) => media.check(k),
  dismissRejectedMedia: (u: string, k: string) => media.dismiss(u, k),
}))
vi.mock('../features/profil/services/profileSnapshotStore', () => ({ loadProfileSnapshotInput: vi.fn(async () => { throw new Error('offline') }) }))
vi.mock('../features/training/services/trainingRepo', () => ({
  loadSessions: vi.fn(async () => []), loadRoutines: vi.fn(async () => []), loadCustomExercises: vi.fn(async () => []),
  insertCustomExercise: vi.fn(), isMissingTable: () => false,
  loadSettings: vi.fn(async () => ({ favoriteExercises: [] })), saveSettings: vi.fn(async () => undefined),
}))
vi.mock('../features/training/components/ExercisePicker', () => ({ ExercisePicker: () => null }))

// Eingebundene Bausteine der alten Seite als Stummel mit Kennung
// createElement wird erst beim Rendern gebraucht, nach den Importen
const { stub } = vi.hoisted(() => ({ stub: (id: string) => function Stummel() { return createElement('div', { 'data-alt-abschnitt': id }) } }))
vi.mock('../features/profil/components/ProfilBilder', () => ({ ProfilBilder: stub('bilder') }))
vi.mock('../features/profil/components/UeberDichKarte', () => ({ UeberDichKarte: stub('ueber-dich') }))
vi.mock('../features/blutwerte/components/BioProfil', () => ({ BioProfilKarte: stub('bio-profil') }))
vi.mock('../features/blutwerte/components/KiEinwilligung', () => ({ KiEinwilligungProfil: stub('ki-einwilligung') }))
vi.mock('../features/ernaehrung/components/PhotoConsentProfile', () => ({ PhotoConsentProfile: stub('foto-einwilligung') }))
vi.mock('../features/wearables/components/HealthStoreProfile', () => ({ HealthStoreProfile: stub('health-store') }))
vi.mock('../features/auth/lib/passkey', () => ({ PASSKEY_AN: true }))
vi.mock('../features/auth/components/PasskeyEinstellung', () => ({ PasskeyEinstellung: stub('passkey') }))
vi.mock('../features/compliance/components/AccountSection', () => ({ AccountSection: stub('konto-loeschen-rechtliches') }))
vi.mock('../components/ui/DesignSystem', () => ({ ResearchDisclaimer: stub('sicherheitshinweis') }))
vi.mock('../features/profil/components/AppEinstellungen', () => ({
  LanguageSwitcher: stub('sprache'),
  LookSwitcher: stub('erscheinungsbild'),
  PushSettings: stub('benachrichtigungen'),
  StoerungsSchalter: stub('stoerung'),
}))

import { Profil } from './Profil'
import { ProfilBlockiert, ProfilEinstellungen, ProfilSichtbarkeit } from './ProfilEinstellungen'

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn()
  db.row = { username: 'mara', display_name: 'Mara', public_bio: 'Hallo', field_visibility: {}, is_admin: true, profile_private: false, web_link_enabled: true }
  db.updates = []
  db.rpc = []
})
afterEach(cleanup)

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/profil" element={<Profil />} />
        <Route path="/profil/einstellungen" element={<ProfilEinstellungen />} />
        <Route path="/profil/sichtbarkeit" element={<ProfilSichtbarkeit />} />
        <Route path="/profil/blockiert" element={<ProfilBlockiert />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Alter Abschnitt → wo er jetzt steht (Selektor auf der jeweiligen Seite). */
const AUF_PROFIL = {
  'Name und Geschlechtszeichen': '[data-profile-name]',
  'Profil teilen (Link)': '[data-profile-share]',
}
const IM_BEARBEITEN = {
  'Profil- und Titelbild': '[data-alt-abschnitt="bilder"]',
  'Über dich (Ziele, Land, Geschlecht)': '[data-alt-abschnitt="ueber-dich"]',
  'Benutzername': '#profil-username',
  'Anzeigename': '#profil-anzeigename',
  'Öffentliche Bio': '#profil-bio',
}
const IN_EINSTELLUNGEN = {
  'Sichtbarkeit (statt Schalter öffentliches Profil)': '[data-setting-wer]',
  'Blockierte Profile': '[data-setting-blocked]',
  'Sicherheit & Datenschutz': '[data-settings-safety]',
  'Hinweis Forschung': '[data-alt-abschnitt="sicherheitshinweis"]',
  'Protokoll-Link': 'a[href="/protokoll"]',
  'Sprache': '[data-alt-abschnitt="sprache"]',
  'Erscheinungsbild': '[data-alt-abschnitt="erscheinungsbild"]',
  'Benachrichtigungen': '[data-alt-abschnitt="benachrichtigungen"]',
  'Hilfe / FAQ': 'a[href="/faq"]',
  'Alter und Geschlecht (Blutwerte)': '[data-alt-abschnitt="bio-profil"]',
  'KI-Einwilligung': '[data-alt-abschnitt="ki-einwilligung"]',
  'Foto-Einwilligung': '[data-alt-abschnitt="foto-einwilligung"]',
  'Apple Health / Health Connect': '[data-alt-abschnitt="health-store"]',
  'Passkey': '[data-alt-abschnitt="passkey"]',
  'Konto löschen und Rechtstexte': '[data-alt-abschnitt="konto-loeschen-rechtliches"]',
  'Abmelden': '[data-settings-signout]',
  'Störung nachstellen (Admin)': '[data-alt-abschnitt="stoerung"]',
}

describe('Alte Profilseite: jeder Abschnitt bleibt erreichbar', () => {
  it('auf dem Profil und im Bearbeiten-Sheet', async () => {
    const { container, findByText } = renderAt('/profil')
    await waitFor(() => expect(container.querySelector('[data-profile-edit]')).not.toBeNull())
    for (const [name, sel] of Object.entries(AUF_PROFIL)) expect(container.querySelector(sel), name).not.toBeNull()
    await act(async () => { fireEvent.click(container.querySelector('[data-profile-edit]')!) })
    await findByText('profil_bearbeiten_titel')
    for (const [name, sel] of Object.entries(IM_BEARBEITEN)) expect(document.querySelector(sel), name).not.toBeNull()
  })

  it('in den Einstellungen', async () => {
    const { container } = renderAt('/profil/einstellungen')
    await waitFor(() => expect(container.querySelector('[data-setting-private]')?.hasAttribute('disabled')).toBe(false))
    for (const [name, sel] of Object.entries(IN_EINSTELLUNGEN)) expect(container.querySelector(sel), name).not.toBeNull()
    // Der Schalter „öffentliches Profil“ und die share_*-Schalter sind weg
    expect(container.textContent).not.toContain('profil_teilen_hint')
  })

  it('Blockiert: Liste mit Entsperren', async () => {
    const { findByText, container } = renderAt('/profil/blockiert')
    await findByText('@max')
    expect(container.querySelector('[data-unblock="max"]')).not.toBeNull()
  })

  it('Wer sieht was: Hinweis zu öffentlichen Erfahrungen mit Link', async () => {
    const { container } = renderAt('/profil/sichtbarkeit')
    await waitFor(() => expect(container.querySelector('[data-wer-sieht-was]')).not.toBeNull())
    expect(container.querySelector('[data-profile-public-content] a[href="/bewertungen"]')).not.toBeNull()
  })
})

describe('Bild-Check im eigenen Profil', () => {
  it('offene Prüfung wird beim Öffnen nachgeholt; bis dahin „wird geprüft“ am Bild', async () => {
    db.row = { ...db.row, avatar_path: 'u1/a.jpg', avatar_status: 'pending', cover_path: 'u1/c.jpg', cover_status: 'approved' }
    let loese!: (s: string) => void
    media.check.mockImplementationOnce(() => new Promise(resolve => { loese = resolve }))
    const { container } = renderAt('/profil')
    await waitFor(() => expect(container.querySelector('[data-media-pending="avatar"]')).toBeTruthy())
    expect(media.check.mock.calls).toEqual([['avatar']])
    await act(async () => { loese('approved') })
    expect(container.querySelector('[data-media-pending]')).toBeNull()
  })

  it('abgelehnt: Hinweis mit „Anderes wählen“; OK quittiert', async () => {
    db.row = { ...db.row, avatar_path: 'u1/a.jpg', avatar_status: 'pending' }
    media.check.mockResolvedValueOnce('rejected')
    const { container } = renderAt('/profil')
    await waitFor(() => expect(container.querySelector('[data-media-rejected="avatar"]')).toBeTruthy())
    expect(container.querySelector('[data-media-pending]')).toBeNull()
    fireEvent.click(container.querySelector('[data-media-dismiss]')!)
    await waitFor(() => expect(container.querySelector('[data-media-rejected]')).toBeNull())
    expect(media.dismiss).toHaveBeenCalledWith('u1', 'avatar')
  })
})

describe('Einstellungen', () => {
  it('Privates Profil und Web-Link schreiben ihre Spalte, nie is_public oder share_*', async () => {
    const { container } = renderAt('/profil/einstellungen')
    await waitFor(() => expect(container.querySelector('[data-setting-private]')?.hasAttribute('disabled')).toBe(false))
    await act(async () => { fireEvent.click(container.querySelector('[data-setting-private]')!) })
    await act(async () => { fireEvent.click(container.querySelector('[data-setting-weblink]')!) })
    expect(db.updates).toEqual([{ profile_private: true }, { web_link_enabled: false }])
    expect(container.querySelector('[data-setting-private]')?.getAttribute('aria-checked')).toBe('true')
  })

  it('Web-Link: Eintrag „Abzeichen im Web“ und Schalter „In Suchmaschinen auffindbar“ (schreibt web_indexable)', async () => {
    db.row = { ...db.row, web_indexable: false }
    const { container } = renderAt('/profil/einstellungen')
    await waitFor(() => expect(container.querySelector('[data-setting-indexable]')?.hasAttribute('disabled')).toBe(false))
    expect(container.querySelector('[data-setting-web-badges]')?.getAttribute('href')).toBe('/profil/web-abzeichen')
    const schalter = container.querySelector('[data-setting-indexable]')!
    expect(schalter.getAttribute('aria-checked')).toBe('false')
    expect(schalter.textContent).toContain('profil_web_indexable_sub')
    await act(async () => { fireEvent.click(schalter) })
    expect(db.updates).toEqual([{ web_indexable: true }])
    expect(schalter.getAttribute('aria-checked')).toBe('true')
  })

  it.each([
    ['Web-Link aus', { web_link_enabled: false }, '[data-setting-weblink]'],
    ['privat', { profile_private: true }, '[data-setting-private]'],
  ])('Suchmaschinen-Schalter ohne Wirkung (%s): Erklärung, Einschalten gesperrt, Ausschalten geht', async (_name, patch, umlegen) => {
    db.row = { ...db.row, ...patch, web_indexable: true }
    const { container } = renderAt('/profil/einstellungen')
    await waitFor(() => expect(container.querySelector('[data-setting-private]')?.hasAttribute('disabled')).toBe(false))
    const schalter = container.querySelector('[data-setting-indexable]')!
    expect(schalter.getAttribute('aria-checked')).toBe('true')
    expect(schalter.textContent).toContain('profil_web_indexable_gesperrt')
    // Ein altes „an“ lässt sich abschalten, damit es nicht später still wieder wirkt
    expect(schalter.hasAttribute('disabled')).toBe(false)
    await act(async () => { fireEvent.click(schalter) })
    await waitFor(() => expect(schalter.getAttribute('aria-checked')).toBe('false'))
    expect(db.updates).toContainEqual({ web_indexable: false })
    // Aus: Einschalten geht erst wieder mit Web-Link an (bzw. privat aus)
    expect(schalter.hasAttribute('disabled')).toBe(true)
    await act(async () => { fireEvent.click(container.querySelector(umlegen)!) })
    expect(schalter.hasAttribute('disabled')).toBe(false)
    expect(schalter.textContent).toContain('profil_web_indexable_sub')
  })

  it('Ansehen als … führt zu /u/<name>?als=…', async () => {
    const { container } = renderAt('/profil/einstellungen')
    await waitFor(() => expect(container.querySelector('[data-setting-ansehen]')?.hasAttribute('disabled')).toBe(false))
    fireEvent.click(container.querySelector('[data-setting-ansehen]')!)
    expect([...document.querySelectorAll('[data-ansehen-als]')].map(e => e.getAttribute('data-ansehen-als'))).toEqual(['friends', 'all', 'web'])
  })

  it('Wer sieht was: alle 33 Felder, Bereich „Alle auf Alle“ speichert; privat sperrt', async () => {
    const { container, unmount } = renderAt('/profil/sichtbarkeit')
    await waitFor(() => expect(container.querySelectorAll('[data-wer-feld]')).toHaveLength(33))
    await act(async () => { fireEvent.click(container.querySelector('[data-bereich-alle="ueber:all"]')!) })
    expect(db.updates.at(-1)).toEqual({ field_visibility: { age: 'all', height: 'all', weight: 'all' } })
    unmount()

    db.row = { ...db.row, profile_private: true }
    const zwei = renderAt('/profil/sichtbarkeit')
    await waitFor(() => expect(zwei.container.querySelector('[data-wer-privat]')).not.toBeNull())
    expect(zwei.container.querySelector('[data-bereich-alle]')).toBeNull()
    expect(zwei.container.querySelector('fieldset')?.disabled).toBe(true)
  })
})
