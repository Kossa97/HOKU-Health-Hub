// @vitest-environment jsdom

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }))

const store = vi.hoisted(() => ({ syncProfileSnapshot: vi.fn(async () => true) }))
vi.mock('../services/profileSnapshotStore', () => store)

type HookModule = typeof import('./useProfileSnapshotSync')

/** Jeder Test mit frischem Modulzustand (Start-Lauf, Timer). */
async function load(): Promise<HookModule> {
  vi.resetModules()
  return import('./useProfileSnapshotSync')
}

beforeEach(() => {
  vi.useFakeTimers()
  auth.user = { id: 'u1' }
  store.syncProfileSnapshot.mockReset()
  store.syncProfileSnapshot.mockResolvedValue(true)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useProfileSnapshotSync', () => {
  it('laeuft nach dem App-Start einmal, verzoegert', async () => {
    const m = await load()
    renderHook(() => m.useProfileSnapshotSync())
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_START_DELAY_MS - 1)
    expect(store.syncProfileSnapshot).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(store.syncProfileSnapshot).toHaveBeenCalledTimes(1)
    expect(store.syncProfileSnapshot).toHaveBeenCalledWith('u1', expect.stringMatching(/^(de|en)$/))
  })

  it('laeuft beim erneuten Einhaengen des Layouts nicht noch einmal', async () => {
    const m = await load()
    renderHook(() => m.useProfileSnapshotSync()).unmount()
    renderHook(() => m.useProfileSnapshotSync())
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_START_DELAY_MS)
    renderHook(() => m.useProfileSnapshotSync())
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_START_DELAY_MS * 2)
    expect(store.syncProfileSnapshot).toHaveBeenCalledTimes(1)
  })

  it('ohne Anmeldung nichts, auch nicht auf Anfrage', async () => {
    auth.user = null
    const m = await load()
    renderHook(() => m.useProfileSnapshotSync())
    m.requestProfileSnapshot()
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_START_DELAY_MS * 2)
    expect(store.syncProfileSnapshot).not.toHaveBeenCalled()
  })

  it('fasst mehrere Anfragen nach Eintraegen entprellt zu einem Lauf zusammen', async () => {
    const m = await load()
    renderHook(() => m.useProfileSnapshotSync())
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_START_DELAY_MS)
    store.syncProfileSnapshot.mockClear()

    m.requestProfileSnapshot()
    await vi.advanceTimersByTimeAsync(500)
    m.requestProfileSnapshot()
    await vi.advanceTimersByTimeAsync(500)
    m.requestProfileSnapshot()
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_DEBOUNCE_MS - 1)
    expect(store.syncProfileSnapshot).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(store.syncProfileSnapshot).toHaveBeenCalledTimes(1)
  })

  it('eine Anfrage waehrend eines Laufs fuehrt danach zu genau einem weiteren', async () => {
    const m = await load()
    let finish: () => void = () => {}
    store.syncProfileSnapshot.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(true) }))
    renderHook(() => m.useProfileSnapshotSync())
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_START_DELAY_MS)
    expect(store.syncProfileSnapshot).toHaveBeenCalledTimes(1)

    m.requestProfileSnapshot()
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_DEBOUNCE_MS)
    expect(store.syncProfileSnapshot).toHaveBeenCalledTimes(1)
    finish()
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_DEBOUNCE_MS)
    expect(store.syncProfileSnapshot).toHaveBeenCalledTimes(2)
  })

  it('schluckt Fehler still und versucht es beim naechsten Anlass wieder', async () => {
    const m = await load()
    store.syncProfileSnapshot.mockRejectedValueOnce(new Error('relation "profile_snapshots" does not exist'))
    renderHook(() => m.useProfileSnapshotSync())
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_START_DELAY_MS)
    m.requestProfileSnapshot()
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_DEBOUNCE_MS)
    expect(store.syncProfileSnapshot).toHaveBeenCalledTimes(2)
  })

  it('bricht einen geplanten Lauf ab, wenn der Nutzer sich abmeldet', async () => {
    const m = await load()
    const view = renderHook(() => m.useProfileSnapshotSync())
    auth.user = null
    view.rerender()
    await vi.advanceTimersByTimeAsync(m.SNAPSHOT_START_DELAY_MS * 2)
    expect(store.syncProfileSnapshot).not.toHaveBeenCalled()
  })
})

describe('Einbindung', () => {
  it('haengt im Layout neben dem Abgleich der Tageswerte', async () => {
    const { readFileSync } = await import('node:fs')
    const layout = readFileSync('src/components/Layout.tsx', 'utf8')
    expect(layout).toContain("import { useProfileSnapshotSync } from '../features/profil/hooks/useProfileSnapshotSync'")
    expect(layout.indexOf('useProfileSnapshotSync()')).toBeGreaterThan(layout.indexOf('useHealthDailySync()'))
  })

  it('wird nach dem Speichern des Tageseintrags angestossen', async () => {
    const { readFileSync } = await import('node:fs')
    const sheet = readFileSync('src/features/fortschritt/components/TodayLogSheet.tsx', 'utf8')
    expect(sheet).toContain('requestProfileSnapshot()')
    expect(sheet.indexOf('requestProfileSnapshot()')).toBeGreaterThan(sheet.indexOf(".from('body_measurements')"))
    expect(sheet.indexOf('requestProfileSnapshot()')).toBeLessThan(sheet.indexOf('await onSaved()'))
  })
})
