import { supabase } from '../../../lib/supabase'
import { serverFehler, type ServerFehler } from './pruefung'
import { merkeAngemeldetBleiben } from './sitzung'

/**
 * Apple und Google über Supabase-OAuth (Web/PWA): Weiterleitung zum Anbieter,
 * zurück auf /auth?anbieter=<name>. Die Knöpfe erscheinen erst, wenn der
 * Anbieter in Supabase eingerichtet ist und das Build es weiß
 * (VITE_AUTH_APPLE=1, VITE_AUTH_GOOGLE=1; Anleitung: docs/login/ANBIETER.md).
 */

export type Anbieter = 'apple' | 'google'

export const ANBIETER: Anbieter[] = [
  ...(import.meta.env.VITE_AUTH_APPLE === '1' ? ['apple' as const] : []),
  ...(import.meta.env.VITE_AUTH_GOOGLE === '1' ? ['google' as const] : []),
]

const PARAM = 'anbieter'

/** Zum Anbieter weiterleiten. Kommt die Seite zurück, war es ein Fehler vor der Weiterleitung. */
export async function mitAnbieter(anbieter: Anbieter): Promise<ServerFehler | null> {
  // Apple, Google (und Face ID) bleiben angemeldet
  merkeAngemeldetBleiben(true)
  const redirectTo = `${window.location.origin}/auth?${PARAM}=${anbieter}`
  const { error } = await supabase.auth.signInWithOAuth({ provider: anbieter, options: { redirectTo } })
    .then(r => r, (err: unknown) => ({ error: err }))
  return error ? serverFehler(error) : null
}

/** `abgebrochen`: die Person hat beim Anbieter selbst abgebrochen (kein Fehler, Hoku zeigt kein X). */
export interface Rueckkehr { anbieter: Anbieter | null; fehler: boolean; abgebrochen: boolean }

/** Kommt die Seite vom Anbieter zurück, und mit welchem Ausgang? */
export function rueckkehr(search: string, hash: string): Rueckkehr {
  const q = new URLSearchParams(search), h = new URLSearchParams(hash.replace(/^#/, ''))
  const name = q.get(PARAM)
  const anbieter = name === 'apple' || name === 'google' ? name : null
  const fehler = q.get('error') || h.get('error'), abgebrochen = fehler === 'access_denied'
  return { anbieter, fehler: !!fehler && !abgebrochen, abgebrochen }
}
