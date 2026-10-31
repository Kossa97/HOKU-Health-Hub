// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const health = vi.hoisted(() => ({ isNative: true }))
vi.mock('../../../lib/health', () => health)

import { useHealthConsentAsk } from './useHealthConsentAsk'

afterEach(() => { cleanup(); localStorage.clear(); health.isNative = true })

describe('useHealthConsentAsk', () => {
  it('fragt bei pausiertem Import einmal und danach nicht mehr', () => {
    const first = renderHook(({ paused }) => useHealthConsentAsk('u1', paused), { initialProps: { paused: false } })
    expect(first.result.current.open).toBe(false)
    first.rerender({ paused: true })
    expect(first.result.current.open).toBe(true)
    act(() => first.result.current.done())
    expect(first.result.current.open).toBe(false)
    first.unmount()

    // Naechstes Oeffnen des Trainings: abgelehnt bleibt abgelehnt, Nachholen geht in den Einstellungen.
    const again = renderHook(() => useHealthConsentAsk('u1', true))
    expect(again.result.current.open).toBe(false)
  })

  it('fragt wieder, wenn das Sheet ohne Antwort verlassen wurde', () => {
    renderHook(() => useHealthConsentAsk('u2', true)).unmount()
    expect(renderHook(() => useHealthConsentAsk('u2', true)).result.current.open).toBe(true)
  })

  it('fragt im Browser nie und ohne Nutzer nie', () => {
    expect(renderHook(() => useHealthConsentAsk(null, true)).result.current.open).toBe(false)
    health.isNative = false
    expect(renderHook(() => useHealthConsentAsk('u3', true)).result.current.open).toBe(false)
  })
})
