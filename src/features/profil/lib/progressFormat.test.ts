import { describe, expect, it } from 'vitest'
import { metricName } from './progressFormat'

const t = (key: string, vars?: Record<string, unknown>) => (key === 'pf_wert_e1rm' ? `${vars?.name} e1RM` : key)

describe('metricName', () => {
  it('e1RM mit dem Übungsnamen aus der Liste (eigene Übungen)', () => {
    expect(metricName('e1rm:custom:0b6d1c2e-1111-4222-8333-444455556666', t, { 'custom:0b6d1c2e-1111-4222-8333-444455556666': 'Meine Übung' }, 'de'))
      .toBe('Meine Übung e1RM')
  })

  it('ohne Eintrag über den Katalog in der App-Sprache, nie die Kennung', () => {
    expect(metricName('e1rm:deadlift_barbell', t, undefined, 'de')).toBe('Kreuzheben (Langhantel) e1RM')
    expect(metricName('e1rm:deadlift_barbell', t, {}, 'en-GB')).toBe('Deadlift (Barbell) e1RM')
  })

  it('übrige Werte über ihren Schlüssel', () => {
    expect(metricName('body_fat', t, undefined, 'de')).toBe('pf_wert_body_fat')
  })
})
