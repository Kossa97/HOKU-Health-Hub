// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const health = vi.hoisted(() => ({
  isNative: true, isIOS: true, isAndroid: false,
  requestPermissions: vi.fn(),
  getStepsByDay: vi.fn(),
  getRestingHeartRate: vi.fn(),
  getSleep: vi.fn(),
  getActiveEnergy: vi.fn(),
  getOxygenSaturation: vi.fn(),
  getRespiratoryRate: vi.fn(),
  getBloodPressure: vi.fn(),
}))
vi.mock('../../../lib/health', () => health)

const store = vi.hoisted(() => ({ loadHealthStoreConsent: vi.fn(), upsertHealthDaily: vi.fn() }))
vi.mock('../services/healthStore', async importOriginal => ({
  ...(await importOriginal<typeof import('../services/healthStore')>()),
  ...store,
}))
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }))

import { syncHealthDaily, useHealthDailySync } from './useHealthDailySync'

const CONSENT = '2026-10-30T10:00:00.000Z'
// Eigene Nutzer-ID je Test: „einmal pro App-Start" gilt je Nutzer und Modul.
let n = 0
const nextUser = () => `user-${++n}`

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 31, 12, 0))
  localStorage.clear()
  for (const fn of [health.getRestingHeartRate, health.getSleep, health.getActiveEnergy,
    health.getOxygenSaturation, health.getRespiratoryRate, health.getBloodPressure]) fn.mockResolvedValue([])
  health.getStepsByDay.mockResolvedValue([
    { start: new Date(2026, 9, 30, 0, 0), count: 8000, source: 'watch' },
    { start: new Date(2026, 9, 31, 0, 0), count: 3000, source: 'watch' },
  ])
  store.upsertHealthDaily.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  auth.user = null
})

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('useHealthDailySync', () => {
  it('schreibt ohne Einwilligung nichts und liest auch nichts aus Apple Health', async () => {
    auth.user = { id: nextUser() }
    store.loadHealthStoreConsent.mockResolvedValue(null)
    renderHook(() => useHealthDailySync())
    await waitFor(() => expect(store.loadHealthStoreConsent).toHaveBeenCalled())
    await flush()
    expect(store.upsertHealthDaily).not.toHaveBeenCalled()
    expect(health.getStepsByDay).not.toHaveBeenCalled()
    expect(health.requestPermissions).not.toHaveBeenCalled()
  })

  it('schreibt mit Einwilligung die Tageswerte des Fensters und fragt nie nach Berechtigungen', async () => {
    const userId = nextUser()
    auth.user = { id: userId }
    store.loadHealthStoreConsent.mockResolvedValue(CONSENT)
    renderHook(() => useHealthDailySync())
    await waitFor(() => expect(store.upsertHealthDaily).toHaveBeenCalledTimes(1))
    const [uid, rows, source] = store.upsertHealthDaily.mock.calls[0]
    expect(uid).toBe(userId)
    expect(source).toBe('healthkit')
    expect((rows as { day: string; steps: number }[]).map(r => [r.day, r.steps])).toEqual([['2026-10-30', 8000], ['2026-10-31', 3000]])
    // Ohne Stand: ab 1. Oktober, gelesen ab Mitternacht des Vortags (Schlaf ab 18 Uhr).
    const options = health.getStepsByDay.mock.calls[0][0] as { startDate: Date; endDate: Date }
    expect(options.startDate).toEqual(new Date(2026, 8, 30))
    expect(options.endDate).toEqual(new Date(2026, 9, 31, 12, 0))
    expect(health.requestPermissions).not.toHaveBeenCalled()
  })

  it('laeuft hoechstens einmal pro App-Start, auch wenn das Layout neu eingehaengt wird', async () => {
    auth.user = { id: nextUser() }
    store.loadHealthStoreConsent.mockResolvedValue(CONSENT)
    const first = renderHook(() => useHealthDailySync())
    await waitFor(() => expect(store.upsertHealthDaily).toHaveBeenCalledTimes(1))
    first.unmount()
    renderHook(() => useHealthDailySync())
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(store.loadHealthStoreConsent).toHaveBeenCalledTimes(2) // vor dem Lesen und vor dem Schreiben des ersten Laufs
    expect(store.upsertHealthDaily).toHaveBeenCalledTimes(1)
  })

  it('schreibt im zweiten Lauf nichts, wenn die Einwilligung dazwischen widerrufen wurde', async () => {
    auth.user = { id: nextUser() }
    store.loadHealthStoreConsent.mockResolvedValue(CONSENT)
    renderHook(() => useHealthDailySync())
    await waitFor(() => expect(store.upsertHealthDaily).toHaveBeenCalledTimes(1))

    // Auf einem anderen Geraet widerrufen; 6 h spaeter kommt die App wieder in den Vordergrund.
    store.loadHealthStoreConsent.mockResolvedValue(null)
    health.getStepsByDay.mockClear()
    vi.setSystemTime(new Date(2026, 9, 31, 18, 1))
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(store.loadHealthStoreConsent).toHaveBeenCalledTimes(3))
    await flush()
    expect(store.upsertHealthDaily).toHaveBeenCalledTimes(1)
    expect(health.getStepsByDay).not.toHaveBeenCalled()
    expect(health.requestPermissions).not.toHaveBeenCalled()
  })

  it('schreibt nichts, wenn die Einwilligung waehrend des Lesens widerrufen wurde', async () => {
    const userId = nextUser()
    store.loadHealthStoreConsent.mockResolvedValueOnce(CONSENT).mockResolvedValueOnce(null)
    await expect(syncHealthDaily(userId)).resolves.toBe(false)
    expect(health.getStepsByDay).toHaveBeenCalled()
    expect(store.upsertHealthDaily).not.toHaveBeenCalled()
    expect(localStorage.getItem(`hoku.healthDaily.last.${userId}`)).toBeNull()
  })

  it('merkt sich den Stand und liest danach nur ab dem Tag vor dem letzten Stand', async () => {
    const userId = nextUser()
    store.loadHealthStoreConsent.mockResolvedValue(CONSENT)
    await expect(syncHealthDaily(userId)).resolves.toBe(true)
    expect(localStorage.getItem(`hoku.healthDaily.last.${userId}`)).not.toBeNull()

    health.getStepsByDay.mockClear()
    vi.setSystemTime(new Date(2026, 10, 1, 9, 0))
    await expect(syncHealthDaily(userId, { force: true })).resolves.toBe(true)
    const options = health.getStepsByDay.mock.calls[0][0] as { startDate: Date }
    // Stand 31.10. -> Fenster ab 30.10., gelesen ab 29.10.
    expect(options.startDate).toEqual(new Date(2026, 9, 29))
    const rows = store.upsertHealthDaily.mock.calls[1][1] as { day: string }[]
    expect(rows.map(r => r.day)).toEqual(['2026-10-30', '2026-10-31'])
  })

  it('beginnt nach neuer Einwilligung wieder mit 30 Tagen', async () => {
    const userId = nextUser()
    store.loadHealthStoreConsent.mockResolvedValue(CONSENT)
    await syncHealthDaily(userId)
    health.getStepsByDay.mockClear()
    store.loadHealthStoreConsent.mockResolvedValue('2026-10-31T11:00:00.000Z')
    await syncHealthDaily(userId, { force: true })
    const options = health.getStepsByDay.mock.calls[0][0] as { startDate: Date }
    expect(options.startDate).toEqual(new Date(2026, 8, 30))
  })

  it('schreibt nichts, wenn die Einwilligung nicht gelesen werden kann, und versucht es danach ohne 6-h-Sperre wieder', async () => {
    const userId = nextUser()
    store.loadHealthStoreConsent.mockRejectedValue(new Error('offline'))
    await expect(syncHealthDaily(userId)).rejects.toThrow('offline')
    expect(store.upsertHealthDaily).not.toHaveBeenCalled()
    store.loadHealthStoreConsent.mockResolvedValue(CONSENT)
    await expect(syncHealthDaily(userId)).resolves.toBe(true)
    expect(store.upsertHealthDaily).toHaveBeenCalledTimes(1)
  })

  it('laesst eine fehlgeschlagene Kennzahl ganz aus dem Upsert weg und schiebt den Stand nicht vor', async () => {
    const userId = nextUser()
    store.loadHealthStoreConsent.mockResolvedValue(CONSENT)
    // Gespeicherter Ruhepuls existiert serverseitig; dieser Lauf kann ihn nicht lesen.
    health.getRestingHeartRate.mockRejectedValue(new Error('SecurityException'))
    health.getBloodPressure.mockRejectedValue(new Error('SecurityException'))
    await expect(syncHealthDaily(userId)).resolves.toBe(true)
    const rows = store.upsertHealthDaily.mock.calls[0][1] as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row).not.toHaveProperty('resting_hr')
      expect(row).not.toHaveProperty('bp_sys')
      expect(row).not.toHaveProperty('bp_dia')
      expect(row).toHaveProperty('steps')
    }
    expect(localStorage.getItem(`hoku.healthDaily.last.${userId}`)).toBeNull()
  })

  it('schickt eine an einem Tag fehlende Kennzahl nicht als NULL (gespeicherter Wert bleibt)', async () => {
    const userId = nextUser()
    store.loadHealthStoreConsent.mockResolvedValue(CONSENT)
    // Ruhepuls nur fuer den 30.10.; heute (31.10.) fehlt er. iOS liefert bei verweigertem Lesen ebenfalls [].
    health.getRestingHeartRate.mockResolvedValue([{ bpm: 58, date: new Date(2026, 9, 30, 7, 0) }])
    await expect(syncHealthDaily(userId)).resolves.toBe(true)
    const rows = store.upsertHealthDaily.mock.calls[0][1] as Record<string, unknown>[]
    expect(rows).toEqual([
      { day: '2026-10-30', steps: 8000, resting_hr: 58 },
      { day: '2026-10-31', steps: 3000 },
    ])
    for (const row of rows) expect(Object.values(row)).not.toContain(null)
  })

  it('schreibt keine Zeile, wenn keine einzige Kennzahl gelesen werden konnte', async () => {
    const userId = nextUser()
    store.loadHealthStoreConsent.mockResolvedValue(CONSENT)
    for (const fn of [health.getStepsByDay, health.getRestingHeartRate, health.getSleep, health.getActiveEnergy,
      health.getOxygenSaturation, health.getRespiratoryRate, health.getBloodPressure]) fn.mockRejectedValue(new Error('x'))
    await syncHealthDaily(userId)
    const rows = store.upsertHealthDaily.mock.calls[0]?.[1] as unknown[] | undefined
    expect(rows ?? []).toEqual([])
    expect(localStorage.getItem(`hoku.healthDaily.last.${userId}`)).toBeNull()
  })
})
