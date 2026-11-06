// Die Titelnamen der Link-Karte sind eine Abschrift aus `src/features/profil/lib/titles.ts`:
// gleiche Ränge, gleiche tragbare Abzeichen ohne die persönlichen, gleiche Namen.

import { describe, expect, it } from 'vitest'
import { PERSONAL_TITLE_SOURCE, RANKS, TITLE_NAMES, titleName } from '../../src/features/profil/lib/titles'
import { BADGE_TITLE_NAMES, RANK_TITLE_NAMES, webTitleName } from './titleNames.js'

describe('Titelnamen: api/_lib ↔ src/features/profil/lib/titles.ts', () => {
  it('Ränge: gleiche IDs in gleicher Reihenfolge, gleiche Namen', () => {
    expect(RANK_TITLE_NAMES).toEqual(Object.fromEntries(RANKS.map(r => [r.id, r.name])))
    expect(Object.keys(RANK_TITLE_NAMES)).toEqual(RANKS.map(r => r.id))
  })

  it('tragbare Abzeichen: alle außer den persönlichen, gleiche Reihenfolge und Namen', () => {
    const web = Object.entries(TITLE_NAMES).filter(([id]) => !Object.hasOwn(PERSONAL_TITLE_SOURCE, id))
    expect(Object.keys(BADGE_TITLE_NAMES)).toEqual(web.map(([id]) => id))
    expect(BADGE_TITLE_NAMES).toEqual(Object.fromEntries(web))
  })

  it('kein persönlicher Titel in der Abschrift', () => {
    for (const id of Object.keys(PERSONAL_TITLE_SOURCE)) {
      expect(Object.hasOwn(BADGE_TITLE_NAMES, id), id).toBe(false)
      expect(webTitleName({ kind: 'badge', id }, 'de'), id).toBeNull()
    }
  })

  it('webTitleName wie titleName für alles, was das Web zeigt', () => {
    for (const lang of ['de', 'en']) {
      for (const id of Object.keys(RANK_TITLE_NAMES)) expect(webTitleName({ kind: 'rank', id }, lang)).toBe(titleName(id, lang))
      for (const id of Object.keys(BADGE_TITLE_NAMES)) expect(webTitleName({ kind: 'badge', id }, lang)).toBe(titleName(id, lang))
    }
  })
})
