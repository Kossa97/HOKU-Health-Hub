import { supabase } from '../../../lib/supabase'
import { serverFehler } from './pruefung'
import { merkeAngemeldetBleiben } from './sitzung'
import { lies, schreib } from './speicher'

/**
 * Face ID in der Web-App: Passkeys (WebAuthn) über Supabase Auth. Auf dem
 * iPhone liegt der Passkey im iCloud-Schlüsselbund, iOS fragt mit Face ID.
 *
 * Die Passkey-Schnittstelle von Supabase ist experimentell (supabase-js
 * ≥ 2.105, `auth.experimental.passkey`). Nur dieses Modul spricht mit ihr;
 * ändert sie sich, ändert sich nur diese Datei.
 *
 * Sichtbar wird alles erst, wenn Passkeys im Supabase-Dashboard eingerichtet
 * sind und das Build es weiß (VITE_AUTH_PASSKEY=1, docs/login/PASSKEYS.md).
 */

export const PASSKEY_AN = import.meta.env.VITE_AUTH_PASSKEY === '1'

// Auf diesem Gerät wurde ein Passkey eingerichtet (Wert: seine ID) oder
// damit angemeldet ('1'): nur dann steht der Face-ID-Knopf im Login
const GERAET = 'tyd.passkey'
// Die einmalige Nachfrage nach der Anmeldung
const GEFRAGT = 'tyd.passkeyGefragt'
const ANBIETEN = 'tyd.passkeyAnbieten'

/** Kann dieses Gerät Passkeys mit Biometrie (Face ID, Touch ID, Windows Hello)? */
export async function passkeyMoeglich(): Promise<boolean> {
  if (!PASSKEY_AN || typeof window === 'undefined' || !window.PublicKeyCredential) return false
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() } catch { return false }
}

export const passkeyAufGeraet = () => !!lies(GERAET)
/** Die ID des hier eingerichteten Passkeys, wenn bekannt. */
export const passkeyDiesesGeraets = () => { const v = lies(GERAET); return v && v !== '1' ? v : null }

/** Wie der Knopf heißt: auf Apple-Geräten Face ID, sonst allgemein Passkey. */
export const passkeyArt = (ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) =>
  /iPhone|iPad|Macintosh/.test(ua) ? 'Face ID' : 'Passkey'

export type PasskeyFehler = 'abgebrochen' | 'unbekannt' | 'netz' | 'fehler'

/** Antworten der Bibliothek und des Browsers einordnen. */
export function passkeyFehler(error: unknown): PasskeyFehler {
  const e = error as { name?: string; code?: string; cause?: { name?: string } } | null
  if (e?.name === 'NotAllowedError' || e?.cause?.name === 'NotAllowedError' || e?.code === 'ERROR_CEREMONY_ABORTED' || e?.name === 'AbortError') return 'abgebrochen'
  if (e?.code === 'webauthn_credential_not_found') return 'unbekannt'
  return serverFehler(error) === 'netz' && !e?.code ? 'netz' : 'fehler'
}

export async function anmeldenMitPasskey(): Promise<PasskeyFehler | null> {
  const { error } = await supabase.auth.signInWithPasskey().then(r => r, (err: unknown) => ({ error: err }))
  if (!error) {
    // Face ID bleibt angemeldet; der Knopf bleibt auf diesem Gerät
    merkeAngemeldetBleiben(true)
    if (!lies(GERAET)) schreib(GERAET, '1')
    return null
  }
  const art = passkeyFehler(error)
  // Gelöscht oder auf einem anderen Konto: der Knopf führt hier nicht mehr weiter
  if (art === 'unbekannt') schreib(GERAET, null)
  return art
}

export async function richtePasskeyEin(): Promise<PasskeyFehler | null> {
  schreib(GEFRAGT, '1')
  const { data, error } = await supabase.auth.registerPasskey().then(r => r, (err: unknown) => ({ data: null, error: err }))
  const schonDa = (error as { code?: string } | null)?.code
  if (!error || schonDa === 'webauthn_credential_exists' || schonDa === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
    schreib(GERAET, data?.id ?? lies(GERAET) ?? '1')
    return null
  }
  return passkeyFehler(error)
}

export interface PasskeyEintrag { id: string; name: string; zuletzt: string | null }

export async function passkeys(): Promise<PasskeyEintrag[] | null> {
  const { data, error } = await supabase.auth.passkey.list().then(r => r, () => ({ data: null, error: true }))
  if (error || !data) return null
  return data.map(p => ({ id: p.id, name: p.friendly_name ?? '', zuletzt: p.last_used_at ?? null }))
}

/** Entfernen; war es der Passkey dieses Geräts (oder der letzte), verschwindet der Knopf hier. */
export async function entfernePasskey(id: string, letzter: boolean): Promise<boolean> {
  const { error } = await supabase.auth.passkey.delete({ passkeyId: id }).then(r => r, (err: unknown) => ({ error: err }))
  if (!error && (letzter || passkeyDiesesGeraets() === id)) schreib(GERAET, null)
  return !error
}

/** Nach einer Anmeldung ohne Passkey: einmal anbieten, Face ID einzurichten. */
export const merkePasskeyAnbieten = () => schreib(ANBIETEN, '1', 'sitzung')

export async function passkeyNachfrageFaellig(): Promise<boolean> {
  if (lies(ANBIETEN, 'sitzung') !== '1') return false
  schreib(ANBIETEN, null, 'sitzung')
  if (lies(GEFRAGT) === '1' || passkeyAufGeraet()) return false
  return passkeyMoeglich()
}

export const passkeyNichtFragen = () => schreib(GEFRAGT, '1')
