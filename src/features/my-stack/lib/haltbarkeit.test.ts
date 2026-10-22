import { describe, expect, it } from 'vitest'
import { aufbrauchenBis, haltbarkeitArt } from './bestand'

describe('haltbarkeitArt', () => {
  it('nennt je Form das passende Wort — oder nur das Ablaufdatum', () => {
    expect(haltbarkeitArt('vial', 'peptide')).toBe('angemischt')
    expect(haltbarkeitArt('vial', 'hormone')).toBe('angebrochen')
    expect(haltbarkeitArt('pen', 'medication')).toBe('benutzung')
    for (const form of ['drops', 'spray', 'nasal_spray', 'gel', 'tube', 'powder'] as const) {
      expect(haltbarkeitArt(form, 'supplement'), form).toBe('geoeffnet')
    }
    for (const form of ['ampoule', 'capsule', 'tablet', 'patch', 'other'] as const) {
      expect(haltbarkeitArt(form, 'supplement'), form).toBeNull()
    }
    expect(haltbarkeitArt(null, null)).toBeNull()
  })
})

describe('aufbrauchenBis', () => {
  it('rechnet Oeffnen plus Haltbarkeit', () => {
    expect(aufbrauchenBis('2026-10-20', 28)).toBe('2026-11-17')
  })

  it('endet spaetestens mit dem Ablaufdatum', () => {
    expect(aufbrauchenBis('2026-10-20', 28, '2026-11-01')).toBe('2026-11-01')
    expect(aufbrauchenBis('2026-10-20', 28, '2027-01-01')).toBe('2026-11-17')
  })

  it('bleibt leer, solange etwas fehlt oder die Haltbarkeit ungueltig ist', () => {
    expect(aufbrauchenBis(null, 28)).toBeNull()
    expect(aufbrauchenBis('2026-10-20', null)).toBeNull()
    expect(aufbrauchenBis('2026-10-20', 0)).toBeNull()
  })
})
