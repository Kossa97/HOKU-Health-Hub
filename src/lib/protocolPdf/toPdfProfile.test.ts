import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

const { toPdfProfile } = await import('./loadProtocolData')

const zeile = (over: Record<string, unknown> = {}) => ({
  display_name: 'Max', username: 'max', birth_date: null, bio_sex: null,
  age: null, gender: null, height_cm: 182, weight_kg: 84, ...over,
})

describe('toPdfProfile', () => {
  it('Geburtsdatum und biologisches Geschlecht gehen vor', () => {
    const p = toPdfProfile(zeile({ birth_date: '1980-03-15', bio_sex: 'female', age: 30, gender: 'männlich' }), '2026-10-12')
    expect(p).toMatchObject({ age: 46, bio_sex: 'female', gender: null })
  })

  it('ohne neue Angaben die alten', () => {
    expect(toPdfProfile(zeile({ age: 41, gender: 'divers' }), '2026-10-12')).toMatchObject({ age: 41, bio_sex: null, gender: 'divers' })
  })

  it('ohne Zeile nichts', () => {
    expect(toPdfProfile(null, '2026-10-12')).toBeNull()
  })
})
