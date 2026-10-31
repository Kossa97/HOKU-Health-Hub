import { describe, expect, it } from 'vitest'
import { MAX_FAVORITES, normalizeFavorites, toggleFavorite } from './favorites'

describe('toggleFavorite', () => {
  it('fuegt hinten an und entfernt wieder', () => {
    const one = toggleFavorite([], 'bench_press_barbell')
    expect(one).toEqual(['bench_press_barbell'])
    expect(toggleFavorite([...one, 'squat_barbell'], 'bench_press_barbell')).toEqual(['squat_barbell'])
  })

  it('haelt die Obergrenze, die aeltesten fallen weg', () => {
    const full = Array.from({ length: MAX_FAVORITES }, (_, i) => `ex${i}`)
    const next = toggleFavorite(full, 'neu')
    expect(next).toHaveLength(MAX_FAVORITES)
    expect(next[0]).toBe('ex1')
    expect(next.at(-1)).toBe('neu')
  })
})

describe('normalizeFavorites', () => {
  it('nimmt nur gueltige, eindeutige IDs', () => {
    expect(normalizeFavorites(['a', 'a', 3, '', 'x'.repeat(121), 'b'])).toEqual(['a', 'b'])
  })

  it('ohne Liste: leer', () => {
    expect(normalizeFavorites(undefined)).toEqual([])
    expect(normalizeFavorites('a')).toEqual([])
  })
})
