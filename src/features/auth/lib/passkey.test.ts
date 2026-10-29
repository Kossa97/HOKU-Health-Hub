import { AuthApiError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { passkeyArt, passkeyFehler } from './passkey'

describe('Passkey: Fehler einordnen', () => {
  it('abgebrochen: Face ID weggewischt oder Zeremonie abgebrochen', () => {
    expect(passkeyFehler(Object.assign(new Error('x'), { name: 'NotAllowedError' }))).toBe('abgebrochen')
    expect(passkeyFehler({ code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY', cause: { name: 'NotAllowedError' } })).toBe('abgebrochen')
    expect(passkeyFehler({ code: 'ERROR_CEREMONY_ABORTED' })).toBe('abgebrochen')
  })
  it('unbekannt: der Server kennt den Passkey nicht (mehr)', () => {
    expect(passkeyFehler(new AuthApiError('not found', 404, 'webauthn_credential_not_found'))).toBe('unbekannt')
  })
  it('netz und sonstige Fehler', () => {
    expect(passkeyFehler(new TypeError('Failed to fetch'))).toBe('netz')
    expect(passkeyFehler(new AuthApiError('x', 400, 'webauthn_verification_failed'))).toBe('fehler')
  })
})

describe('Passkey: Bezeichnung', () => {
  it('Apple-Geräte sagen Face ID, andere Passkey', () => {
    expect(passkeyArt('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)')).toBe('Face ID')
    expect(passkeyArt('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('Passkey')
  })
})
