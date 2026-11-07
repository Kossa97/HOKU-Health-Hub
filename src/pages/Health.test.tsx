// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lang = vi.hoisted(() => ({ value: 'de' }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { get resolvedLanguage() { return lang.value }, get language() { return lang.value } },
  }),
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
const platform = vi.hoisted(() => ({ native: false }))
vi.mock('../lib/health', () => ({
  get isNative() { return platform.native }, requestPermissions: vi.fn(), getHeartRate: vi.fn(), getSleep: vi.fn(), getSteps: vi.fn(),
}))

const db = vi.hoisted(() => ({ results: {} as Record<string, { data: unknown; error: unknown }>, fetches: 0 }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      if (table === 'health_daily') db.fetches += 1
      for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q
      q.single = () => Promise.resolve({ data: null, error: null })
      q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve(db.results[table] ?? { data: [], error: null }).then(res, rej)
      return q
    },
  },
}))

const consent = vi.hoisted(() => ({
  value: { consent: '2026-10-30T08:00:00Z' as string | null | undefined, error: false, reload: vi.fn() },
  reloadTo: undefined as string | null | undefined,
}))
vi.mock('../features/wearables/hooks/useHealthStoreConsent', async () => {
  const { useState } = await import('react')
  return {
    useHealthStoreConsent: () => {
      const [granted, setGranted] = useState(consent.value.consent)
      return {
        consent: granted,
        error: consent.value.error,
        set: vi.fn(),
        // Wie der echte Hook: nach dem Neuladen steht die inzwischen gespeicherte Einwilligung da.
        reload: () => { consent.value.reload(); if (consent.reloadTo !== undefined) setGranted(consent.reloadTo) },
      }
    },
  }
})
vi.mock('../features/wearables/components/HealthStoreConsentSheet', () => ({
  HealthStoreConsentSheet: ({ open, onDone }: { open: boolean; onDone: (granted: boolean) => void }) =>
    open ? <div data-testid="consent-sheet"><button onClick={() => onDone(true)}>sheet-accept</button></div> : null,
}))

import { Health } from './Health'

const renderHealth = () => render(<MemoryRouter><Health /></MemoryRouter>)
const tiles = () => document.querySelector('[data-health-daily]') as HTMLElement

const row = (day: string, values: Record<string, number | null> = {}) => ({
  day, active_kcal: null, spo2_pct: null, resp_rate: null, bp_sys: null, bp_dia: null, ...values,
})

beforeEach(() => {
  lang.value = 'de'
  db.results = {}
  db.fetches = 0
  platform.native = false
  consent.reloadTo = undefined
  consent.value = { consent: '2026-10-30T08:00:00Z', error: false, reload: vi.fn() }
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('Health: Werte aus health_daily', () => {
  it('zeigt die vier Werte des letzten Tages deutsch formatiert', async () => {
    db.results.health_daily = { data: [row('2026-10-31', { active_kcal: 620, spo2_pct: 97, resp_rate: 14.2, bp_sys: 121, bp_dia: 78 })], error: null }
    renderHealth()
    const t = await waitFor(() => {
      const el = tiles()
      expect(within(el).getByText('620 kcal')).toBeTruthy()
      return within(el)
    })
    expect(t.getByText('97 %')).toBeTruthy()
    expect(t.getByText('14,2 /min')).toBeTruthy()
    expect(t.getByText('121/78')).toBeTruthy()
    expect(t.queryAllByText('—')).toHaveLength(0)
    const date = new Intl.DateTimeFormat('de', { dateStyle: 'medium' }).format(new Date('2026-10-31T00:00:00'))
    expect(t.getAllByText(date)).toHaveLength(4)
  })

  it('formatiert die Atemfrequenz nach Appsprache', async () => {
    lang.value = 'en'
    db.results.health_daily = { data: [row('2026-10-31', { resp_rate: 14.2 })], error: null }
    renderHealth()
    expect(await within(await waitFor(() => { expect(tiles()).toBeTruthy(); return tiles() })).findByText('14.2 /min')).toBeTruthy()
  })

  it('nimmt je Wert den letzten Tag, der ihn hat', async () => {
    db.results.health_daily = {
      data: [
        row('2026-10-31', { active_kcal: 300 }),
        row('2026-10-29', { active_kcal: 999, spo2_pct: 95.5, bp_sys: 118, bp_dia: 76 }),
      ],
      error: null,
    }
    renderHealth()
    await waitFor(() => expect(within(tiles()).getByText('300 kcal')).toBeTruthy())
    const t = within(tiles())
    expect(t.getByText('95,5 %')).toBeTruthy()
    expect(t.getByText('118/76')).toBeTruthy()
    expect(t.queryByText('999 kcal')).toBeNull()
    const d31 = new Intl.DateTimeFormat('de', { dateStyle: 'medium' }).format(new Date('2026-10-31T00:00:00'))
    const d29 = new Intl.DateTimeFormat('de', { dateStyle: 'medium' }).format(new Date('2026-10-29T00:00:00'))
    expect(t.getAllByText(d31)).toHaveLength(1)
    expect(t.getAllByText(d29)).toHaveLength(2)
    expect(t.getAllByText('—')).toHaveLength(1) // Atemfrequenz fehlt
  })

  it('zeigt ohne Zeilen vier Striche, keinen Fehler', async () => {
    db.results.health_daily = { data: [], error: null }
    renderHealth()
    await waitFor(() => expect(within(tiles()).getAllByText('—')).toHaveLength(4))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('meldet einen Ladefehler sichtbar, ohne die Seite zu zerlegen', async () => {
    db.results.health_daily = { data: null, error: { message: 'boom' } }
    renderHealth()
    expect(await screen.findByText('health_daily_load_error')).toBeTruthy()
    expect(screen.getByText('Health')).toBeTruthy()
  })

  it('zeigt ohne Einwilligung statt der Kacheln einen Hinweis, dessen Knopf das Sheet oeffnet', async () => {
    platform.native = true
    consent.value = { consent: null, error: false, reload: vi.fn() }
    db.results.health_daily = { data: [row('2026-10-31', { active_kcal: 620 })], error: null }
    renderHealth()
    expect(await screen.findByText('health_daily_hint')).toBeTruthy()
    expect(tiles()).toBeNull()
    expect(screen.queryByText('620 kcal')).toBeNull()
    expect(screen.queryByTestId('consent-sheet')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'health_daily_hint_action' }))
    expect(screen.getByTestId('consent-sheet')).toBeTruthy()
    fireEvent.click(screen.getByText('sheet-accept'))
    expect(consent.value.reload).toHaveBeenCalled()
    expect(screen.queryByTestId('consent-sheet')).toBeNull()
  })

  it('zeigt weder Kacheln noch Hinweis, solange die Einwilligung laedt', async () => {
    consent.value = { consent: undefined, error: false, reload: vi.fn() }
    renderHealth()
    await screen.findByText('Health')
    expect(tiles()).toBeNull()
    expect(screen.queryByText('health_daily_hint')).toBeNull()
  })

  it('meldet, wenn die Einwilligung nicht gelesen werden konnte, und bietet Erneut-versuchen an', async () => {
    consent.value = { consent: undefined, error: true, reload: vi.fn() }
    renderHealth()
    expect(await screen.findByText('health_consent_load_error')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'lab_retry' }))
    expect(consent.value.reload).toHaveBeenCalled()
  })

  it('zeigt im Web ohne Einwilligung weder Hinweis noch Kacheln', async () => {
    consent.value = { consent: null, error: false, reload: vi.fn() }
    renderHealth()
    await screen.findByText('Health')
    expect(screen.queryByText('health_daily_hint')).toBeNull()
    expect(screen.queryByRole('button', { name: 'health_daily_hint_action' })).toBeNull()
    expect(tiles()).toBeNull()
    expect(db.fetches).toBe(0)
  })

  it('zeigt im Web die Kacheln, wenn am Handy zugestimmt wurde', async () => {
    db.results.health_daily = { data: [row('2026-10-31', { active_kcal: 620 })], error: null }
    renderHealth()
    await waitFor(() => expect(within(tiles()).getByText('620 kcal')).toBeTruthy())
  })
})

describe('Health: erster Abgleich nach der Einwilligung', () => {
  const accept = async () => {
    platform.native = true
    consent.value = { consent: null, error: false, reload: vi.fn() }
    consent.reloadTo = '2026-10-31T09:00:00Z'
    db.results.health_daily = { data: [], error: null }
    const view = renderHealth()
    fireEvent.click(await screen.findByRole('button', { name: 'health_daily_hint_action' }))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fireEvent.click(screen.getByText('sheet-accept'))
    return view
  }
  afterEach(() => { vi.useRealTimers() })

  it('liest nach etwa 4 Sekunden einmal neu', async () => {
    await accept()
    expect(db.fetches).toBe(1)
    db.results.health_daily = { data: [row('2026-10-31', { active_kcal: 620 })], error: null }
    await vi.advanceTimersByTimeAsync(3900)
    expect(db.fetches).toBe(1)
    await vi.advanceTimersByTimeAsync(200)
    vi.useRealTimers()
    await waitFor(() => expect(within(tiles()).getByText('620 kcal')).toBeTruthy())
    expect(db.fetches).toBe(2)
    await new Promise(r => setTimeout(r, 50))
    expect(db.fetches).toBe(2)
  })

  it('liest nach dem Verlassen der Seite nicht mehr', async () => {
    const view = await accept()
    expect(db.fetches).toBe(1)
    view.unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(db.fetches).toBe(1)
  })
})
