// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BlutspiegelView } from './BlutspiegelView'
import { BlutspiegelSimulation } from '../../pages/BlutspiegelSimulation'
import { loadBlutspiegelEntries, loadEntryHistories, type BlutspiegelEntry } from './entries'
import { vergissBlutspiegelStand } from './useBlutspiegelData'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      let value = key
      for (const [name, replacement] of Object.entries(options ?? {})) value += ` ${name}=${String(replacement)}`
      return value
    },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}))

vi.mock('../../context/AuthContext', () => {
  const user = { id: 'user-1' }
  return { useAuth: () => ({ user }) }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) },
}))

vi.mock('../compliance/components/MedicalNotice', () => ({ MedicalNotice: () => null }))

vi.mock('./entries', async importOriginal => ({
  ...await importOriginal<typeof import('./entries')>(),
  loadBlutspiegelEntries: vi.fn(),
  loadEntryHistories: vi.fn(),
}))

const H = 3_600_000
const ready: BlutspiegelEntry = {
  kind: 'ready', key: 'cycle-1:pk-1', cycleId: 'cycle-1', stackItemId: 'stack-1', name: 'BPC-157', profileId: 'pk-1',
  profile: { name: 'BPC-157', half_life_hours: 4, tmax_hours: 1, bioavailability_sc: 1, iu_per_mg: null, vd_l_kg: 0.5, category: 'peptide' },
  accent: '#00ccf5', umrechnung: {}, nextDoseAt: null,
}
const missing: BlutspiegelEntry = {
  kind: 'missing', key: 'cycle-2', cycleId: 'cycle-2', stackItemId: 'stack-2', name: 'TB-500', missing: ['dose', 'time'],
}

function withData(entries: BlutspiegelEntry[]) {
  const now = Date.now()
  vi.mocked(loadBlutspiegelEntries).mockResolvedValue(entries)
  vi.mocked(loadEntryHistories).mockResolvedValue(new Map([['cycle-1', {
    events: [{ timestamp: new Date(now - 30 * H), dose: 5, unit: 'mg', status: 'taken' as const },
      { timestamp: new Date(now - 6 * H), dose: 5, unit: 'mg', status: 'taken' as const }],
    interruptedAt: null,
  }]]))
}

afterEach(() => {
  vergissBlutspiegelStand()
  vi.useRealTimers()
  cleanup()
  vi.clearAllMocks()
})

describe('BlutspiegelView', () => {
  it('zeigt Substanz, Wert und Graph; der Zeitraum wechselt die Beschriftung', async () => {
    withData([ready, missing])
    render(<MemoryRouter><BlutspiegelView variant="full" /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'BPC-157' })).toBeTruthy()
    expect(screen.getByRole('img', { name: /pk_chart_aria name=BPC-157/ })).toBeTruthy()
    expect(screen.getByText('pk_range_label_1d')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'pk_range_1w' }))
    expect(screen.getByRole('radio', { name: 'pk_range_1w' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('pk_range_label_1w')).toBeTruthy()
    // unvollstaendige Eintraege stehen darunter, mit Weg zum Ergaenzen
    expect(screen.getByText('TB-500')).toBeTruthy()
    expect(screen.getByRole('link', { name: /pk_complete_action/ }).getAttribute('href')).toBe('/my-stack?edit=stack-2&intent=pk')
  })

  it('sagt bei fehlendem Profil oder fehlender Umrechnung, warum es keine Kurve gibt', async () => {
    withData([ready, { kind: 'unsupported', key: 'c3', cycleId: 'c3', stackItemId: 's3', name: 'HCG', reason: 'unit_conversion' }])
    render(<MemoryRouter><BlutspiegelView variant="full" /></MemoryRouter>)
    expect(await screen.findByText('HCG')).toBeTruthy()
    expect(screen.getByText('pk_nocurve_unit')).toBeTruthy()
  })

  it('zeigt bei unterbrochenem Zyklus keine Veraenderung im Zeitraum', async () => {
    const now = Date.now()
    vi.mocked(loadBlutspiegelEntries).mockResolvedValue([ready])
    vi.mocked(loadEntryHistories).mockResolvedValue(new Map([['cycle-1', {
      events: [{ timestamp: new Date(now - 5 * 24 * H), dose: 5, unit: 'mg', status: 'taken' as const }],
      interruptedAt: now - 3 * 24 * H,
    }]]))
    render(<MemoryRouter><BlutspiegelView variant="full" /></MemoryRouter>)
    expect(await screen.findByText('pk_interrupted')).toBeTruthy()
    expect(screen.queryByText(/^[+−±]\d/)).toBeNull()
  })

  it('zeigt ohne fertige Kurve nur, was fehlt', async () => {
    withData([missing])
    render(<MemoryRouter><BlutspiegelView variant="compact" /></MemoryRouter>)
    expect(await screen.findByText(/^pk_nocurve_missing/)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('kompakt: fester Tageszeitraum und Weg zur Simulation mit der gewaehlten Substanz', async () => {
    withData([ready])
    render(<MemoryRouter><BlutspiegelView variant="compact" /></MemoryRouter>)
    await screen.findByRole('heading', { name: 'BPC-157' })
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.getByRole('link', { name: /pk_more/ }).getAttribute('href')).toBe('/simulation/cycle-1%3Apk-1')
  })

  it('fragt die Datenbank nicht vor Ablauf einer Minute erneut', async () => {
    vi.useFakeTimers()
    withData([ready])
    render(<MemoryRouter><BlutspiegelView variant="compact" /></MemoryRouter>)
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
    expect(loadBlutspiegelEntries).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999) })
    expect(loadBlutspiegelEntries).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(loadBlutspiegelEntries).toHaveBeenCalledTimes(2)
  })
})

describe('BlutspiegelSimulation', () => {
  it('Übersicht: Titel, Live-Stand, je Substanz eine Zeile zur Detailseite, „+“ zur eigenen Simulation, Hinweise', async () => {
    withData([ready, missing])
    render(<MemoryRouter initialEntries={['/simulation']}><BlutspiegelSimulation /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'pk_title' })).toBeTruthy()
    expect(screen.getByText(/pk_sim_disclaimer/)).toBeTruthy()
    const zeile = await screen.findByRole('link', { name: /BPC-157/ })
    expect(zeile.getAttribute('href')).toBe('/simulation/cycle-1%3Apk-1')
    expect(screen.getByRole('link', { name: 'pk_manual_open' }).getAttribute('href')).toBe('/simulation/neu')
    // Live statt Knopf: der Stand erneuert sich selbst, mit Countdown.
    expect(screen.queryByRole('button', { name: 'pk_refresh' })).toBeNull()
    expect(screen.getByRole('status', { name: 'pk_live_auto' })).toBeTruthy()
    expect(screen.getByText('TB-500')).toBeTruthy()
    // Keine Kurve und keine manuelle Simulation mehr auf der Übersicht
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button', { name: /pk_manual_title/ })).toBeNull()
  })

  it('zaehlt alle 5 Sekunden herunter und rechnet neu, ohne die Datenbank zu fragen', async () => {
    vi.useFakeTimers()
    withData([ready])
    render(<MemoryRouter initialEntries={['/simulation']}><BlutspiegelSimulation /></MemoryRouter>)
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
    const zahl = () => document.querySelector('[data-bs-countdown]')?.textContent
    const dreht = () => document.querySelector('[data-bs-refresh-icon]') != null
    expect(zahl()).toBe('5.00')
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(zahl()).toBe('3.00')
    // Abgelaufen: eine Sekunde das drehende Symbol statt der Zahl …
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(dreht()).toBe(true)
    expect(zahl()).toBeUndefined()
    // … dann wieder ab 5.00
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect(dreht()).toBe(false)
    expect(zahl()).toBe('5.00')
    expect(loadBlutspiegelEntries).toHaveBeenCalledTimes(1)
  })
})
