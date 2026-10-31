// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { zustimmungsZeile } from '../lib/consent'

const insert = vi.fn()
const meta: { current: Record<string, unknown> } = { current: {} }

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      insert: (row: unknown) => insert(row),
    }),
  },
}))
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'abcdef12-0000', user_metadata: meta.current }, signOut: vi.fn() }),
}))
vi.mock('../../../components/ui/Silhouette', () => ({ SilhouettenHuelle: () => null }))

import { ConsentGate } from './ConsentGate'

beforeEach(() => { insert.mockReset(); insert.mockResolvedValue({ error: null }) })
afterEach(cleanup)

async function legeProfilAn(metadaten: Record<string, unknown>) {
  meta.current = { username: 'hoku', ...zustimmungsZeile(new Date()), ...metadaten }
  render(<MemoryRouter><ConsentGate><p>app</p></ConsentGate></MemoryRouter>)
  await waitFor(() => expect(insert).toHaveBeenCalled())
  return insert.mock.calls[0][0] as Record<string, unknown>
}

describe('ConsentGate legt die Profilzeile mit dem Geschlecht aus der Registrierung an', () => {
  it('weiblich: profile_gender und bio_sex', async () => {
    const zeile = await legeProfilAn({ profile_gender: 'female' })
    expect(zeile).toMatchObject({ username: 'hoku', profile_gender: 'female', bio_sex: 'female' })
  })

  it('divers: nur profile_gender, bio_sex bleibt leer', async () => {
    const zeile = await legeProfilAn({ profile_gender: 'diverse' })
    expect(zeile.profile_gender).toBe('diverse')
    expect('bio_sex' in zeile).toBe(false)
  })

  it('ohne oder mit ungueltigem Wert wird nichts geschrieben', async () => {
    const zeile = await legeProfilAn({ profile_gender: 'banane' })
    expect('profile_gender' in zeile).toBe(false)
    expect('bio_sex' in zeile).toBe(false)
  })
})
