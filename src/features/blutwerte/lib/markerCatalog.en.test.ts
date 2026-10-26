import { describe, expect, it } from 'vitest'
import { KATEGORIEN, MARKER_CATALOG, SONSTIGE } from './markerCatalog'
import { KATEGORIE_KEY, MARKER_EN, markerErklaerung, markerName } from './markerCatalog.en'

describe('Markerkatalog auf Englisch', () => {
  it('hat fuer jeden Katalogmarker Namen und Erklaerung — und nichts darueber hinaus', () => {
    expect(Object.keys(MARKER_EN).sort()).toEqual(MARKER_CATALOG.map(def => def.name).sort())
    for (const eintrag of Object.values(MARKER_EN)) {
      expect(eintrag.name.trim()).not.toBe('')
      expect(eintrag.erklaerung.length).toBeGreaterThan(20)
    }
  })

  it('hat fuer jede Kategorie einen Uebersetzungsschluessel', () => {
    for (const kategorie of [...KATEGORIEN, SONSTIGE]) expect(KATEGORIE_KEY[kategorie]).toMatch(/^bw_cat_/)
  })

  it('zeigt Deutsch auf Deutsch, sonst Englisch; Unbekanntes bleibt', () => {
    const def = MARKER_CATALOG.find(d => d.name === 'Kortisol')!
    expect(markerName('Kortisol', 'de')).toBe('Kortisol')
    expect(markerName('Kortisol', 'en')).toBe('Cortisol')
    expect(markerName('Kortisol', 'fr')).toBe('Cortisol')
    expect(markerName('Mein Laborwert', 'en')).toBe('Mein Laborwert')
    // Synonyme aus Importen: ueber den Katalog aufgeloest, auf Deutsch unveraendert.
    expect(markerName('Testosteron gesamt', 'en')).toBe('Testosterone')
    expect(markerName('Testosteron gesamt', 'de')).toBe('Testosteron gesamt')
    expect(markerErklaerung(def, 'de-AT')).toBe(def.erklaerung)
    expect(markerErklaerung(def, 'en')).toContain('stress hormone')
  })
})
