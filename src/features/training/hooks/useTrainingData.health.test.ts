// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TRAINING_SETTINGS } from '../types'

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
// Kontext (Gewicht, Stack …) ist hier egal: jede Abfrage scheitert, das Training laeuft trotzdem.
vi.mock('../../../lib/supabase', () => ({ supabase: { from: () => { throw new Error('keine Datenbank') } } }))

const health = vi.hoisted(() => ({
  isNative: true, isIOS: true, isAndroid: false,
  requestPermissions: vi.fn(), getWorkouts: vi.fn(), getSleep: vi.fn(), getRestingHeartRate: vi.fn(),
}))
vi.mock('../../../lib/health', () => health)

const repo = vi.hoisted(() => ({
  MAX_DISMISSED: 500,
  loadSessions: vi.fn(), loadRoutines: vi.fn(), loadCustomExercises: vi.fn(), loadSettings: vi.fn(),
  isMissingTable: () => false, importSessions: vi.fn(), enrichSession: vi.fn(), saveSettings: vi.fn(),
}))
vi.mock('../services/trainingRepo', () => repo)

const store = vi.hoisted(() => ({ loadHealthStoreConsent: vi.fn(), setHealthStoreConsent: vi.fn() }))
vi.mock('../../wearables/services/healthStore', () => store)

import { useTrainingData } from './useTrainingData'

beforeEach(() => {
  repo.loadSessions.mockResolvedValue([])
  repo.loadRoutines.mockResolvedValue([])
  repo.loadCustomExercises.mockResolvedValue([])
  repo.loadSettings.mockResolvedValue({ ...DEFAULT_TRAINING_SETTINGS, healthImport: true })
  health.getWorkouts.mockResolvedValue([])
  health.getSleep.mockResolvedValue([])
  health.getRestingHeartRate.mockResolvedValue([])
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('useTrainingData: Workout-Import nur mit Einwilligung', () => {
  it('pausiert den Import, wenn healthImport an ist, aber die Einwilligung fehlt', async () => {
    store.loadHealthStoreConsent.mockResolvedValue(null)
    const { result } = renderHook(() => useTrainingData())
    await waitFor(() => expect(result.current.healthImportPaused).toBe(true))
    await flush()
    expect(health.getWorkouts).not.toHaveBeenCalled()
    expect(health.getSleep).not.toHaveBeenCalled()
    expect(health.getRestingHeartRate).not.toHaveBeenCalled()
    expect(result.current.settings.healthImport).toBe(true)
  })

  it('importiert mit Einwilligung wie bisher', async () => {
    store.loadHealthStoreConsent.mockResolvedValue('2026-10-30T10:00:00Z')
    const { result } = renderHook(() => useTrainingData())
    await waitFor(() => expect(health.getWorkouts).toHaveBeenCalledTimes(1))
    expect(health.getSleep).toHaveBeenCalled()
    expect(result.current.healthImportPaused).toBe(false)
  })

  it('importiert nicht, solange die Einwilligung nicht gelesen werden kann', async () => {
    store.loadHealthStoreConsent.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useTrainingData())
    await waitFor(() => expect(result.current.state).toBe('ready'))
    await flush()
    expect(health.getWorkouts).not.toHaveBeenCalled()
    expect(result.current.healthImportPaused).toBe(false)
  })

  it('holt den Import nach, sobald die Einwilligung erteilt ist', async () => {
    store.loadHealthStoreConsent.mockResolvedValue(null)
    const { result } = renderHook(() => useTrainingData())
    await waitFor(() => expect(result.current.healthImportPaused).toBe(true))
    store.loadHealthStoreConsent.mockResolvedValue('2026-10-31T08:00:00Z')
    act(() => result.current.reloadHealthConsent())
    await waitFor(() => expect(health.getWorkouts).toHaveBeenCalledTimes(1))
    expect(result.current.healthImportPaused).toBe(false)
  })

  it('prueft die Einwilligung direkt vor dem Uebernehmen noch einmal', async () => {
    const workout = {
      externalId: 'w1', activityType: 'Running', startDate: new Date(2026, 9, 30, 7), endDate: new Date(2026, 9, 30, 8),
      durationS: 3600, distanceM: null, kcal: null, avgHr: null,
    }
    health.getWorkouts.mockResolvedValue([workout])
    repo.importSessions.mockResolvedValue(1)
    // 1. Hook-Stand, 2. vor dem Lesen, 3. vor dem Schreiben — dazwischen widerrufen.
    store.loadHealthStoreConsent.mockResolvedValueOnce('c').mockResolvedValueOnce('c').mockResolvedValue(null)
    renderHook(() => useTrainingData())
    await waitFor(() => expect(health.getWorkouts).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(store.loadHealthStoreConsent).toHaveBeenCalledTimes(3))
    await flush()
    expect(repo.importSessions).not.toHaveBeenCalled()
  })

  it('uebernimmt neue Workouts mit Einwilligung', async () => {
    health.getWorkouts.mockResolvedValue([{
      externalId: 'w1', activityType: 'Running', startDate: new Date(2026, 9, 30, 7), endDate: new Date(2026, 9, 30, 8),
      durationS: 3600, distanceM: null, kcal: null, avgHr: null,
    }])
    repo.importSessions.mockResolvedValue(1)
    store.loadHealthStoreConsent.mockResolvedValue('c')
    renderHook(() => useTrainingData())
    await waitFor(() => expect(repo.importSessions).toHaveBeenCalledTimes(1))
  })

  it('„Jetzt synchronisieren" prueft die Einwilligung frisch (Widerruf auf anderem Geraet)', async () => {
    store.loadHealthStoreConsent.mockResolvedValue('2026-10-30T10:00:00Z')
    const { result } = renderHook(() => useTrainingData())
    await waitFor(() => expect(health.getWorkouts).toHaveBeenCalledTimes(1))
    store.loadHealthStoreConsent.mockResolvedValue(null)
    await expect(result.current.syncHealthWorkouts()).resolves.toEqual({ created: 0, enriched: 0 })
    expect(health.getWorkouts).toHaveBeenCalledTimes(1)
  })
})
