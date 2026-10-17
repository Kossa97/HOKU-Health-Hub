// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { applyLook, getLook, useLook } from './look'

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-look')
})

describe('Erscheinungsbild', () => {
  it('ist ohne Wahl schwarz', () => {
    expect(getLook()).toBe('schwarz')
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

  it('nimmt unbekannte Werte als schwarz', () => {
    localStorage.setItem('tyd_look', 'neon')
    expect(getLook()).toBe('schwarz')
  })
})
