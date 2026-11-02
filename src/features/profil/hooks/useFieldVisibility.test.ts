// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Jeder Tipp schreibt die ganze Karte. Die Attrappe hält jede Anfrage offen,
 * bis der Test sie beantwortet, und merkt sich, was in welcher Reihenfolge
 * gesendet wurde.
 */
const db = vi.hoisted(() => {
  const gesendet: unknown[] = []
  const offen: (() => void)[] = []
  const update = (werte: { field_visibility: unknown }) => ({
    eq: () => {
      gesendet.push(werte.field_visibility)
      return new Promise<{ error: null }>(resolve => offen.push(() => resolve({ error: null })))
    },
  })
  return { gesendet, offen, from: () => ({ update }) }
})
vi.mock('../../../lib/supabase', () => ({ supabase: { from: db.from } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

import { useFieldVisibility } from './useFieldVisibility'

afterEach(() => { cleanup(); db.gesendet.length = 0; db.offen.length = 0 })

describe('useFieldVisibility', () => {
  it('schnelle Tipps werden nacheinander gespeichert, der letzte zuletzt', async () => {
    const geladen = {}
    const { result } = renderHook(() => useFieldVisibility('u1', geladen))

    let erster!: Promise<boolean>, zweiter!: Promise<boolean>
    act(() => { erster = result.current.setField('age', 'friends') })
    act(() => { zweiter = result.current.setField('age', 'all') })

    // Der zweite Tipp ist sofort sichtbar, geht aber erst nach dem ersten raus.
    expect(result.current.map).toEqual({ age: 'all' })
    await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve() })
    expect(db.gesendet).toEqual([{ age: 'friends' }])

    await act(async () => { db.offen.shift()!(); await erster })
    expect(db.gesendet).toEqual([{ age: 'friends' }, { age: 'all' }])

    await act(async () => { db.offen.shift()!(); await zweiter })
    expect(result.current.map).toEqual({ age: 'all' })
  })
})
