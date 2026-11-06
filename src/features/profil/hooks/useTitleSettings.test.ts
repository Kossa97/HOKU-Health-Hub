// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** Wie in useWebSettings.test: jede Anfrage bleibt offen, bis der Test sie beantwortet. */
const db = vi.hoisted(() => {
  const gesendet: Record<string, unknown>[] = []
  const offen: ((fehler?: boolean) => void)[] = []
  const update = (werte: Record<string, unknown>) => ({
    eq: () => {
      gesendet.push(werte)
      return new Promise<{ error: { message: string } | null }>(resolve =>
        offen.push(fehler => resolve({ error: fehler ? { message: 'kaputt' } : null })))
    },
  })
  return { gesendet, offen, from: () => ({ update }) }
})
const toast = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: db.from } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('react-hot-toast', () => ({ default: toast }))

import { useTitleSettings } from './useTitleSettings'
import type { TitleSettings } from '../lib/titles'

afterEach(() => { cleanup(); db.gesendet.length = 0; db.offen.length = 0; toast.error.mockClear() })

const warten = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve() })

describe('useTitleSettings', () => {
  it('Wahl sofort sichtbar, schreibt alle drei Spalten', async () => {
    const geladen: TitleSettings = { choice: null, personalAllowed: false, consents: {} }
    const { result } = renderHook(() => useTitleSettings('u1', geladen))
    let fertig!: Promise<boolean>
    act(() => { fertig = result.current.choose('run_10') })
    expect(result.current.settings.choice).toBe('run_10')
    await warten()
    expect(db.gesendet).toEqual([{ title_choice: 'run_10', personal_titles: false, title_consents: {} }])
    db.offen[0]()
    await act(async () => { expect(await fertig).toBe(true) })
  })

  it('Fehler: zurück auf den gespeicherten Stand, mit Meldung', async () => {
    const geladen: TitleSettings = { choice: 'streak_100', personalAllowed: false, consents: {} }
    const { result } = renderHook(() => useTitleSettings('u1', geladen))
    let fertig!: Promise<boolean>
    act(() => { fertig = result.current.choose(null) })
    expect(result.current.settings.choice).toBeNull()
    await warten()
    db.offen[0](true)
    await act(async () => { expect(await fertig).toBe(false) })
    expect(result.current.settings.choice).toBe('streak_100')
    expect(toast.error).toHaveBeenCalledWith('fehler_speichern')
  })

  it('Schalter aus widerruft: Bestätigungen leer, persönlicher Titel weg; Bestätigen schreibt den Tag', async () => {
    const geladen: TitleSettings = { choice: 'body_fat_5', personalAllowed: true, consents: { body_fat_5: '2026-09-01' } }
    const { result } = renderHook(() => useTitleSettings('u1', geladen))
    act(() => { void result.current.setPersonalAllowed(false) })
    expect(result.current.settings).toEqual({ choice: null, personalAllowed: false, consents: {} })
    await warten()
    db.offen[0]()
    await warten()
    act(() => { void result.current.setPersonalAllowed(true) })
    act(() => { void result.current.consentAndWear('weight_5', '2026-09-28') })
    expect(result.current.settings).toEqual({ choice: 'weight_5', personalAllowed: true, consents: { weight_5: '2026-09-28' } })
    // nacheinander gespeichert, der letzte zuletzt
    await warten(); db.offen[1](); await warten(); db.offen[2](); await warten()
    expect(db.gesendet).toEqual([
      { title_choice: null, personal_titles: false, title_consents: {} },
      { title_choice: null, personal_titles: true, title_consents: {} },
      { title_choice: 'weight_5', personal_titles: true, title_consents: { weight_5: '2026-09-28' } },
    ])
  })
})
