import { describe, expect, it } from 'vitest'
import { TERMS_VERSION, zustimmungAusMetadaten, zustimmungFehlt, zustimmungsZeile } from './consent'
import { filterFehlerSchluessel } from './moderation'

describe('Zustimmung', () => {
  it('fehlt ohne Profil, ohne Zeitpunkte oder bei alter Fassung', () => {
    expect(zustimmungFehlt(null)).toBe(true)
    expect(zustimmungFehlt({ age_confirmed_at: null, terms_accepted_at: null, terms_version: null })).toBe(true)
    expect(zustimmungFehlt({ age_confirmed_at: '2026-10-01T00:00:00Z', terms_accepted_at: null, terms_version: TERMS_VERSION })).toBe(true)
    expect(zustimmungFehlt({ age_confirmed_at: '2026-10-01T00:00:00Z', terms_accepted_at: '2026-10-01T00:00:00Z', terms_version: '2020-01' })).toBe(true)
  })

  it('fragt nach der Fassung 2026-10 erneut (Datenschutz um die Web-Seite ergaenzt)', () => {
    expect(TERMS_VERSION).toBe('2026-11')
    const alt = { age_confirmed_at: '2026-10-05T10:00:00Z', terms_accepted_at: '2026-10-05T10:00:00Z', terms_version: '2026-10' }
    expect(zustimmungFehlt(alt)).toBe(true)
    // auch eine alte Zustimmung aus den Konto-Metadaten wird nicht still uebernommen
    expect(zustimmungAusMetadaten(alt)).toBeNull()
  })

  it('ist vollstaendig mit beiden Zeitpunkten und aktueller Fassung', () => {
    const row = zustimmungsZeile(new Date('2026-10-05T10:00:00Z'))
    expect(row).toEqual({ age_confirmed_at: '2026-10-05T10:00:00.000Z', terms_accepted_at: '2026-10-05T10:00:00.000Z', terms_version: TERMS_VERSION })
    expect(zustimmungFehlt(row)).toBe(false)
  })

  it('uebernimmt nur vollstaendige Zustimmung aus den Metadaten', () => {
    const row = zustimmungsZeile(new Date('2026-10-05T10:00:00Z'))
    expect(zustimmungAusMetadaten({ ...row, username: 'x' })).toEqual(row)
    expect(zustimmungAusMetadaten({ age_confirmed_at: row.age_confirmed_at })).toBeNull()
    expect(zustimmungAusMetadaten({ ...row, terms_version: 1 })).toBeNull()
    expect(zustimmungAusMetadaten(undefined)).toBeNull()
  })
})

describe('Textfilter-Fehler', () => {
  it('ordnet die Datenbank-Codes Texten zu', () => {
    expect(filterFehlerSchluessel('oeffentlicher_text_link')).toBe('moderation_text_link')
    expect(filterFehlerSchluessel('ERROR: oeffentlicher_text_handel')).toBe('moderation_text_trade')
    expect(filterFehlerSchluessel('oeffentlicher_text_beleidigung')).toBe('moderation_text_abuse')
    expect(filterFehlerSchluessel('oeffentliches_profil_link')).toBe('moderation_profile_link')
    expect(filterFehlerSchluessel('oeffentliches_profil_handel')).toBe('moderation_profile_trade')
  })

  it('laesst andere Fehler durch', () => {
    expect(filterFehlerSchluessel('duplicate key')).toBeNull()
    expect(filterFehlerSchluessel(undefined)).toBeNull()
  })
})
