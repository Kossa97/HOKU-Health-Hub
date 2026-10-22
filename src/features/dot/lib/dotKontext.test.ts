import { describe, expect, it } from 'vitest'
import { heuteOffen, type DotKontext } from './dotKontext'

const k = (jetzt: string): DotKontext => ({
  heute: '2026-10-22', jetzt, zeitzone: 'Europe/Berlin', stack: [], blutwerte: [], ernaehrung: null,
  einnahmen: [
    { datum: '2026-10-21', zeit: '08:00', minuten: 480, substanz: 'A', menge: null, status: 'offen' },
    { datum: '2026-10-22', zeit: '08:00', minuten: 480, substanz: 'D3', menge: null, status: 'genommen' },
    { datum: '2026-10-22', zeit: '12:00', minuten: 720, substanz: 'Mg', menge: null, status: 'offen' },
    { datum: '2026-10-22', zeit: '18:00', minuten: 1080, substanz: 'BPC-157', menge: '250 mcg', status: 'offen' },
  ],
})

describe('Dot: was heute offen ist', () => {
  it('nächste offene ab jetzt und letzte verpasste, nur heute', () => {
    const h = heuteOffen(k('14:30'))
    expect(h.geplant).toBe(3)
    expect(h.offen).toBe(2)
    expect(h.naechste?.substanz).toBe('BPC-157')
    expect(h.verpasst?.substanz).toBe('Mg')
  })
  it('rechnet mit der aktuellen Uhrzeit statt der beim Laden', () => {
    const h = heuteOffen(k('09:00'), '19:00')
    expect(h.naechste).toBeNull()
    expect(h.verpasst?.substanz).toBe('BPC-157')
  })
  it('morgens ist nichts verpasst', () => {
    const h = heuteOffen(k('09:00'))
    expect(h.naechste?.substanz).toBe('Mg')
    expect(h.verpasst).toBeNull()
  })
})
