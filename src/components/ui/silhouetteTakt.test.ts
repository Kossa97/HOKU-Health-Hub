// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { silhouetteFuerPfad, useLadephase } from './silhouetteTakt'

describe('silhouetteFuerPfad', () => {
  it('ordnet jeder Seite ihren Umriss zu', () => {
    expect(silhouetteFuerPfad('/')).toBe('start')
    expect(silhouetteFuerPfad('/kalender')).toBe('kalender')
    expect(silhouetteFuerPfad('/my-stack/')).toBe('stack')
    expect(silhouetteFuerPfad('/blutwerte')).toBe('blutwerte')
    expect(silhouetteFuerPfad('/health')).toBe('karten')
    expect(silhouetteFuerPfad('/bewertungen')).toBe('liste')
    expect(silhouetteFuerPfad('/lab')).toBe('lab')
    expect(silhouetteFuerPfad('/lab/study/1')).toBe('karten')
    expect(silhouetteFuerPfad('/profil')).toBe('profil')
    expect(silhouetteFuerPfad('/simulation/neu')).toBe('karten')
  })
})

describe('useLadephase', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('schnelles Laden: keine Silhouette, kein Überblenden', () => {
    const { result, rerender } = renderHook(({ laedt }) => useLadephase(laedt), { initialProps: { laedt: true } })
    expect(result.current).toBe('laden')
    act(() => { vi.advanceTimersByTime(100) })
    rerender({ laedt: false })
    expect(result.current).toBe('fertig')
  })

  it('erschienene Silhouette bleibt nach dem Einblenden 300 ms, dann blendet der Inhalt einmal über', () => {
    const { result, rerender } = renderHook(({ laedt }) => useLadephase(laedt), { initialProps: { laedt: true } })
    act(() => { vi.advanceTimersByTime(260) })
    rerender({ laedt: false })
    expect(result.current).toBe('laden')
    act(() => { vi.advanceTimersByTime(550) })
    expect(result.current).toBe('laden')
    act(() => { vi.advanceTimersByTime(40) })
    expect(result.current).toBe('einblenden')
    act(() => { vi.advanceTimersByTime(400) })
    expect(result.current).toBe('fertig')
  })
})
