// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const eq = vi.fn()
const update = vi.fn((_: Record<string, unknown>) => ({ eq }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: () => ({ update }) } }))
const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock('react-hot-toast', () => ({ default: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { resolvedLanguage: 'de', language: 'de' },
  }),
}))

import type { TitleMoment } from '../lib/titleMoment'
import type { TitleBadgeId } from '../lib/titles'
import type { VisibilityMap } from '../lib/profileVisibility'
import { TitelMoment, type TitelStand } from './TitelMoment'
import { spieleMoment } from './titelMomentAblauf'

beforeEach(() => {
  eq.mockReset(); update.mockClear(); toastError.mockClear(); toastSuccess.mockClear()
  eq.mockResolvedValue({ error: null })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function zeige(moment: TitleMoment, stand: TitelStand | 'fehler' = { map: {}, choice: null }) {
  const onDone = vi.fn()
  const laden = () => (stand === 'fehler' ? Promise.reject(new Error('x')) : Promise.resolve(stand))
  const utils = render(
    <MemoryRouter initialEntries={['/tagebuch']}>
      <Routes>
        <Route path="/tagebuch" element={<><button type="button">vorher</button><TitelMoment moment={moment} userId="u1" onDone={onDone} laden={laden} /></>} />
        <Route path="/profil" element={<p>Profilseite</p>} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('dialog')
  return { onDone, ...utils }
}

const knoepfe = () => [...document.querySelectorAll('[data-titel-moment-act]')].map(b => b.getAttribute('data-titel-moment-act'))
const stand = (choice: TitleBadgeId | null, map: VisibilityMap = {}): TitelStand => ({ map, choice })

describe('TitelMoment', () => {
  it('neuer Rang, Rang getragen: „Ab heute“, Leiste, Fertig / Titel ansehen', async () => {
    await zeige({ kind: 'rank', id: 'rank_2' })
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Entdecker' })).toBeTruthy()
    expect(dialog.textContent).toContain('titel_moment_neuer_rang')
    expect(dialog.textContent).toContain('titel_moment_ab_heute {"name":"Entdecker"}')
    expect(dialog.textContent).toContain('titel_moment_rang_sub {"count":10}')
    expect(dialog.textContent).toContain('titel_moment_rang_getragen')
    expect([...dialog.querySelectorAll('.tm-steps i')].map(i => i.getAttribute('data-step'))).toEqual(['on', 'new', 'off', 'off', 'off', 'off'])
    expect(knoepfe()).toEqual(['fertig', 'ansehen'])
  })

  it('neuer Rang, anderer Titel getragen: Als Titel tragen schreibt title_choice null', async () => {
    const { onDone } = await zeige({ kind: 'rank', id: 'rank_5' }, stand('run_50'))
    expect(screen.getByRole('dialog').textContent).toContain('titel_moment_traegst {"name":"Läufer"}')
    expect(knoepfe()).toEqual(['tragen', 'spaeter'])
    fireEvent.click(document.querySelector('[data-titel-moment-act="tragen"]')!)
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(update).toHaveBeenCalledWith({ title_choice: null })
    expect(eq).toHaveBeenCalledWith('id', 'u1')
    expect(toastSuccess).toHaveBeenCalledWith('titel_moment_getragen {"name":"Veteran"}')
  })

  it('neuer Abzeichen-Titel: „Neuer Titel freigeschaltet“, Als Titel tragen schreibt die ID', async () => {
    const { onDone } = await zeige({ kind: 'badge', id: 'run_10' })
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('titel_moment_neuer_titel')
    expect(screen.getByRole('heading', { name: 'Jogger' })).toBeTruthy()
    expect(dialog.textContent).toContain('titel_moment_aus_abzeichen {"badge":"10 Läufe"}')
    expect([...dialog.querySelectorAll('.tm-steps i')]).toHaveLength(3)
    expect(knoepfe()).toEqual(['tragen', 'spaeter'])
    fireEvent.click(document.querySelector('[data-titel-moment-act="tragen"]')!)
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(update).toHaveBeenCalledWith({ title_choice: 'run_10' })
  })

  it('neue Stufe der getragenen Leiter: steigt von selbst mit, Fertig', async () => {
    await zeige({ kind: 'badge', id: 'run_50' }, stand('run_10'))
    expect(screen.getByRole('dialog').textContent).toContain('titel_moment_steigt_mit')
    expect(knoepfe()).toEqual(['fertig', 'ansehen'])
  })

  it('Speichern scheitert: Meldung, der Moment bleibt', async () => {
    eq.mockResolvedValue({ error: { message: 'boom' } })
    const { onDone } = await zeige({ kind: 'badge', id: 'streak_100' })
    fireEvent.click(document.querySelector('[data-titel-moment-act="tragen"]')!)
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('fehler_speichern'))
    expect(onDone).not.toHaveBeenCalled()
  })

  it('Wer soll deinen Titel sehen? jedes Mal, aktuelle Stufe vorausgewählt; Wahl schreibt die Feldstufe', async () => {
    await zeige({ kind: 'rank', id: 'rank_2' }, stand(null, { age: 'all', title: 'friends' }))
    const gruppe = screen.getByRole('group', { name: 'titel_moment_frage' })
    const gedrueckt = () => [...gruppe.querySelectorAll('button')].map(b => `${b.getAttribute('data-vis-option')}:${b.getAttribute('aria-pressed')}`)
    expect(gedrueckt()).toEqual(['me:false', 'friends:true', 'all:false'])
    fireEvent.click(gruppe.querySelector('[data-vis-option="all"]')!)
    expect(gedrueckt()).toEqual(['me:false', 'friends:false', 'all:true'])
    // die ganze Karte, andere Felder bleiben
    await waitFor(() => expect(update).toHaveBeenCalledWith({ field_visibility: { age: 'all', title: 'all' } }))
    fireEvent.click(gruppe.querySelector('[data-vis-option="me"]')!)
    await waitFor(() => expect(update).toHaveBeenLastCalledWith({ field_visibility: { age: 'all' } }))
  })

  it('Standard ohne gespeicherte Stufe: Nur ich', async () => {
    await zeige({ kind: 'rank', id: 'rank_1' })
    expect(document.querySelector('[data-vis-option="me"]')!.getAttribute('aria-pressed')).toBe('true')
  })

  it('Profilzeile nicht lesbar: keine Frage (nichts überschreiben), nur Fertig / Titel ansehen', async () => {
    await zeige({ kind: 'badge', id: 'run_10' }, 'fehler')
    expect(screen.queryByRole('group')).toBeNull()
    expect(knoepfe()).toEqual(['fertig', 'ansehen'])
  })

  it('Fokus in den Dialog, Escape schließt, Fokus zurück', async () => {
    const vorher = document.createElement('button')
    document.body.appendChild(vorher)
    vorher.focus()
    const { onDone, unmount } = await zeige({ kind: 'rank', id: 'rank_2' })
    const dialog = screen.getByRole('dialog')
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onDone).toHaveBeenCalledTimes(1)
    unmount()
    expect(document.activeElement).toBe(vorher)
    vorher.remove()
  })

  it('Tab bleibt im Dialog', async () => {
    await zeige({ kind: 'rank', id: 'rank_2' })
    const dialog = screen.getByRole('dialog')
    const letzter = document.querySelector<HTMLElement>('[data-titel-moment-act="ansehen"]')!
    letzter.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(dialog.querySelector('[data-vis-option="me"]'))
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(letzter)
  })

  it('Schließen mit Animation: weiter nur einmal, auch wenn das Aushängen sie abbricht', async () => {
    const handlers: { onfinish: (() => void) | null; oncancel: (() => void) | null }[] = []
    // jsdom kennt keine Web Animations API
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: () => {
        const a = { onfinish: null as (() => void) | null, oncancel: null as (() => void) | null }
        handlers.push(a)
        return a
      },
    })
    try {
      const { onDone } = await zeige({ kind: 'rank', id: 'rank_2' })
      fireEvent.click(document.querySelector('[data-titel-moment-act="fertig"]')!)
      const aus = handlers.at(-1)!
      act(() => { aus.onfinish?.(); aus.oncancel?.() })
      expect(onDone).toHaveBeenCalledTimes(1)
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate
    }
  })

  it('Titel ansehen öffnet das Profil', async () => {
    await zeige({ kind: 'rank', id: 'rank_2' })
    fireEvent.click(document.querySelector('[data-titel-moment-act="ansehen"]')!)
    expect(await screen.findByText('Profilseite')).toBeTruthy()
  })
})

describe('spieleMoment', () => {
  function baue() {
    const root = document.createElement('div')
    root.innerHTML = `<div class="tm-scrim"></div><div class="tm-light"></div><div class="tm-body"><p class="tm-eye"></p>
      <span class="tm-chip"><span class="tm-shine"></span></span><h2 class="tm-name"></h2><p class="tm-line"></p><p class="tm-sub"></p>
      <div class="tm-steps"><i data-step="new"></i></div><div class="tm-ask"></div></div><div class="tm-btns"></div>`
    const calls: { el: Element; keyframes: Keyframe[] }[] = []
    const cancel = vi.fn()
    for (const el of root.querySelectorAll('*')) {
      Object.assign(el, { animate: (keyframes: Keyframe[]) => { calls.push({ el, keyframes }); return { cancel } } })
    }
    Object.assign(root, { getAnimations: () => [{ cancel }] })
    return { root, calls, cancel }
  }
  const props = (calls: { keyframes: Keyframe[] }[]) =>
    [...new Set(calls.flatMap(c => c.keyframes.flatMap(k => Object.keys(k))))].sort()

  it('nur transform und opacity; Lichtstreif läuft einmal; bricht Laufendes ab', () => {
    const { root, calls, cancel } = baue()
    act(() => spieleMoment(root, false))
    expect(cancel).toHaveBeenCalled()
    expect(props(calls)).toEqual(['opacity', 'transform'])
    expect(calls.filter(c => c.el.classList.contains('tm-shine'))).toHaveLength(1)
  })

  it('Bewegung reduzieren: nur Einblenden, kein Lichtstreif, kein Wachsen', () => {
    const { root, calls } = baue()
    spieleMoment(root, true)
    expect(props(calls)).toEqual(['opacity'])
    expect(calls.some(c => c.el.classList.contains('tm-shine') || c.el.classList.contains('tm-chip'))).toBe(false)
  })
})
