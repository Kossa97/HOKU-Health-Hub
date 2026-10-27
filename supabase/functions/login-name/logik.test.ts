import { describe, expect, it } from 'vitest'
import { pruefeEingabe } from './logik'

describe('login-name: Eingabe prüfen', () => {
  it('nimmt Name und Passwort, Name ohne Leerraum', () => {
    expect(pruefeEingabe({ name: ' devin_k ', passwort: 'geheim' })).toEqual({ name: 'devin_k', passwort: 'geheim' })
  })
  it('lehnt alles andere ab: keine E-Mail, keine falschen Zeichen, kein leeres oder zu langes Passwort', () => {
    expect(pruefeEingabe(null)).toBeNull()
    expect(pruefeEingabe('x')).toBeNull()
    expect(pruefeEingabe({ name: 'a@b.de', passwort: 'x' })).toBeNull()
    expect(pruefeEingabe({ name: 'ab', passwort: 'x' })).toBeNull()
    expect(pruefeEingabe({ name: "x' or 1=1", passwort: 'x' })).toBeNull()
    expect(pruefeEingabe({ name: 'devin', passwort: '' })).toBeNull()
    expect(pruefeEingabe({ name: 'devin', passwort: 'x'.repeat(201) })).toBeNull()
    expect(pruefeEingabe({ name: 'devin', passwort: 42 })).toBeNull()
  })
})
