import { describe, expect, it } from 'vitest'
import { pruefeText } from '../../../../supabase/functions/_shared/erkenntnisse/waechter.ts'
import { TEXTE } from './texte'

const tokens = (v: string) => [...v.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]).sort()

describe('Erkenntnisse-Texte', () => {
  it('de und en haben dieselben Schlüssel und Platzhalter, nichts ist leer', () => {
    expect(Object.keys(TEXTE.en).sort()).toEqual(Object.keys(TEXTE.de).sort())
    for (const k of Object.keys(TEXTE.de) as (keyof typeof TEXTE.de)[]) {
      expect(TEXTE.de[k].trim(), k).not.toBe('')
      expect(TEXTE.en[k].trim(), k).not.toBe('')
      expect(tokens(TEXTE.en[k]), k).toEqual(tokens(TEXTE.de[k]))
    }
  })

  it('Einwilligungstexte enthalten keine Wörter, die der Regelwächter sperrt', () => {
    for (const k of Object.keys(TEXTE.de).filter(k => k.startsWith('einw_')) as (keyof typeof TEXTE.de)[]) {
      for (const sprache of ['de', 'en'] as const) {
        // Zahlen („Art. 9“) stammen hier nicht aus einem Fund: nur die Wortlisten zählen.
        const verstoesse = pruefeText(TEXTE[sprache][k], sprache, null).verstoesse.filter(v => !v.startsWith('zahl:'))
        expect(verstoesse, `${sprache}.${k}`).toEqual([])
      }
    }
  })

  it('Wortlaut der Einwilligung steht wie freigegeben', () => {
    expect(TEXTE.de.einw_titel).toBe('Hoku sucht Muster in deinen Daten')
    expect(TEXTE.de.einw_haken).toBe('Ich willige ein, dass meine Gesundheitsdaten dafür ausgewertet werden (Art. 9 DSGVO).')
    expect(TEXTE.de.einw_ja).toBe('Einverstanden')
    expect(TEXTE.de.einw_nein).toBe('Nicht jetzt')
    expect(TEXTE.en.einw_haken).toContain('Art. 9 GDPR')
  })
})
