import { describe, expect, it } from 'vitest'
import { linkKarte, teilenStand } from './shareCard'

const fortschritt = (total: number | null, areas: Record<string, number | null> = { koerper: 31 }) => ({ total, areas })

describe('teilenStand', () => {
  it('privat geht vor dem Web-Link', () => {
    expect(teilenStand({ webLink: true, privat: true })).toBe('privat')
    expect(teilenStand({ webLink: false, privat: true })).toBe('privat')
  })
  it('sonst an oder aus', () => {
    expect(teilenStand({ webLink: true, privat: false })).toBe('an')
    expect(teilenStand({ webLink: false, privat: false })).toBe('aus')
  })
})

describe('linkKarte (Spec 3.3)', () => {
  it('Web-Link aus oder privat: neutrale Karte, auch mit Fortschritt auf „Alle“', () => {
    for (const stand of ['aus', 'privat'] as const) {
      expect(linkKarte({ stand, progressVisibility: 'all', progress: fortschritt(42) })).toBe('neutral')
    }
  })

  it('Fortschritt auf „Alle“, ab 10 %, von einem Web-Bereich getragen: Fortschrittskarte', () => {
    expect(linkKarte({ stand: 'an', progressVisibility: 'all', progress: fortschritt(10) })).toBe('fortschritt')
    expect(linkKarte({ stand: 'an', progressVisibility: 'all', progress: fortschritt(64, { training: 12, blut: 80 }) })).toBe('fortschritt')
    expect(linkKarte({ stand: 'an', progressVisibility: 'all', progress: fortschritt(20, { erholung: 0 }) })).toBe('fortschritt')
  })

  it('sonst Rückfall: Karte mit Bild und Name', () => {
    const an = 'an' as const
    // nicht auf „Alle“
    expect(linkKarte({ stand: an, progressVisibility: 'friends', progress: fortschritt(42) })).toBe('rueckfall')
    expect(linkKarte({ stand: an, progressVisibility: 'me', progress: fortschritt(42) })).toBe('rueckfall')
    // unter 10 %, negativ, keine Zahl
    expect(linkKarte({ stand: an, progressVisibility: 'all', progress: fortschritt(9.99) })).toBe('rueckfall')
    expect(linkKarte({ stand: an, progressVisibility: 'all', progress: fortschritt(-25) })).toBe('rueckfall')
    expect(linkKarte({ stand: an, progressVisibility: 'all', progress: fortschritt(null) })).toBe('rueckfall')
    expect(linkKarte({ stand: an, progressVisibility: 'all', progress: fortschritt(Number.NaN) })).toBe('rueckfall')
    expect(linkKarte({ stand: an, progressVisibility: 'all', progress: null })).toBe('rueckfall')
    // Schutzregel: nur Blut und Einnahmen tragen den Fortschritt
    expect(linkKarte({ stand: an, progressVisibility: 'all', progress: fortschritt(40, { blut: 50, einnahmen: 30 }) })).toBe('rueckfall')
    expect(linkKarte({ stand: an, progressVisibility: 'all', progress: fortschritt(40, { koerper: null, blut: 50 }) })).toBe('rueckfall')
  })
})
