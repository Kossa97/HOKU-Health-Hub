// @vitest-environment jsdom

import { act, cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeasurementSite } from './lib/measurements'

/** Antwort auf das Laden von measurement_sites; `update` schreibt mit. */
const db = vi.hoisted(() => ({
  laden: { data: null, error: null } as { data: unknown; error: unknown },
  update: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(db.laden) }) }),
      update: (werte: unknown) => { db.update(werte); return { eq: () => Promise.resolve({ error: null }) } },
    }),
  },
}))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/monitoring', () => ({ reportError: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('./hooks/useFortschrittData', () => ({
  useFortschrittData: () => ({
    state: { loading: true, dataReady: false, dailyLogs: [], weightLogs: [], measurements: [], fullRange: { from: '2026-10-01', to: '2026-10-31' } },
    reload: vi.fn(),
  }),
}))
vi.mock('./components/FortschrittHeader', () => ({ FortschrittHeader: () => null }))
vi.mock('./components/FortschrittDashboard', () => ({ FortschrittDashboard: () => null }))
vi.mock('./components/StickyRangeBar', () => ({ StickyRangeBar: () => null }))
vi.mock('../../components/ui/Silhouette', () => ({ Silhouette: () => null, KurvenUmriss: () => null }))

type SheetProps = { measurementSites: MeasurementSite[]; onMeasurementSitesChange: ((sites: MeasurementSite[]) => void) | null }
const sheet = vi.hoisted(() => ({ props: null as SheetProps | null }))
vi.mock('./components/TodayLogSheet', () => ({
  TodayLogSheet: (props: SheetProps) => { sheet.props = props; return null },
}))

import { FortschrittPage } from './FortschrittPage'

beforeEach(() => { db.update.mockClear(); sheet.props = null })
afterEach(cleanup)

const renderPage = () => render(<MemoryRouter><FortschrittPage /></MemoryRouter>)
const flush = () => act(() => new Promise(resolve => setTimeout(resolve, 0)))

describe('FortschrittPage Messstellen', () => {
  it('Ladefehler: Auswahl bleibt gesperrt, nichts ueberschreibt die gespeicherte Wahl', async () => {
    db.laden = { data: null, error: { message: 'offline' } }
    renderPage()
    await flush()
    expect(sheet.props?.onMeasurementSitesChange).toBeNull()
    expect(db.update).not.toHaveBeenCalled()
  })

  it('vor dem Laden gesperrt, danach mit der gespeicherten Wahl frei', async () => {
    db.laden = { data: { measurement_sites: ['waist', 'chest'] }, error: null }
    renderPage()
    expect(sheet.props?.onMeasurementSitesChange).toBeNull()
    await waitFor(() => expect(sheet.props?.onMeasurementSitesChange).not.toBeNull())
    expect(sheet.props?.measurementSites).toEqual(['chest', 'waist'])
    act(() => sheet.props!.onMeasurementSitesChange!(['chest', 'waist', 'hips']))
    expect(db.update).toHaveBeenCalledWith({ measurement_sites: ['chest', 'waist', 'hips'] })
  })
})
