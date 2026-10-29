import { describe, expect, it } from 'vitest'
import { DOT_TEXTE, dotSprache, dotText } from './texte'

const tokens = (v: string) => [...v.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]).sort()

describe('Dot-Texte', () => {
  it('de und en haben dieselben Schlüssel und Platzhalter, nichts ist leer', () => {
    expect(Object.keys(DOT_TEXTE.en).sort()).toEqual(Object.keys(DOT_TEXTE.de).sort())
    for (const k of Object.keys(DOT_TEXTE.de) as (keyof typeof DOT_TEXTE.de)[]) {
      expect(DOT_TEXTE.de[k].trim(), k).not.toBe('')
      expect(DOT_TEXTE.en[k].trim(), k).not.toBe('')
      expect(tokens(DOT_TEXTE.en[k]), k).toEqual(tokens(DOT_TEXTE.de[k]))
    }
  })

  it('Hokus Login-Sätze: höchstens zwei Zeilen, Wortlaut wie geplant', () => {
    for (const k of Object.keys(DOT_TEXTE.de) as (keyof typeof DOT_TEXTE.de)[]) {
      if (!k.startsWith('login_')) continue
      expect(dotText('de', k).split('\n').length, k).toBeLessThanOrEqual(2)
      expect(dotText('en', k).split('\n').length, k).toBeLessThanOrEqual(2)
    }
    expect(dotText('de', 'login_hub')).toBe('Hi! Willkommen\nbei Hoku')
    expect(dotText('en', 'login_hey')).toBe("Hey, I'm\nHoku!")
    expect(dotText('de', 'login_zurueck_2')).toBe('Schön, dich\nwiederzusehen!')
    expect(dotText('de', 'login_sehe_nichts')).toBe('Keine Sorge, ich sehe nichts.')
  })

  it('jede andere Sprache bekommt Englisch; Einzahl bei anzahl 1', () => {
    expect(dotSprache('de-DE')).toBe('de')
    expect(dotSprache('fr')).toBe('en')
    expect(dotText('de', 'uhr_offen', { uhr: '9:41', anzahl: 1 })).toBe('Es ist 9:41. Heute ist noch eine Einnahme offen.')
    expect(dotText('de', 'uhr_offen', { uhr: '9:41', anzahl: 3 })).toBe('Es ist 9:41. Heute sind noch 3 Einnahmen offen.')
  })
})
