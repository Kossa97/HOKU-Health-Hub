import { describe, expect, it } from 'vitest'
import { zielAusLink } from './appLinkZiel'

describe('Links, die die App öffnen', () => {
  it('nimmt nur unsere Domain, https und die Anmeldung', () => {
    expect(zielAusLink('https://hokuhealth.app/auth?bestaetigen=abc&art=signup')).toBe('/auth?bestaetigen=abc&art=signup')
    expect(zielAusLink('https://www.hokuhealth.app/auth/?x=1')).toBe('/auth/?x=1')
    expect(zielAusLink('http://hokuhealth.app/auth?x=1')).toBeNull()
    expect(zielAusLink('https://hokuhealth.app.boese.de/auth')).toBeNull()
    expect(zielAusLink('https://hokuhealth.app/profil')).toBeNull()
    expect(zielAusLink('kein link')).toBeNull()
  })
})
