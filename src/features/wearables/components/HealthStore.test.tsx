// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'de', language: 'de' } }),
}))
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toastMock }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

const order: string[] = []
const health = vi.hoisted(() => ({ requestPermissions: vi.fn() }))
vi.mock('../../../lib/health', () => health)
const store = vi.hoisted(() => ({
  loadHealthStoreConsent: vi.fn(), setHealthStoreConsent: vi.fn(), deleteHealthDaily: vi.fn(), countHealthDaily: vi.fn(),
}))
vi.mock('../services/healthStore', () => store)
const sync = vi.hoisted(() => ({ syncHealthDaily: vi.fn() }))
vi.mock('../hooks/useHealthDailySync', () => sync)

import { HealthStoreConsentSheet } from './HealthStoreConsentSheet'
import { HealthStoreProfile } from './HealthStoreProfile'

beforeEach(() => {
  order.length = 0
  health.requestPermissions.mockImplementation(async () => { order.push('permissions'); return { platform: 'ios', available: true, granted: true } })
  store.setHealthStoreConsent.mockImplementation(async (_: string, granted: boolean) => { order.push(`consent:${granted}`); return granted ? '2026-10-31T08:00:00Z' : null })
  store.deleteHealthDaily.mockImplementation(async () => { order.push('delete') })
  store.countHealthDaily.mockResolvedValue(0)
  sync.syncHealthDaily.mockResolvedValue(true)
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('HealthStoreConsentSheet', () => {
  it('fragt erst das System, speichert dann die Einwilligung und stoesst den Abgleich an', async () => {
    const onDone = vi.fn()
    render(<HealthStoreConsentSheet open onDone={onDone} />)
    for (const key of ['health_consent_point_what', 'health_consent_point_who', 'health_consent_point_never', 'health_consent_point_delete']) {
      expect(screen.getByText(key)).toBeTruthy()
    }
    fireEvent.click(screen.getByRole('button', { name: 'health_consent_accept' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true))
    expect(order).toEqual(['permissions', 'consent:true'])
    expect(sync.syncHealthDaily).toHaveBeenCalledWith('u1', { force: true })
  })

  it('speichert keine Einwilligung, wenn Apple Health / Health Connect fehlt', async () => {
    health.requestPermissions.mockResolvedValue({ platform: 'web', available: false, granted: false })
    const onDone = vi.fn()
    render(<HealthStoreConsentSheet open onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'health_consent_accept' }))
    expect(await screen.findByText('health_consent_unavailable')).toBeTruthy()
    expect(store.setHealthStoreConsent).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('speichert keine Einwilligung, wenn der Zugriff ganz verweigert wurde', async () => {
    health.requestPermissions.mockResolvedValue({ platform: 'android', available: true, granted: false, grantedPermissions: [] })
    render(<HealthStoreConsentSheet open onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'health_consent_accept' }))
    expect(await screen.findByText('health_consent_denied')).toBeTruthy()
    expect(store.setHealthStoreConsent).not.toHaveBeenCalled()
  })

  it('„Nicht jetzt" fragt nichts an', () => {
    const onDone = vi.fn()
    render(<HealthStoreConsentSheet open onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'health_consent_decline' }))
    expect(onDone).toHaveBeenCalledWith(false)
    expect(health.requestPermissions).not.toHaveBeenCalled()
  })

  it('zeigt geschlossen nichts', () => {
    render(<HealthStoreConsentSheet open={false} onDone={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('HealthStoreProfile', () => {
  it('zeigt ohne Einwilligung und ohne gespeicherte Werte nichts', async () => {
    store.loadHealthStoreConsent.mockResolvedValue(null)
    const { container } = render(<HealthStoreProfile />)
    await waitFor(() => expect(store.countHealthDaily).toHaveBeenCalled())
    expect(container.querySelector('[data-health-store-profile]')).toBeNull()
  })

  it('widerruft nach Bestaetigung erst, dann loescht es die Tageswerte', async () => {
    store.loadHealthStoreConsent.mockResolvedValue('2026-10-30T10:00:00Z')
    store.countHealthDaily.mockResolvedValue(5)
    render(<HealthStoreProfile />)
    fireEvent.click(await screen.findByRole('button', { name: 'health_profile_delete' }))
    expect(store.deleteHealthDaily).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'health_profile_delete_yes' }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('health_profile_deleted'))
    expect(order).toEqual(['consent:false', 'delete'])
    expect(store.deleteHealthDaily).toHaveBeenCalledWith('u1')
  })

  it('Abbrechen loescht nichts', async () => {
    store.loadHealthStoreConsent.mockResolvedValue('2026-10-30T10:00:00Z')
    render(<HealthStoreProfile />)
    fireEvent.click(await screen.findByRole('button', { name: 'health_profile_delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(store.deleteHealthDaily).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'health_profile_revoke' })).toBeTruthy()
  })

  it('widerruft ohne zu loeschen', async () => {
    store.loadHealthStoreConsent.mockResolvedValue('2026-10-30T10:00:00Z')
    render(<HealthStoreProfile />)
    fireEvent.click(await screen.findByRole('button', { name: 'health_profile_revoke' }))
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('health_profile_revoked'))
    expect(order).toEqual(['consent:false'])
    expect(store.deleteHealthDaily).not.toHaveBeenCalled()
  })

  it('bietet nach Widerruf auf einem anderen Geraet das Loeschen gespeicherter Werte an', async () => {
    store.loadHealthStoreConsent.mockResolvedValue(null)
    store.countHealthDaily.mockResolvedValue(3)
    render(<HealthStoreProfile />)
    expect(await screen.findByText('health_profile_off')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'health_profile_revoke' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'health_profile_delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'health_profile_delete_yes' }))
    await waitFor(() => expect(store.deleteHealthDaily).toHaveBeenCalledWith('u1'))
    // Auch hier zuerst widerrufen: der lokale Stand kann veraltet sein.
    expect(order).toEqual(['consent:false', 'delete'])
  })
})
