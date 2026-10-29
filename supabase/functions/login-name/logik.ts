/**
 * Prüfbare Teile von `login-name` (ohne Deno, ohne Netz).
 */

/** Dieselbe Antwort für unbekannten Namen und falsches Passwort. */
export const FALSCH = 'invalid_credentials'

// Wie in der App (src/features/auth/lib/pruefung.ts)
const BENUTZERNAME = /^[A-Za-z0-9._]{3,20}$/
const MAX_PASSWORT = 200

export interface Eingabe { name: string; passwort: string }

export function pruefeEingabe(body: unknown): Eingabe | null {
  if (!body || typeof body !== 'object') return null
  const { name, passwort } = body as Record<string, unknown>
  if (typeof name !== 'string' || typeof passwort !== 'string') return null
  const n = name.trim()
  if (!BENUTZERNAME.test(n) || !passwort || passwort.length > MAX_PASSWORT) return null
  return { name: n, passwort }
}
