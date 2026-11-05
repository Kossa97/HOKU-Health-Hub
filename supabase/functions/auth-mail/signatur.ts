/**
 * Prüft die Signatur, mit der Supabase den Send Email Hook aufruft (Standard Webhooks:
 * https://www.standardwebhooks.com). Signiert wird `${id}.${zeit}.${body}` mit HMAC-SHA256;
 * das Secret kommt aus dem Dashboard als `v1,whsec_<base64>`. Ohne Fremdpaket, damit es in
 * Deno (Function) und Node (Tests) gleich läuft; verglichen wird über `crypto.subtle.verify`,
 * also in konstanter Zeit.
 */

/** So weit darf der Zeitstempel von jetzt abweichen (gegen wiederholte Aufrufe). */
export const TOLERANZ_S = 5 * 60

export type SignaturFehler = 'kein_secret' | 'kopf_fehlt' | 'zeit' | 'signatur'

export interface Koepfe {
  id: string | null
  zeit: string | null
  signatur: string | null
}

function base64ZuBytes(text: string): Uint8Array | null {
  try {
    const roh = atob(text)
    const bytes = new Uint8Array(roh.length)
    for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** `v1,whsec_abc…` oder `whsec_abc…` → Schlüssel-Bytes. */
export function secretBytes(secret: string): Uint8Array | null {
  const ohne = secret.trim().replace(/^v1,/, '').replace(/^whsec_/, '')
  if (!ohne) return null
  const bytes = base64ZuBytes(ohne)
  return bytes && bytes.length ? bytes : null
}

/**
 * null = gültig. `jetzt` in Sekunden (für Tests). Mehrere Signaturen im Kopf sind erlaubt
 * (beim Wechsel des Secrets), eine passende genügt.
 */
export async function pruefeSignatur(
  secret: string,
  koepfe: Koepfe,
  body: string,
  jetzt = Math.floor(Date.now() / 1000),
): Promise<SignaturFehler | null> {
  const schluessel = secretBytes(secret)
  if (!schluessel) return 'kein_secret'
  const { id, zeit, signatur } = koepfe
  if (!id || !zeit || !signatur) return 'kopf_fehlt'
  if (!/^\d{1,12}$/.test(zeit)) return 'zeit'
  if (Math.abs(jetzt - Number(zeit)) > TOLERANZ_S) return 'zeit'

  const key = await crypto.subtle.importKey('raw', schluessel, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const inhalt = new TextEncoder().encode(`${id}.${zeit}.${body}`)
  for (const teil of signatur.split(' ')) {
    const [version, wert] = teil.split(',', 2)
    if (version !== 'v1' || !wert) continue
    const bytes = base64ZuBytes(wert)
    if (!bytes) continue
    if (await crypto.subtle.verify('HMAC', key, bytes, inhalt)) return null
  }
  return 'signatur'
}
