import { supabase } from '../../../lib/supabase'
import { serverFehler } from './pruefung'

/**
 * Bestätigen per Code aus der Mail (docs/registrierung/PLAN.md): nach dem Registrieren und
 * bei „Passwort vergessen". Die Mails verschickt die Edge Function `auth-mail` über Resend;
 * hier liegt nur, was die App mit dem Code tut. Kein Link — die App läuft nativ, ein Link
 * würde im Browser statt in der App landen.
 */

/** Wie viele Ziffern der Code hat (Supabase: „Email OTP Length"). */
export const CODE_LAENGE = 6
/** So lange gilt ein Code (Supabase: „Email OTP Expiration" 900 s, auth-mail: OTP_MINUTEN). */
export const CODE_GUELTIG_MIN = 15
/** So lange ist „Neuen Code senden" nach dem Senden gesperrt. */
export const NEU_SPERRE_MS = 60_000

/** `signup`: E-Mail bestätigen nach dem Registrieren; `recovery`: Passwort vergessen. */
export type CodeArt = 'signup' | 'recovery'
/** `falsch`: Code stimmt nicht oder ist abgelaufen (Supabase unterscheidet das nicht). */
export type CodeFehler = 'falsch' | 'viele' | 'netz' | 'fehler'

/** Nur Ziffern, höchstens so viele, wie der Code hat — auch beim Einfügen von „Code: 123 456". */
export const nurZiffern = (text: string) => text.replace(/\D/g, '').slice(0, CODE_LAENGE)

/** Fehler von Supabase Auth einordnen. */
export function codeFehler(error: unknown, online?: boolean): CodeFehler {
  const e = error as { status?: number; code?: string } | null
  if (e?.status === 429 || (typeof e?.code === 'string' && e.code.includes('rate_limit'))) return 'viele'
  const art = serverFehler(error, online)
  if (art === 'netz') return 'netz'
  return e?.status && e.status < 500 ? 'falsch' : 'fehler'
}

/** Anmelden mit unbestätigter Adresse: Supabase sagt es mit diesem Code. */
export const istUnbestaetigt = (error: unknown) => (error as { code?: string } | null)?.code === 'email_not_confirmed'

/**
 * Mit „Confirm email" meldet Supabase eine schon vergebene Adresse nicht als Fehler, sondern
 * liefert ein Konto ohne Anmeldewege (Schutz gegen Ausforschen). Die App sagt es trotzdem —
 * sie verrät vergebene Namen und Adressen schon heute (login_err_exists).
 */
export const kontoVorhanden = (user: { identities?: unknown[] } | null | undefined) =>
  Array.isArray(user?.identities) && user.identities.length === 0

/** Sekunden bis „Neuen Code senden" wieder geht. */
export const restSekunden = (bis: number, jetzt: number) => Math.max(0, Math.ceil((bis - jetzt) / 1000))
/** 75 → „1:15" */
export const alsUhr = (sekunden: number) => `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`

/** Code prüfen; bei Erfolg steht danach die Sitzung. */
export async function codePruefen(email: string, code: string, art: CodeArt): Promise<CodeFehler | null> {
  const r = await supabase.auth.verifyOtp({ email, token: code, type: art === 'signup' ? 'email' : 'recovery' })
    .then(x => x, (err: unknown) => ({ data: { session: null }, error: err }))
  if (r.error) return codeFehler(r.error)
  return r.data.session ? null : 'fehler'
}

/**
 * Einen (neuen) Code schicken lassen. Bei `recovery` antwortet Supabase auch für unbekannte
 * Adressen gleich — die App sagt deshalb nie, ob es ein Konto gibt.
 */
export async function codeSenden(email: string, art: CodeArt): Promise<CodeFehler | null> {
  const r = await (art === 'signup'
    ? supabase.auth.resend({ type: 'signup', email })
    : supabase.auth.resetPasswordForEmail(email)
  ).then(x => x, (err: unknown) => ({ error: err }))
  return r.error ? codeFehler(r.error) : null
}

/** Neues Passwort nach „Passwort vergessen" (die Sitzung kommt aus dem Code). */
export async function passwortSetzen(passwort: string): Promise<CodeFehler | 'gleich' | 'schwach' | null> {
  const r = await supabase.auth.updateUser({ password: passwort })
    .then(x => x, (err: unknown) => ({ error: err }))
  if (!r.error) return null
  const code = (r.error as { code?: string }).code
  if (code === 'same_password') return 'gleich'
  if (code === 'weak_password') return 'schwach'
  return codeFehler(r.error)
}
