import { describe, expect, it } from 'vitest'
import { conversionHint } from './conversionHint'

describe('conversionHint', () => {
  it('zeigt die Umrechnung bei abweichender Masse-Einheit', () => {
    expect(conversionHint('Testosteron', 'µg/l', 13.1)).toBe('≈ 1.310 ng/dL')
  })

  it('gibt null bei gleicher Einheit zurück', () => {
    expect(conversionHint('Testosteron', 'ng/dL', 600)).toBeNull()
  })

  it('ignoriert Groß-/Kleinschreibung der Einheit', () => {
    expect(conversionHint('Testosteron', 'NG/DL', 600)).toBeNull()
  })

  it('erkennt einen Marker auch über ein Synonym', () => {
    expect(conversionHint('Gesamttestosteron', 'µg/l', 6.12)).toBe('≈ 612 ng/dL')
  })

  it('gibt null für nicht sicher umrechenbare Einheiten zurück', () => {
    expect(conversionHint('Prolaktin', 'mU/L', 306)).toBeNull()
  })

  it('rechnet molare Einheiten mit veroeffentlichtem Faktor um', () => {
    expect(conversionHint('Testosteron', 'nmol/L', 20)).toMatch(/^≈ 576[,.]\d* ng\/dL$/)
  })

  it('gibt null für unbekannte Marker zurück', () => {
    expect(conversionHint('Phantasiewert', 'µg/l', 5)).toBeNull()
  })

  it('gibt null bei leerer Einheit oder ungültigem Wert zurück', () => {
    expect(conversionHint('Testosteron', '', 5)).toBeNull()
    expect(conversionHint('Testosteron', 'µg/l', Number.NaN)).toBeNull()
  })
})
