import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { CODE_LAENGE, alsUhr, codeFehler, istUnbestaetigt, kontoVorhanden, nurZiffern, restSekunden } from './code'
import { pruefeNeuesPasswort } from './pruefung'

describe('Code aus der Mail', () => {
  it('nimmt nur Ziffern, auch aus eingefügtem Text, höchstens so viele wie der Code hat', () => {
    expect(CODE_LAENGE).toBe(6)
    expect(nurZiffern('Code: 123 456')).toBe('123456')
    expect(nurZiffern('1234567890')).toBe('123456')
    expect(nurZiffern('abc')).toBe('')
  })

  it('ordnet Fehler ein: falsch/abgelaufen, zu viele, kein Netz, Server', () => {
    expect(codeFehler(new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'), true)).toBe('falsch')
    expect(codeFehler(new AuthApiError('rate limit', 429, 'over_email_send_rate_limit'), true)).toBe('viele')
    expect(codeFehler(new AuthApiError('too many', 400, 'over_request_rate_limit'), true)).toBe('viele')
    expect(codeFehler(new AuthRetryableFetchError('fetch failed', 0), true)).toBe('netz')
    expect(codeFehler(new AuthApiError('boom', 500, 'unexpected_failure'), true)).toBe('fehler')
    expect(codeFehler(new AuthApiError('x', 403, 'otp_expired'), false)).toBe('netz')
  })

  it('erkennt unbestätigte Adressen und schon vorhandene Konten', () => {
    expect(istUnbestaetigt(new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'))).toBe(true)
    expect(istUnbestaetigt(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'))).toBe(false)
    expect(istUnbestaetigt(null)).toBe(false)
    expect(kontoVorhanden({ identities: [] })).toBe(true)
    expect(kontoVorhanden({ identities: [{ provider: 'email' }] })).toBe(false)
    expect(kontoVorhanden({})).toBe(false)
    expect(kontoVorhanden(null)).toBe(false)
  })

  it('zählt die Sperre für „Neuen Code senden" herunter', () => {
    expect(restSekunden(60_000, 0)).toBe(60)
    expect(restSekunden(60_000, 59_001)).toBe(1)
    expect(restSekunden(60_000, 61_000)).toBe(0)
    expect(alsUhr(60)).toBe('1:00')
    expect(alsUhr(9)).toBe('0:09')
  })

  it('neues Passwort: lang genug, zweimal gleich', () => {
    expect(pruefeNeuesPasswort('12345', '12345')).toEqual({ feld: 'passwort', text: 'login_err_pw_short' })
    expect(pruefeNeuesPasswort('geheim1', '')).toEqual({ feld: 'passwort2', text: 'login_err_pw2_empty' })
    expect(pruefeNeuesPasswort('geheim1', 'geheim2')).toEqual({ feld: 'passwort2', text: 'login_err_pw_mismatch' })
    expect(pruefeNeuesPasswort('geheim1', 'geheim1')).toBeNull()
  })
})
