import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { pruefeLogin, pruefeRegistrierung, serverFehler } from './pruefung'

const gut = { benutzer: 'devin_k', email: 'a@b.de', passwort: 'geheim1', passwort2: 'geheim1', zugestimmt: true }

describe('Anmelden prüfen', () => {
  it('verlangt E-Mail oder Benutzername: mit @ als E-Mail geprüft, sonst als Name', () => {
    expect(pruefeLogin('', 'x')).toEqual({ feld: 'kennung', text: 'login_err_id_empty' })
    expect(pruefeLogin('  ', 'x')).toEqual({ feld: 'kennung', text: 'login_err_id_empty' })
    expect(pruefeLogin('a@b', 'x')).toEqual({ feld: 'kennung', text: 'login_err_email_bad' })
    expect(pruefeLogin('de', 'x')).toEqual({ feld: 'kennung', text: 'login_err_user_bad' })
    expect(pruefeLogin('mit leer', 'x')).toEqual({ feld: 'kennung', text: 'login_err_user_bad' })
    expect(pruefeLogin('devin_k', 'x')).toBeNull()
  })
  it('verlangt ein Passwort, prüft aber keine Länge (alte Konten)', () => {
    expect(pruefeLogin('a@b.de', '')).toEqual({ feld: 'passwort', text: 'login_err_pw_empty' })
    expect(pruefeLogin(' a@b.de ', '1')).toBeNull()
  })
})

describe('Registrieren prüfen', () => {
  it('nimmt ein vollständiges Formular an', () => {
    expect(pruefeRegistrierung(gut)).toBeNull()
  })
  it('prüft den Benutzernamen: 3 bis 20 Zeichen, Buchstaben, Zahlen, Punkt, Unterstrich', () => {
    expect(pruefeRegistrierung({ ...gut, benutzer: '' })?.text).toBe('login_err_user_empty')
    expect(pruefeRegistrierung({ ...gut, benutzer: 'ab' })?.text).toBe('login_err_user_bad')
    expect(pruefeRegistrierung({ ...gut, benutzer: 'a'.repeat(21) })?.text).toBe('login_err_user_bad')
    expect(pruefeRegistrierung({ ...gut, benutzer: 'mit leer' })?.text).toBe('login_err_user_bad')
    expect(pruefeRegistrierung({ ...gut, benutzer: 'jürgen' })?.text).toBe('login_err_user_bad')
    expect(pruefeRegistrierung({ ...gut, benutzer: 'a.b_9' })).toBeNull()
  })
  it('meldet den ersten Fehler in der Reihenfolge der Felder', () => {
    expect(pruefeRegistrierung({ ...gut, email: 'x', passwort: '1' })?.feld).toBe('email')
    expect(pruefeRegistrierung({ ...gut, passwort: '12345', passwort2: '12345' })).toEqual({ feld: 'passwort', text: 'login_err_pw_short' })
    expect(pruefeRegistrierung({ ...gut, passwort2: '' })).toEqual({ feld: 'passwort2', text: 'login_err_pw2_empty' })
    expect(pruefeRegistrierung({ ...gut, passwort2: 'geheim2' })).toEqual({ feld: 'passwort2', text: 'login_err_pw_mismatch' })
    expect(pruefeRegistrierung({ ...gut, zugestimmt: false })).toEqual({ feld: 'zustimmung', text: 'consent_required' })
  })
})

describe('Antwort des Servers einordnen', () => {
  it('ohne Netz oder bei abgebrochener Verbindung: netz', () => {
    expect(serverFehler(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'), false)).toBe('netz')
    expect(serverFehler(new AuthRetryableFetchError('Failed to fetch', 0), true)).toBe('netz')
    expect(serverFehler(new TypeError('Failed to fetch'), true)).toBe('netz')
  })
  it('abgelehnte Zugangsdaten: falsch', () => {
    expect(serverFehler(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'), true)).toBe('falsch')
  })
})
