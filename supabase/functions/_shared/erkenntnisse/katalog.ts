import type { Tag } from './typen.ts'

export type Messwert = 'schlafMin' | 'proteinG' | 'energie'

export interface KatalogEintrag {
  id: 'H1' | 'E2' | 'W1'
  messwert: Messwert
  versatzTage: 0 | 1 // Messwert an Tag D + versatz
  gruppe: (tag: Tag) => 'a' | 'b' | null // Gruppe an Tag D, null = Tag zählt nicht
  gruppen: { a: string; b: string } // Schlüssel für die Vorlagen
  minEffekt: number
  einheit: 'min' | 'g' | 'punkte'
  besser: 'hoeher' | null // null = keine Wertung, Reihenfolge a/b bleibt
  grenze?: number // erscheint in werte.grenze
}

const SPAET_AB = 21 // Uhr
const SCHLAF_GRENZE_MIN = 420

export const KATALOG: readonly KatalogEintrag[] = [
  {
    id: 'H1',
    messwert: 'schlafMin',
    versatzTage: 1,
    gruppe: (tag) => {
      if (tag.trainingsStunden.length === 0) return null
      return tag.trainingsStunden.some((h) => h >= SPAET_AB) ? 'b' : 'a'
    },
    gruppen: { a: 'vor_grenze', b: 'ab_grenze' },
    minEffekt: 15,
    einheit: 'min',
    besser: 'hoeher',
    grenze: SPAET_AB,
  },
  {
    id: 'E2',
    messwert: 'proteinG',
    versatzTage: 0,
    gruppe: (tag) => (tag.trainingsStunden.length > 0 ? 'a' : 'b'),
    gruppen: { a: 'trainingstag', b: 'ruhetag' },
    minEffekt: 15,
    einheit: 'g',
    besser: null,
  },
  {
    id: 'W1',
    messwert: 'energie',
    versatzTage: 0,
    gruppe: (tag) => {
      if (tag.schlafMin == null) return null
      return tag.schlafMin >= SCHLAF_GRENZE_MIN ? 'a' : 'b'
    },
    gruppen: { a: 'schlaf_ab_grenze', b: 'schlaf_unter_grenze' },
    minEffekt: 0.8,
    einheit: 'punkte',
    besser: 'hoeher',
    grenze: 7,
  },
]
