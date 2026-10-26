import { describe, expect, it } from 'vitest'
import { MARKER_CATALOG, normalizeMarker } from './markerCatalog'
import { GUIDANCE_MARKERS, markerGuidance } from './markerGuidance'

/** Nur diese Quellen sind fuer die Einordnung zugelassen. */
const ERLAUBT = /^https:\/\/(www\.)?(gesundheitsinformation\.de|gesund\.bund\.de|msdmanuals\.com|medlineplus\.gov|nhs\.uk|rki\.de)\//

describe('markerGuidance', () => {
  it('gehoert nur zu Katalogmarkern und hat beide Sprachen vollstaendig', () => {
    expect(GUIDANCE_MARKERS.length).toBeGreaterThan(0)
    for (const name of GUIDANCE_MARKERS) {
      expect(normalizeMarker(name)?.name, name).toBe(name)
      for (const sprache of ['de', 'en']) {
        const g = markerGuidance(name, sprache)!
        expect(g.text.hinweis, name).not.toBe('')
        for (const teil of [g.text.niedrig, g.text.bereich, g.text.hoch]) {
          expect(teil.length, name).toBeGreaterThan(0)
          for (const item of teil) expect(item.text.trim(), name).not.toBe('')
        }
      }
      expect(markerGuidance(name, 'de')!.quellen.length, name).toBeGreaterThanOrEqual(2)
      for (const q of markerGuidance(name, 'de')!.quellen) expect(q.url, `${name}: ${q.url}`).toMatch(ERLAUBT)
    }
  })

  it('Deutsch und Englisch sagen gleich viel, mit denselben Ueberschriften-Stellen', () => {
    for (const name of GUIDANCE_MARKERS) {
      const de = markerGuidance(name, 'de')!.text
      const en = markerGuidance(name, 'en')!.text
      for (const teil of ['niedrig', 'bereich', 'hoch'] as const) {
        expect(en[teil].length, `${name} ${teil}`).toBe(de[teil].length)
        expect(en[teil].map(i => !!i.label), `${name} ${teil}`).toEqual(de[teil].map(i => !!i.label))
      }
    }
  })

  it('zu niedrig und zu hoch enden mit dem Weg zum Arzt, ohne Therapie-Anweisung', () => {
    for (const name of GUIDANCE_MARKERS) {
      const de = markerGuidance(name, 'de')!.text
      for (const teil of [de.niedrig, de.hoch]) {
        const letzter = teil[teil.length - 1]
        expect(letzter.label, name).toBeUndefined()
        expect(letzter.text, name).toMatch(/ärztlich|arzt|ärztin|112|praxis/i)
      }
      const alles = [de.hinweis, ...de.niedrig, ...de.bereich, ...de.hoch].map(i => (typeof i === 'string' ? i : i.text)).join(' ')
      // Keine Dosierungen
      expect(alles, name).not.toMatch(/\b\d+\s?(mg|µg|mcg|IE|I\.E\.)\s?(pro|am|täglich|\/Tag)/i)
    }
  })

  it('englisch fuer andere Sprachen, null fuer Marker ohne Einordnung', () => {
    expect(markerGuidance('Ferritin', 'fr')!.text.hinweis).toMatch(/iron stores/)
    expect(markerGuidance('Gibt es nicht', 'de')).toBeNull()
  })

  it('zeigt, wie viele Katalogmarker eine Einordnung haben', () => {
    expect(GUIDANCE_MARKERS.length).toBeLessThanOrEqual(MARKER_CATALOG.length)
  })
})

describe('Einordnungs-Pakete', () => {
  it('jeder Marker steht in genau einem Paket', async () => {
    const { GUIDANCE_PAKETE } = await import('./guidance')
    const namen = GUIDANCE_PAKETE.flatMap(paket => Object.keys(paket))
    expect(new Set(namen).size).toBe(namen.length)
  })
})
