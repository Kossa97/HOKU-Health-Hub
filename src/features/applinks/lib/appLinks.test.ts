import { describe, expect, it } from 'vitest'
import { APP_LINK_ORIGIN, appLinkRoute } from './appLinks'
import { HOKU_CODE_ORIGIN } from '../../profil/lib/hokuCode'

describe('appLinkRoute', () => {
  it('folgt geteilten Profiladressen', () => {
    expect(appLinkRoute('https://hokuhealth.app/u/anna')).toBe('/u/anna')
    expect(appLinkRoute('https://hokuhealth.app/u/anna/')).toBe('/u/anna')
    expect(appLinkRoute('https://hokuhealth.app/u/Anna.M_92')).toBe('/u/anna.m_92')
    expect(appLinkRoute('https://HOKUHEALTH.APP/u/anna')).toBe('/u/anna')
    expect(appLinkRoute('https://hokuhealth.app/u/an%6Ea')).toBe('/u/anna')
  })

  it('lässt Abfrage und Anker weg', () => {
    expect(appLinkRoute('https://hokuhealth.app/u/anna?als=web')).toBe('/u/anna')
    expect(appLinkRoute('https://hokuhealth.app/u/anna#x')).toBe('/u/anna')
  })

  it.each([
    ['fremder Host', 'https://evil.example/u/anna'],
    ['Subdomain', 'https://www.hokuhealth.app/u/anna'],
    ['Host als Präfix', 'https://hokuhealth.app.evil.example/u/anna'],
    ['Port', 'https://hokuhealth.app:8443/u/anna'],
    ['Zugangsdaten', 'https://x:y@hokuhealth.app/u/anna'],
    ['http', 'http://hokuhealth.app/u/anna'],
    ['eigenes Schema', 'hoku://hokuhealth.app/u/anna'],
    ['Capacitor-Adresse', 'capacitor://localhost/u/anna'],
    ['anderer Pfad', 'https://hokuhealth.app/profil'],
    ['Startseite', 'https://hokuhealth.app/'],
    ['Unterpfad', 'https://hokuhealth.app/u/anna/einstellungen'],
    ['ohne Name', 'https://hokuhealth.app/u/'],
    ['Pfad-Trick', 'https://hokuhealth.app/u/..%2Fauth'],
    ['Schrägstrich kodiert', 'https://hokuhealth.app/u/anna%2Fx'],
    ['zu kurz', 'https://hokuhealth.app/u/ab'],
    ['zu lang', `https://hokuhealth.app/u/${'a'.repeat(21)}`],
    ['Sonderzeichen', 'https://hokuhealth.app/u/an%20na'],
    ['Umlaut', 'https://hokuhealth.app/u/j%C3%BCrgen'],
    ['kaputte Kodierung', 'https://hokuhealth.app/u/%E0%A4%A'],
    ['keine Adresse', 'kein link'],
    ['leer', ''],
  ])('ignoriert %s', (_case, url) => {
    expect(appLinkRoute(url)).toBeNull()
  })

  it('nutzt dieselbe Domain wie der Hoku-Code', () => {
    expect(APP_LINK_ORIGIN).toBe(HOKU_CODE_ORIGIN)
  })
})
