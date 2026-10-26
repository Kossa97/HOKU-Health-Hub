import { describe, expect, it } from 'vitest'
import { formatEingabe } from './format'

describe('Zahl fuer das Eingabefeld', () => {
  it('nimmt das Dezimalzeichen der Sprache, ohne Tausendertrennung und ohne zu runden', () => {
    expect(formatEingabe(16.5, 'de')).toBe('16,5')
    expect(formatEingabe(16.5, 'en')).toBe('16.5')
    expect(formatEingabe('1234.5678', 'de')).toBe('1234,5678')
    expect(formatEingabe(12, 'de')).toBe('12')
    // weder Komma noch Punkt in der Sprache: Punkt, den das Formular lesen kann
    expect(formatEingabe(16.5, 'ar-EG')).toBe('16.5')
  })

  it('laesst Unlesbares stehen', () => {
    expect(formatEingabe('n. a.', 'de')).toBe('n. a.')
  })
})
