// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkProfileMedia = vi.fn(async (_k: string): Promise<string | null> => 'approved')
vi.mock('../services/profileMedia', () => ({ checkProfileMedia: (k: string) => checkProfileMedia(k) }))

import { useBildPruefungNachholen } from './useBildPruefungNachholen'
import type { MediaKind } from '../services/profileMedia'

beforeEach(() => { checkProfileMedia.mockReset(); checkProfileMedia.mockResolvedValue('approved') })

describe('useBildPruefungNachholen', () => {
  it('wartet, bis bekannt ist, was offen ist; prüft dann einmal je Bild', async () => {
    const onErgebnis = vi.fn()
    type Offen = { kind: MediaKind; pfad: string }[] | null
    const { rerender } = renderHook(({ offen }: { offen: Offen }) => useBildPruefungNachholen(offen, onErgebnis), {
      initialProps: { offen: null as Offen },
    })
    expect(checkProfileMedia).not.toHaveBeenCalled()

    checkProfileMedia.mockImplementation(async k => (k === 'cover' ? 'rejected' : 'approved'))
    rerender({ offen: [{ kind: 'avatar', pfad: 'u1/a.jpg' }, { kind: 'cover', pfad: 'u1/c.jpg' }] })
    await waitFor(() => expect(onErgebnis).toHaveBeenCalledTimes(2))
    expect(onErgebnis).toHaveBeenCalledWith('avatar', 'approved', 'u1/a.jpg')
    expect(onErgebnis).toHaveBeenCalledWith('cover', 'rejected', 'u1/c.jpg')

    rerender({ offen: [{ kind: 'avatar', pfad: 'u1/a.jpg' }] })
    expect(checkProfileMedia).toHaveBeenCalledTimes(2)
  })

  it('bleibt es bei „wird geprüft“, meldet es nichts', async () => {
    checkProfileMedia.mockResolvedValue('pending')
    const onErgebnis = vi.fn()
    renderHook(() => useBildPruefungNachholen([{ kind: 'avatar', pfad: 'u1/a.jpg' }], onErgebnis))
    await waitFor(() => expect(checkProfileMedia).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(onErgebnis).not.toHaveBeenCalled()
  })

  it('nichts offen: kein Aufruf', () => {
    renderHook(() => useBildPruefungNachholen([], vi.fn()))
    expect(checkProfileMedia).not.toHaveBeenCalled()
  })
})
