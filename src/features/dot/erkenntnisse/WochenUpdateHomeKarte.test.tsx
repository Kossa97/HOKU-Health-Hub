// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { supabase } from '../../../lib/supabase'
import { vergissErkenntnisseZugang } from './homeZugang'
import { WochenUpdateHomeKarte } from './WochenUpdateHomeKarte'

const auth = vi.hoisted(() => ({ user: { id: 'u-1' } as { id: string } }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }))
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'de', resolvedLanguage: 'de' }, t: (key: string) => key }),
}))

afterEach(cleanup)

type Client = typeof supabase

/** Zählt Abfragen je Tabelle; `profiles` und `hoku_wochen` antworten mit festen Zeilen. */
function zaehlClient(profil: Record<string, unknown>, woche: Record<string, unknown> | null) {
  const aufrufe: string[] = []
  const client = {
    from: (tabelle: string) => {
      aufrufe.push(tabelle)
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'lte', 'order', 'limit', 'in']) q[m] = () => q
      q.maybeSingle = async () => ({ data: tabelle === 'profiles' ? profil : woche, error: null })
      return q
    },
  }
  return { client: client as unknown as Client, aufrufe }
}

const freigeschaltet = { is_admin: true, erkenntnisse_consent_at: '2026-11-01T10:00:00Z' }
const ungeleseneWoche = { woche: '2026-11-01', fund_ids: [], tage_eingeflossen: 6, gelesen_am: null }

async function zeige(client: Client) {
  const r = render(<MemoryRouter><WochenUpdateHomeKarte client={client} /></MemoryRouter>)
  await act(async () => {})
  return r
}

describe('WochenUpdateHomeKarte', () => {
  it('zeigt die Karte; ein zweiter Home-Besuch fragt profiles nicht noch einmal', async () => {
    auth.user = { id: 'u-merken' }
    const { client, aufrufe } = zaehlClient(freigeschaltet, ungeleseneWoche)
    await zeige(client)
    expect(screen.getByText('Dein Wochen-Update ist da')).toBeTruthy()
    cleanup()
    await zeige(client)
    expect(screen.getByText('Dein Wochen-Update ist da')).toBeTruthy()
    expect(aufrufe.filter(t => t === 'profiles')).toHaveLength(1)
    expect(aufrufe.filter(t => t === 'hoku_wochen')).toHaveLength(2)
  })

  it('nach vergissErkenntnisseZugang wird wieder gefragt', async () => {
    auth.user = { id: 'u-vergessen' }
    const { client, aufrufe } = zaehlClient({ is_admin: true, erkenntnisse_consent_at: null }, ungeleseneWoche)
    const r = await zeige(client)
    expect(r.container.innerHTML).toBe('')
    expect(aufrufe).toEqual(['profiles'])
    cleanup()
    vergissErkenntnisseZugang('u-vergessen')
    await zeige(client)
    expect(aufrufe).toEqual(['profiles', 'profiles'])
  })

  it('gelesene Woche: keine Karte', async () => {
    auth.user = { id: 'u-gelesen' }
    const { client } = zaehlClient(freigeschaltet, { ...ungeleseneWoche, gelesen_am: '2026-11-02T08:00:00Z' })
    const r = await zeige(client)
    expect(r.container.innerHTML).toBe('')
  })

  it('ein kaputter Client zeigt nichts und wirft nicht', async () => {
    auth.user = { id: 'u-kaputt' }
    const kaputt = { from: () => { throw new Error('kaputt') } } as unknown as Client
    const r = await zeige(kaputt)
    expect(r.container.innerHTML).toBe('')
    const mitFehler = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: '400' } }) }) }) }) } as unknown as Client
    const r2 = await zeige(mitFehler)
    expect(r2.container.innerHTML).toBe('')
  })
})
