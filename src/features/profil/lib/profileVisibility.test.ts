import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PROFILE_FIELDS, PROFILE_SECTIONS, arrangeCards, cycleVisibility, fieldsOfSection, parseVisibilityMap,
  tileLayout, visibilityOf, withSectionVisibility, withVisibility,
} from './profileVisibility'

describe('Felder und Stufen', () => {
  it('hat 30 Felder, jedes genau einem Bereich zugeordnet', () => {
    expect(PROFILE_FIELDS).toHaveLength(30)
    expect(new Set(PROFILE_FIELDS).size).toBe(30)
    const ausBereichen = PROFILE_SECTIONS.flatMap(fieldsOfSection)
    expect([...ausBereichen].sort()).toEqual([...PROFILE_FIELDS].sort())
  })

  it('Feldliste stimmt mit der Pruefung in der Migration ueberein', () => {
    const sql = readFileSync(resolve(__dirname, '../../../../supabase-profil-p2a-sichtbarkeit.sql'), 'utf8')
    const block = sql.match(/profile_visibility_ok[\s\S]*?array\[([\s\S]*?)\]\)/)
    expect(block).not.toBeNull()
    const ausSql = [...block![1].matchAll(/'([a-z_0-9]+)'/g)].map(m => m[1])
    expect([...ausSql].sort()).toEqual([...PROFILE_FIELDS].sort())
  })

  it('Standard ist „Nur ich“, auch bei Unbekanntem', () => {
    expect(visibilityOf({}, 'weight')).toBe('me')
    expect(visibilityOf(null, 'weight')).toBe('me')
    expect(visibilityOf({ weight: 'me' }, 'weight')).toBe('me')
    expect(visibilityOf({ weight: 'public' }, 'weight')).toBe('me')
    expect(visibilityOf({ weight: 'friends' }, 'weight')).toBe('friends')
    expect(visibilityOf({ weight: 'all' }, 'weight')).toBe('all')
  })

  it('parseVisibilityMap behaelt nur bekannte Felder und Stufen', () => {
    expect(parseVisibilityMap({ weight: 'all', nose: 'all', bio: 'me', age: 'friends' })).toEqual({ weight: 'all', age: 'friends' })
    expect(parseVisibilityMap(['all'])).toEqual({})
    expect(parseVisibilityMap(null)).toEqual({})
  })

  it('„Nur ich“ entfernt den Schluessel, andere Stufen setzen ihn', () => {
    expect(withVisibility({ weight: 'all' }, 'weight', 'me')).toEqual({})
    expect(withVisibility({}, 'weight', 'friends')).toEqual({ weight: 'friends' })
  })

  it('Chip: Nur ich → Freunde → Alle → Nur ich', () => {
    expect(cycleVisibility('me')).toBe('friends')
    expect(cycleVisibility('friends')).toBe('all')
    expect(cycleVisibility('all')).toBe('me')
  })

  it('„Alle auf …“ setzt genau die Felder eines Bereichs', () => {
    const map = withSectionVisibility({ bio: 'all' }, 'ueber', 'all')
    expect(map).toEqual({ bio: 'all', age: 'all', height: 'all', weight: 'all' })
    expect(withSectionVisibility(map, 'ueber', 'me')).toEqual({ bio: 'all' })
  })
})

describe('Layoutregel', () => {
  it('Raster nach Anzahl', () => {
    expect(tileLayout(1)).toBe('r1')
    expect(tileLayout(2)).toBe('r2')
    expect(tileLayout(3)).toBe('r3')
    expect(tileLayout(4)).toBe('r2')
    expect(tileLayout(5)).toBe('r2-rest')
    expect(tileLayout(6)).toBe('r2')
    expect(tileLayout(7)).toBe('r2-rest')
    expect(tileLayout(8)).toBe('r2')
  })

  it('langer Text kommt nie in eine Dreierreihe', () => {
    expect(tileLayout(3, true)).toBe('r2-rest')
  })

  it('kein Raster laesst eine leere Zelle', () => {
    for (let n = 1; n <= 8; n++) {
      const layout = tileLayout(n)
      const spalten = layout === 'r3' ? 3 : layout === 'r1' ? 1 : 2
      const zellen = layout === 'r2-rest' ? n + 1 : n
      expect(zellen % spalten, `n=${n}`).toBe(0)
    }
  })

  it('Ein-Wert-Karten paaren sich, leere fallen weg, eine einzelne bleibt voll', () => {
    const karten = [{ id: 'ueber', n: 1 }, { id: 'koerper', n: 0 }, { id: 'gesundheit', n: 1 }, { id: 'training', n: 3 }, { id: 'berichte', n: 1 }]
    const zeilen = arrangeCards(karten, k => k.n)
    expect(zeilen.map(z => z.kind === 'pair' ? z.cards.map(c => c.id).join('+') : z.card.id))
      .toEqual(['ueber+gesundheit', 'training', 'berichte'])
  })

  it('paart nur direkt aufeinanderfolgende Ein-Wert-Karten', () => {
    const zeilen = arrangeCards([{ n: 1 }, { n: 2 }, { n: 1 }], k => k.n)
    expect(zeilen.map(z => z.kind)).toEqual(['full', 'full', 'full'])
  })
})
