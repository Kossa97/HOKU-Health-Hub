// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { applyLook, getLook, useActiveLook, useLook } from './look'

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-look')
})

describe('Erscheinungsbild', () => {
  it('ist ohne Wahl HOKU', () => {
    expect(getLook()).toBe('hoku')
  })

  it('setzt data-look am html', () => {
    applyLook('licht')
    expect(document.documentElement.getAttribute('data-look')).toBe('licht')
  })

  it('merkt sich die Wahl auf dem Gerät', () => {
    const { result } = renderHook(() => useLook())
    act(() => result.current.setLook('licht'))
    expect(result.current.look).toBe('licht')
    expect(document.documentElement.getAttribute('data-look')).toBe('licht')
    expect(getLook()).toBe('licht')
  })

  it('kennt Satin', () => {
    localStorage.setItem('tyd_look', 'satin')
    expect(getLook()).toBe('satin')
  })

  it('kennt Nacht', () => {
    localStorage.setItem('tyd_look', 'nacht')
    expect(getLook()).toBe('nacht')
  })

  it('kennt Schwarz weiterhin', () => {
    localStorage.setItem('tyd_look', 'schwarz')
    expect(getLook()).toBe('schwarz')
  })

  it('kennt Instrument', () => {
    localStorage.setItem('tyd_look', 'instrument')
    expect(getLook()).toBe('instrument')
  })

  it('nimmt unbekannte Werte als HOKU', () => {
    localStorage.setItem('tyd_look', 'neon')
    expect(getLook()).toBe('hoku')
  })

  it('folgt dem Look am html', async () => {
    applyLook('schwarz')
    const { result } = renderHook(() => useActiveLook())
    expect(result.current).toBe('schwarz')
    await act(async () => { applyLook('nacht') })
    expect(result.current).toBe('nacht')
  })
})
