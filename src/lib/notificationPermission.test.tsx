// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationHint } from '../components/NotificationHint'
import { notificationSupport, requestNotificationPermission, useNotificationSupport } from './notificationPermission'

const native = vi.hoisted(() => ({ on: false }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.on, getPlatform: () => (native.on ? 'ios' : 'web') },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: 'de', language: 'de' } }),
}))

function stubNotification(permission: NotificationPermission, answer: NotificationPermission = permission) {
  const api = {
    permission,
    requestPermission: vi.fn(async () => { api.permission = answer; return answer }),
  }
  ;(globalThis as unknown as { Notification?: unknown }).Notification = api
  return api
}

afterEach(() => {
  cleanup()
  native.on = false
  // @ts-expect-error -- Testaufraeumen
  delete globalThis.Notification
})

describe('Erlaubnis fuer Mitteilungen', () => {
  it('zeigt den Systemdialog nur, wenn noch nie gefragt wurde', async () => {
    const api = stubNotification('default', 'granted')
    await expect(requestNotificationPermission()).resolves.toBe('granted')
    expect(api.requestPermission).toHaveBeenCalledTimes(1)

    await requestNotificationPermission()
    expect(api.requestPermission).toHaveBeenCalledTimes(1)
  })

  it('fragt nach einer Ablehnung nicht erneut', async () => {
    const api = stubNotification('denied')
    await expect(requestNotificationPermission()).resolves.toBe('denied')
    expect(api.requestPermission).not.toHaveBeenCalled()
  })

  it('Hinweise ziehen nach der Antwort sofort nach', async () => {
    stubNotification('default', 'denied')
    const { result } = renderHook(() => useNotificationSupport())
    expect(result.current).toBe('default')
    await act(async () => { await requestNotificationPermission() })
    expect(result.current).toBe('denied')
  })

  it('erkennt die Store-App', () => {
    native.on = true
    stubNotification('default')
    expect(notificationSupport()).toBe('native-app')
  })
})

describe('NotificationHint', () => {
  it('sagt bei Ablehnung, dass Mitteilungen aus sind', () => {
    render(<NotificationHint state="denied" />)
    expect(screen.getByRole('status').textContent).toContain('Mitteilungen sind aus')
  })

  it('schweigt, solange nichts im Weg steht', () => {
    const { container } = render(<><NotificationHint state="default" /><NotificationHint state="subscribed" /><NotificationHint state="granted" /></>)
    expect(container.textContent).toBe('')
  })

  it('kennt beide Namen der Store-App', () => {
    render(<><NotificationHint state="ios-native-app" /><NotificationHint state="native-app" /></>)
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })
})
