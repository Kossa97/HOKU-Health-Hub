// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const native = vi.hoisted(() => ({ on: true }))
const plugin = vi.hoisted(() => ({
  listener: null as null | ((event: { url: string }) => void),
  remove: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.on } }))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((_event: string, fn: (event: { url: string }) => void) => {
      plugin.listener = fn
      return Promise.resolve({ remove: plugin.remove })
    }),
  },
}))

import { App } from '@capacitor/app'
import { AppLinkListener } from './AppLinkListener'

function Where() {
  return <span data-testid="pfad">{useLocation().pathname}</span>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppLinkListener />
      <Routes><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>,
  )
}

describe('AppLinkListener', () => {
  beforeEach(() => { native.on = true; plugin.listener = null; vi.clearAllMocks() })
  afterEach(cleanup)

  it('springt bei einem Profil-Link auf /u/<name>', () => {
    renderAt('/kalender')
    expect(App.addListener).toHaveBeenCalledWith('appUrlOpen', expect.any(Function))
    act(() => plugin.listener?.({ url: 'https://hokuhealth.app/u/Anna' }))
    expect(screen.getByTestId('pfad').textContent).toBe('/u/anna')
  })

  it('ignoriert andere Adressen', () => {
    renderAt('/kalender')
    act(() => plugin.listener?.({ url: 'https://evil.example/u/anna' }))
    act(() => plugin.listener?.({ url: 'https://hokuhealth.app/profil' }))
    expect(screen.getByTestId('pfad').textContent).toBe('/kalender')
  })

  it('meldet sich beim Abbau ab', async () => {
    const { unmount } = renderAt('/')
    unmount()
    await Promise.resolve()
    expect(plugin.remove).toHaveBeenCalled()
  })

  it('im Browser kein Listener', () => {
    native.on = false
    renderAt('/')
    expect(App.addListener).not.toHaveBeenCalled()
  })
})
