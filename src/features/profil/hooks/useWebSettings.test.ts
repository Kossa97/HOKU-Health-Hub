// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Jeder Tipp schreibt die ganze Spalte. Die Attrappe hält jede Anfrage offen,
 * bis der Test sie beantwortet (mit oder ohne Fehler), und merkt sich, was in
 * welcher Reihenfolge gesendet wurde.
 */
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

import { useWebSettings } from './useWebSettings'

afterEach(() => { cleanup(); db.gesendet.length = 0; db.offen.length = 0; toast.error.mockClear() })

const warten = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve() })

describe('useWebSettings', () => {
  it('Standard ohne Abweichung: heikle aus, sonst an', () => {
    const { result } = renderHook(() => useWebSettings('u1', { badges: {}, indexable: false }))
    expect(result.current.isBadgeOn('first_bloodwork')).toBe(false)
    expect(result.current.isBadgeOn('streak_7')).toBe(true)
    expect(result.current.badges).toEqual({})
    expect(result.current.indexable).toBe(false)
  })

  it('schnelle Tipps werden nacheinander gespeichert, nur Abweichungen, der letzte zuletzt', async () => {
    const geladen = { badges: {}, indexable: false }
    const { result } = renderHook(() => useWebSettings('u1', geladen))

    let erster!: Promise<boolean>, zweiter!: Promise<boolean>
    act(() => { erster = result.current.setBadge('first_bloodwork', true) })
    act(() => { zweiter = result.current.setBadge('workouts_10', false) })

    // Beide Tipps sind sofort sichtbar, der zweite geht erst nach dem ersten raus.
    expect(result.current.badges).toEqual({ first_bloodwork: true, workouts_10: false })
    expect(result.current.isBadgeOn('first_bloodwork')).toBe(true)
    await warten()
    expect(db.gesendet).toEqual([{ web_badges: { first_bloodwork: true } }])

    await act(async () => { db.offen.shift()!(); await erster })
    expect(db.gesendet).toEqual([
      { web_badges: { first_bloodwork: true } },
      { web_badges: { first_bloodwork: true, workouts_10: false } },
    ])

    await act(async () => { db.offen.shift()!(); await zweiter })
    expect(result.current.badges).toEqual({ first_bloodwork: true, workouts_10: false })
  })

  it('zurück auf Standard entfernt die Abweichung; Zurücksetzen schreibt {}', async () => {
    const geladen = { badges: { first_bloodwork: true, workouts_10: false }, indexable: false }
    const { result } = renderHook(() => useWebSettings('u1', geladen))

    let p!: Promise<boolean>
    act(() => { p = result.current.setBadge('first_bloodwork', false) })
    await warten()
    await act(async () => { db.offen.shift()!(); await p })
    expect(db.gesendet.at(-1)).toEqual({ web_badges: { workouts_10: false } })

    act(() => { p = result.current.resetBadges() })
    await warten()
    await act(async () => { db.offen.shift()!(); await p })
    expect(db.gesendet.at(-1)).toEqual({ web_badges: {} })
    expect(result.current.badges).toEqual({})
  })

  it('Fehler setzt den Schalter zurück und meldet sich', async () => {
    const geladen = { badges: {}, indexable: false }
    const { result } = renderHook(() => useWebSettings('u1', geladen))

    let p!: Promise<boolean>
    act(() => { p = result.current.setBadge('first_bloodwork', true) })
    expect(result.current.isBadgeOn('first_bloodwork')).toBe(true)
    await warten()
    let ok: boolean | undefined
    await act(async () => { db.offen.shift()!(true); ok = await p })
    expect(ok).toBe(false)
    expect(result.current.isBadgeOn('first_bloodwork')).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('fehler_speichern')
  })

  it('scheitern zwei Tipps nacheinander, gilt wieder der gespeicherte Stand, nicht der erste Tipp', async () => {
    const geladen = { badges: {}, indexable: false }
    const { result } = renderHook(() => useWebSettings('u1', geladen))

    let a!: Promise<boolean>, b!: Promise<boolean>
    act(() => { a = result.current.setBadge('first_bloodwork', true) })
    act(() => { b = result.current.setBadge('workouts_10', false) })
    await warten()
    await act(async () => { db.offen.shift()!(true); await a })
    // Der zweite Tipp liegt noch darüber und enthält den ersten.
    expect(result.current.badges).toEqual({ first_bloodwork: true, workouts_10: false })
    await warten()
    await act(async () => { db.offen.shift()!(true); await b })
    expect(result.current.badges).toEqual({})
    expect(result.current.isBadgeOn('first_bloodwork')).toBe(false)
  })

  it('Fehler nach einem gespeicherten Tipp: zurück auf genau diesen', async () => {
    const geladen = { badges: {}, indexable: false }
    const { result } = renderHook(() => useWebSettings('u1', geladen))

    let a!: Promise<boolean>, b!: Promise<boolean>
    act(() => { a = result.current.setBadge('first_bloodwork', true) })
    await warten()
    await act(async () => { db.offen.shift()!(); await a })
    act(() => { b = result.current.setBadge('workouts_10', false) })
    await warten()
    await act(async () => { db.offen.shift()!(true); await b })
    expect(result.current.badges).toEqual({ first_bloodwork: true })
  })

  it('Fehler eines älteren Tipps überschreibt keinen neueren (auch bei gleichem Wert)', async () => {
    const geladen = { badges: {}, indexable: false }
    const { result } = renderHook(() => useWebSettings('u1', geladen))

    let a!: Promise<boolean>, b!: Promise<boolean>, c!: Promise<boolean>
    act(() => { a = result.current.setIndexable(true) })
    act(() => { b = result.current.setIndexable(false) })
    act(() => { c = result.current.setIndexable(true) })
    expect(result.current.indexable).toBe(true)

    await warten()
    await act(async () => { db.offen.shift()!(true); await a })
    // Der dritte Tipp liegt darüber: kein Zurücksetzen auf „aus“.
    expect(result.current.indexable).toBe(true)
    await warten()
    await act(async () => { db.offen.shift()!(); await b })
    await warten()
    await act(async () => { db.offen.shift()!(); await c })
    expect(db.gesendet).toEqual([{ web_indexable: true }, { web_indexable: false }, { web_indexable: true }])
    expect(result.current.indexable).toBe(true)
  })

  it('neuer Stand vom Server gilt wieder; ohne Nutzer wird nichts gespeichert', async () => {
    let geladen: { badges: Record<string, boolean> | null; indexable: boolean | null } = { badges: {}, indexable: false }
    const { result, rerender } = renderHook(() => useWebSettings('u1', geladen))
    act(() => { void result.current.setBadge('first_bloodwork', true) })
    geladen = { badges: { workouts_10: false }, indexable: true }
    rerender()
    expect(result.current.badges).toEqual({ workouts_10: false })
    expect(result.current.indexable).toBe(true)

    const ohne = renderHook(() => useWebSettings(undefined, { badges: null, indexable: null }))
    let ok: boolean | undefined
    await act(async () => { ok = await ohne.result.current.setIndexable(true) })
    expect(ok).toBe(false)
    expect(ohne.result.current.indexable).toBe(false)
    expect(db.gesendet.some(w => 'web_indexable' in w)).toBe(false)
  })
})
