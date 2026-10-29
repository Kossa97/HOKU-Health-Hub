import { describe, expect, it } from 'vitest'
import { rueckkehr } from './anbieter'

describe('Rückkehr vom Anbieter', () => {
  it('erkennt Anbieter und Erfolg', () => {
    expect(rueckkehr('?anbieter=google', '#access_token=x&type=bearer')).toEqual({ anbieter: 'google', fehler: false })
    expect(rueckkehr('?anbieter=apple&code=abc', '')).toEqual({ anbieter: 'apple', fehler: false })
  })
  it('erkennt Fehler im Query oder im Hash (z. B. abgebrochen)', () => {
    expect(rueckkehr('?anbieter=apple&error=access_denied', '')).toEqual({ anbieter: 'apple', fehler: true })
    expect(rueckkehr('?anbieter=google', '#error=server_error&error_description=x')).toEqual({ anbieter: 'google', fehler: true })
  })
  it('ignoriert fremde Werte und normale Aufrufe', () => {
    expect(rueckkehr('?anbieter=facebook', '')).toEqual({ anbieter: null, fehler: false })
    expect(rueckkehr('', '')).toEqual({ anbieter: null, fehler: false })
  })
})
