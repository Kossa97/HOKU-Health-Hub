import { describe, expect, it } from 'vitest'
import { TERMS_VERSION, geburtsdatumAusMetadaten, geburtsdatumZeile, heuteLokal, pruefeGeburtsdatum, zustimmungAusMetadaten, zustimmungFehlt, zustimmungsZeile } from './consent'
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

describe('Geburtsdatum', () => {
  const heute = '2026-11-03'
  it('ab dem 18. Geburtstag, nicht früher', () => {
    expect(pruefeGeburtsdatum('2008-11-03', heute)).toBeNull()
    expect(pruefeGeburtsdatum('2008-11-04', heute)).toBe('login_err_birth_young')
    expect(pruefeGeburtsdatum('', heute)).toBe('login_err_birth_empty')
    expect(pruefeGeburtsdatum('1899-12-31', heute)).toBe('login_err_birth_bad')
    expect(pruefeGeburtsdatum('17.05.1990', heute)).toBe('login_err_birth_bad')
  })
  it('aus den Metadaten nur gültig und volljährig', () => {
    expect(geburtsdatumAusMetadaten({ birth_date: '1990-05-17' }, heute)).toBe('1990-05-17')
    expect(geburtsdatumAusMetadaten({ birth_date: '2015-01-01' }, heute)).toBeNull()
    expect(geburtsdatumAusMetadaten({ birth_date: 19900517 }, heute)).toBeNull()
    expect(geburtsdatumAusMetadaten(undefined, heute)).toBeNull()
  })
  it('Profilzeile führt das alte Feld age mit', () => {
    expect(geburtsdatumZeile('1990-05-17', heute)).toEqual({ birth_date: '1990-05-17', age: 36 })
  })
  it('heute in Ortszeit', () => {
    expect(heuteLokal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})
