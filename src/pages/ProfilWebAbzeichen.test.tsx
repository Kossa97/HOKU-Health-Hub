// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BADGE_IDS, BADGES_WEB_BORDERLINE, BADGES_WEB_SENSITIVE, type BadgeId } from '../features/profil/lib/badgeIds'

/**
 * „Abzeichen im Web“ (Profil 2c, Spec 6.2): Standard (heikle und Grenzfälle
 * aus), Abweichungen, Zurücksetzen, Zähler und der Hinweis oben.
 */

const db = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
  fail: false,
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: db.row, error: null }) }) }),
      update: (patch: Record<string, unknown>) => ({
        eq: () => {
          db.updates.push(patch)
          return Promise.resolve({ error: db.fail ? { message: 'kaputt' } : null })
        },
      }),
    }),
  },
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
const toast = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toast }))
// Schlüssel samt Werten, damit Zähler prüfbar sind
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k),
    i18n: { language: 'de', resolvedLanguage: 'de' },
  }),
}))
const fortschritt = vi.hoisted(() => ({ earned: [] as string[], status: 'ok' as 'ok' | 'laden' | 'fehler' }))
vi.mock('../features/profil/hooks/useEigenerFortschritt', () => ({
  useEigenerFortschritt: () => ({
    fortschritt: fortschritt.status === 'ok'
      ? { status: 'ok', state: { badges: { states: BADGE_IDS.map(id => ({ id, earned: fortschritt.earned.includes(id), on: null })) } } }
      : { status: fortschritt.status },
  }),
}))

import { ProfilWebAbzeichen } from './ProfilWebAbzeichen'

beforeEach(() => {
  db.row = {
    username: 'mara', profile_private: false, web_link_enabled: true,
    field_visibility: { badges: 'all' }, web_badges: {}, web_indexable: false,
  }
  db.updates = []
  db.fail = false
  fortschritt.earned = []
  fortschritt.status = 'ok'
  toast.error.mockClear()
})
afterEach(cleanup)

async function oeffne() {
  const r = render(<MemoryRouter><ProfilWebAbzeichen /></MemoryRouter>)
  await waitFor(() => expect(r.container.querySelector('[data-web-badge="streak_7"]')?.hasAttribute('disabled')).toBe(false))
  return r
}

const schalter = (c: HTMLElement, id: BadgeId) => c.querySelector<HTMLButtonElement>(`[data-web-badge="${id}"]`)!
const an = (c: HTMLElement, id: BadgeId) => schalter(c, id).getAttribute('aria-checked') === 'true'
const zaehler = (c: HTMLElement) => c.querySelector('[data-web-badges-count]')!.textContent

describe('Abzeichen im Web', () => {
  it('Standard: heikle und Grenzfälle aus (mit Hinweis), alles andere an; Zurücksetzen ohne Abweichung gesperrt', async () => {
    const { container } = await oeffne()
    expect(container.querySelectorAll('[data-web-badge]')).toHaveLength(BADGE_IDS.length)
    for (const id of BADGE_IDS) {
      const aus = BADGES_WEB_SENSITIVE.includes(id) || BADGES_WEB_BORDERLINE.includes(id)
      expect(an(container, id), id).toBe(!aus)
      expect(!!schalter(container, id).querySelector('[data-web-badge-sensitive]'), id).toBe(BADGES_WEB_SENSITIVE.includes(id))
      expect(!!schalter(container, id).querySelector('[data-web-badge-borderline]'), id).toBe(BADGES_WEB_BORDERLINE.includes(id))
    }
    expect(container.querySelector('[data-web-badge-group="bestaendigkeit"] [data-web-badge-group-count]')?.textContent)
      .toBe('profil_webabz_gruppe_an:{"n":7,"gesamt":9}')
    expect(container.querySelector<HTMLButtonElement>('[data-web-badges-reset]')!.disabled).toBe(true)
    expect(container.querySelector('[data-web-badges-scope]')).not.toBeNull()
    // Adresse ohne Schema, wie unter dem Web-Link-Schalter
    expect(container.textContent).toMatch(/profil_webabz_intro:\{"adresse":"[^":]+(:\d+)?\/u\/mara"\}/)
  })

  it('vor dem Laden gesperrt: ein Tipp darf gespeicherte Abweichungen nicht überschreiben', async () => {
    const { container } = render(<MemoryRouter><ProfilWebAbzeichen /></MemoryRouter>)
    expect(schalter(container, 'streak_7').hasAttribute('disabled')).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('[data-web-badges-reset]')!.disabled).toBe(true)
    await waitFor(() => expect(schalter(container, 'streak_7').hasAttribute('disabled')).toBe(false))
  })

  it('Abweichung: gespeicherte gelten; jeder Tipp schreibt nur Abweichungen vom Standard', async () => {
    db.row = { ...db.row, web_badges: { first_bloodwork: true, workouts_10: false } }
    const { container } = await oeffne()
    expect(an(container, 'first_bloodwork')).toBe(true)
    expect(an(container, 'workouts_10')).toBe(false)
    expect(container.querySelector<HTMLButtonElement>('[data-web-badges-reset]')!.disabled).toBe(false)

    await act(async () => { fireEvent.click(schalter(container, 'first_bloodwork')) })
    await act(async () => { fireEvent.click(schalter(container, 'streak_7')) })
    expect(db.updates).toEqual([
      { web_badges: { workouts_10: false } },
      { web_badges: { workouts_10: false, streak_7: false } },
    ])
    expect(an(container, 'first_bloodwork')).toBe(false)
    expect(an(container, 'streak_7')).toBe(false)
  })

  it('Auf Standard zurücksetzen schreibt {} und stellt alle Schalter zurück', async () => {
    db.row = { ...db.row, web_badges: { first_bloodwork: true, streak_7: false } }
    const { container } = await oeffne()
    await act(async () => { fireEvent.click(container.querySelector('[data-web-badges-reset]')!) })
    expect(db.updates).toEqual([{ web_badges: {} }])
    expect(an(container, 'first_bloodwork')).toBe(false)
    expect(an(container, 'streak_7')).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('[data-web-badges-reset]')!.disabled).toBe(true)
  })

  it('Zähler: im Web sichtbare von den verdienten; folgt dem Schalter', async () => {
    fortschritt.earned = ['streak_7', 'workouts_10', 'first_bloodwork', 'weighed_weeks_8']
    const { container } = await oeffne()
    expect(zaehler(container)).toContain('profil_webabz_zaehler:{"n":2,"gesamt":4}')
    expect(schalter(container, 'streak_7').getAttribute('data-web-badge-earned')).toBe('true')
    expect(schalter(container, 'streak_30').getAttribute('data-web-badge-earned')).toBe('false')
    await act(async () => { fireEvent.click(schalter(container, 'first_bloodwork')) })
    expect(zaehler(container)).toContain('profil_webabz_zaehler:{"n":3,"gesamt":4}')
    // nicht verdiente lassen sich vorab einstellen, zählen aber nicht mit
    await act(async () => { fireEvent.click(schalter(container, 'streak_30')) })
    expect(zaehler(container)).toContain('profil_webabz_zaehler:{"n":3,"gesamt":4}')
  })

  it('Zähler 0, solange der Hinweis gilt (im Web erscheint dann gar keins)', async () => {
    db.row = { ...db.row, web_link_enabled: false }
    fortschritt.earned = ['streak_7', 'workouts_10']
    const { container } = await oeffne()
    expect(zaehler(container)).toContain('profil_webabz_zaehler:{"n":0,"gesamt":2}')
  })

  it('vor der Migration 2c (Spalte fehlt): Schalter und Zurücksetzen gesperrt', async () => {
    delete db.row.web_badges
    const { container } = render(<MemoryRouter><ProfilWebAbzeichen /></MemoryRouter>)
    // geladen, sobald die Adresse den Namen trägt
    await waitFor(() => expect(container.textContent).toContain('/u/mara'))
    expect(schalter(container, 'streak_7').hasAttribute('disabled')).toBe(true)
    fireEvent.click(schalter(container, 'streak_7'))
    expect(db.updates).toEqual([])
  })

  it('Fortschritt nicht ladbar: Schalter bleiben bedienbar, ohne Zähler und ohne „verdient“', async () => {
    fortschritt.status = 'fehler'
    const { container } = await oeffne()
    expect(container.querySelector('[data-web-badges-count]')).toBeNull()
    expect(schalter(container, 'streak_7').hasAttribute('data-web-badge-earned')).toBe(false)
  })

  it('Speichern scheitert: Schalter springt zurück, mit Meldung', async () => {
    db.fail = true
    const { container } = await oeffne()
    await act(async () => { fireEvent.click(schalter(container, 'streak_7')) })
    expect(an(container, 'streak_7')).toBe(true)
    expect(toast.error).toHaveBeenCalledWith('fehler_speichern')
  })

  it.each([
    ['weblink', { web_link_enabled: false }, '/profil/einstellungen'],
    ['privat', { profile_private: true }, '/profil/einstellungen'],
    ['stufe', { field_visibility: { badges: 'friends' } }, '/profil/sichtbarkeit'],
    ['stufe', { field_visibility: {} }, '/profil/sichtbarkeit'],
  ] as const)('Hinweis oben: %s, mit Sprung zur Einstellung', async (grund, patch, ziel) => {
    db.row = { ...db.row, ...patch }
    const { container } = await oeffne()
    const hinweis = container.querySelector(`[data-web-badges-hint="${grund}"]`)
    expect(hinweis).not.toBeNull()
    expect(hinweis!.textContent).toContain(`profil_webabz_hinweis_${grund}`)
    expect(hinweis!.querySelector('a')?.getAttribute('href')).toBe(ziel)
  })

  it('kein Hinweis bei Web-Link an, nicht privat und Abzeichen auf „Alle“', async () => {
    const { container } = await oeffne()
    expect(container.querySelector('[data-web-badges-hint]')).toBeNull()
  })

  it('Web-Link aus geht vor privat', async () => {
    db.row = { ...db.row, web_link_enabled: false, profile_private: true, field_visibility: {} }
    const { container } = await oeffne()
    expect(container.querySelectorAll('[data-web-badges-hint]')).toHaveLength(1)
    expect(container.querySelector('[data-web-badges-hint="weblink"]')).not.toBeNull()
  })
})
