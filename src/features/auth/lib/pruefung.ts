import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js'

/**
 * Was die Anmeldung im Gerät prüft, bevor sie den Server fragt, und wie sie
 * Antworten des Servers einordnet. Regeln aus docs/login/UEBERGABE.md (3.3).
 */

export type LoginFeld = 'kennung' | 'passwort'
export type RegFeld = 'benutzer' | 'email' | 'passwort' | 'passwort2' | 'zustimmung'

/** Ein Fehler, den das Gerät erkennt: Feld und Text-Schlüssel. */
export interface Eingabefehler<F extends string> { feld: F; text: string }

export const BENUTZERNAME = /^[A-Za-z0-9._]{3,20}$/
// Bewusst schlicht: ein @, davor und danach etwas, hinten ein Punkt mit Endung
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const MIN_PASSWORT = 6

export function pruefeEmail(email: string): string | null {
  const e = email.trim()
  if (!e) return 'login_err_email_empty'
  return EMAIL.test(e) ? null : 'login_err_email_bad'
}

/** Mit @ ist es eine E-Mail, sonst ein Benutzername. */
export const istEmail = (kennung: string) => kennung.includes('@')

export function pruefeLogin(kennung: string, passwort: string): Eingabefehler<LoginFeld> | null {
  const k = kennung.trim()
  if (!k) return { feld: 'kennung', text: 'login_err_id_empty' }
  if (istEmail(k)) { const e = pruefeEmail(k); if (e) return { feld: 'kennung', text: e } }
  else if (!BENUTZERNAME.test(k)) return { feld: 'kennung', text: 'login_err_user_bad' }
  if (!passwort) return { feld: 'passwort', text: 'login_err_pw_empty' }
  return null
}

export function pruefeRegistrierung(f: {
  benutzer: string; email: string; passwort: string; passwort2: string; zugestimmt: boolean
}): Eingabefehler<RegFeld> | null {
  const b = f.benutzer.trim()
  if (!b) return { feld: 'benutzer', text: 'login_err_user_empty' }
  if (!BENUTZERNAME.test(b)) return { feld: 'benutzer', text: 'login_err_user_bad' }
  const e = pruefeEmail(f.email)
  if (e) return { feld: 'email', text: e }
  if (f.passwort.length < MIN_PASSWORT) return { feld: 'passwort', text: 'login_err_pw_short' }
  if (!f.passwort2) return { feld: 'passwort2', text: 'login_err_pw2_empty' }
  if (f.passwort2 !== f.passwort) return { feld: 'passwort2', text: 'login_err_pw_mismatch' }
  if (!f.zugestimmt) return { feld: 'zustimmung', text: 'consent_required' }
  return null
}

/** Kein Netz oder Zugangsdaten falsch bzw. sonst abgelehnt? */
export type ServerFehler = 'netz' | 'falsch'

export function serverFehler(error: unknown, online = typeof navigator === 'undefined' || navigator.onLine): ServerFehler {
  if (!online || isAuthRetryableFetchError(error)) return 'netz'
  if (isAuthApiError(error)) return 'falsch'
  // fetch selbst scheitert (offline, DNS, CORS): TypeError
  if (error instanceof TypeError) return 'netz'
  return 'falsch'
}
