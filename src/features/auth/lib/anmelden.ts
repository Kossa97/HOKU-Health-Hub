import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { serverFehler, type ServerFehler } from './pruefung'

/**
 * Anmelden mit Benutzername über die Edge Function `login-name`: sie meldet
 * serverseitig an und gibt die Tokens zurück, die App übernimmt die Sitzung.
 */

/** `viele`: zu viele Versuche für diesen Namen; `fehler`: Function nicht erreichbar oder kaputt. */
export type NamensFehler = ServerFehler | 'viele' | 'fehler'

export async function anmeldenMitName(name: string, passwort: string): Promise<NamensFehler | null> {
  const { data, error } = await supabase.functions
    .invoke<{ access_token?: string; refresh_token?: string }>('login-name', { body: { name: name.trim(), passwort } })
    .catch((err: unknown) => ({ data: null, error: err }))
  if (error) {
    if (!(error instanceof FunctionsHttpError)) return 'netz'
    const status = (error.context as Response | undefined)?.status
    return status === 401 ? 'falsch' : status === 429 ? 'viele' : 'fehler'
  }
  if (!data?.access_token || !data.refresh_token) return 'fehler'
  const { error: sitzungsFehler } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
  return sitzungsFehler ? serverFehler(sitzungsFehler) : null
}

/**
 * Ist der Benutzername frei? `null`, wenn es der Server (noch) nicht sagen
 * kann — dann entscheidet beim Anlegen die Eindeutigkeit in der Datenbank.
 */
export async function benutzernameFrei(name: string): Promise<boolean | 'netz' | null> {
  const { data, error } = await supabase.rpc('benutzername_frei', { p_name: name.trim() })
    .then(r => r, (err: unknown) => ({ data: null, error: err }))
  // Ohne Code kam die Anfrage nicht an; mit Code (etwa: Funktion fehlt) ist es nicht zu entscheiden
  if (error) return (error as { code?: string }).code ? null : 'netz'
  return typeof data === 'boolean' ? data : null
}
