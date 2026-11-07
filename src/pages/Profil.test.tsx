// @vitest-environment jsdom

import { act, cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ laden: { data: null, error: null } as { data: unknown; error: unknown } }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve(db.laden) }) }) }) },
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.c' }, signOut: vi.fn() }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../i18n', () => ({ LANGUAGES: [], setLanguage: vi.fn() }))
vi.mock('../lib/look', () => ({ useLook: () => ({ look: 'standard', setLook: vi.fn() }) }))
vi.mock('../lib/flashlight', () => ({ requestTilt: vi.fn(), setTiltWanted: vi.fn(), tiltWanted: () => false }))
vi.mock('../lib/usePushNotifications', () => ({
  usePushNotifications: () => ({ state: 'unsupported', subscribe: vi.fn(), unsubscribe: vi.fn(), reconnect: vi.fn(), sendTestPush: vi.fn() }),
}))
vi.mock('../lib/stoerung', () => ({ setzeStoerungSimuliert: vi.fn(), useStoerung: () => ({ simuliert: false }) }))
vi.mock('../components/ui/DesignSystem', () => ({ ResearchDisclaimer: () => null }))
vi.mock('../components/ui/GlassSegmented', () => ({ GlassSegmented: () => null }))
vi.mock('../features/compliance/components/AccountSection', () => ({ AccountSection: () => null }))
vi.mock('../features/auth/lib/passkey', () => ({ PASSKEY_AN: false }))
vi.mock('../features/auth/components/PasskeyEinstellung', () => ({ PasskeyEinstellung: () => null }))
vi.mock('../features/blutwerte/components/KiEinwilligung', () => ({ KiEinwilligungProfil: () => null }))
vi.mock('../features/ernaehrung/components/PhotoConsentProfile', () => ({ PhotoConsentProfile: () => null }))
vi.mock('../features/wearables/components/HealthStoreProfile', () => ({ HealthStoreProfile: () => null }))
vi.mock('../features/blutwerte/components/BioProfil', () => ({ BioProfilKarte: () => null }))
vi.mock('../features/profil/components/ProfilBilder', () => ({ ProfilBilder: () => null }))

type KartenProps = { geladen: boolean; goals: string[] }
const karte = vi.hoisted(() => ({ props: null as KartenProps | null }))
vi.mock('../features/profil/components/UeberDichKarte', () => ({
  UeberDichKarte: (props: KartenProps) => { karte.props = props; return null },
}))

import { Profil } from './Profil'

beforeEach(() => { karte.props = null })
afterEach(cleanup)

const renderPage = () => render(<MemoryRouter><Profil /></MemoryRouter>)

describe('Profil „Über dich"', () => {
  it('Ladefehler: Ziele, Land und Geschlecht bleiben gesperrt', async () => {
    db.laden = { data: null, error: { message: 'offline' } }
    renderPage()
    await act(() => new Promise(resolve => setTimeout(resolve, 0)))
    expect(karte.props?.geladen).toBe(false)
  })

  it('vor dem Laden gesperrt, danach frei und mit den gespeicherten Zielen', async () => {
    db.laden = { data: { goals: ['schlaf'], country: 'DE', profile_gender: 'female' }, error: null }
    renderPage()
    expect(karte.props?.geladen).toBe(false)
    await waitFor(() => expect(karte.props?.geladen).toBe(true))
    expect(karte.props?.goals).toEqual(['schlaf'])
  })
})
