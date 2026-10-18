// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SHEET_EXIT_MS, useSheetPresence } from './useSheetPresence'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useSheetPresence', () => {
  it('hängt beim Öffnen sofort ein, zeigt einen Frame später, hängt nach dem Ausfahren aus', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
    const { result, rerender } = renderHook(({ open }) => useSheetPresence(open), { initialProps: { open: false } })
    expect(result.current).toEqual({ mounted: false, shown: false })

    rerender({ open: true })
    expect(result.current.mounted).toBe(true)
    expect(result.current.shown).toBe(false)
    act(() => { vi.advanceTimersByTime(50) })
    expect(result.current).toEqual({ mounted: true, shown: true })

    rerender({ open: false })
    expect(result.current).toEqual({ mounted: true, shown: false })
    act(() => { vi.advanceTimersByTime(SHEET_EXIT_MS) })
    expect(result.current).toEqual({ mounted: false, shown: false })
  })

  it('bleibt eingehängt, wenn während des Ausfahrens wieder geöffnet wird', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
    const { result, rerender } = renderHook(({ open }) => useSheetPresence(open), { initialProps: { open: true } })
    act(() => { vi.advanceTimersByTime(50) })
    rerender({ open: false })
    act(() => { vi.advanceTimersByTime(SHEET_EXIT_MS / 2) })
    rerender({ open: true })
    act(() => { vi.advanceTimersByTime(SHEET_EXIT_MS) })
    expect(result.current).toEqual({ mounted: true, shown: true })
  })
})
