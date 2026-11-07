/**
 * Zustimmung zu Alter (18+), Nutzungsbedingungen und Datenschutz.
 *
 * Die Stores verlangen beides, bevor jemand Inhalte veroeffentlichen kann
 * (Apple 1.2, Google „User Generated Content"), und die Altersfreigabe der
 * App ist 18+. Gespeichert wird in `profiles` mit Zeitpunkt und Fassung der
 * Bedingungen. Aendern sich die Bedingungen wesentlich, wird `TERMS_VERSION`
 * hochgezaehlt — dann fragt die App beim naechsten Start erneut.
 *
 * Fassungen: 2026-10 erste Fassung; 2026-11 Datenschutz Abschnitt 6 um die
 * Web-Seite /u/<name> ergaenzt (was ohne Anmeldung sichtbar ist, Link-Karte,
 * Zwischenspeicher, Suchmaschinen, Melden ohne Konto; Profil 2c).
 */

import { geburtsdatumGueltig, heuteIso } from '../../blutwerte/lib/bioProfile'
import { alterAm } from '../../blutwerte/lib/referenzbereiche'

export const TERMS_VERSION = '2026-11'

/** Hoku ist erst ab 18 (Altersfreigabe der App). */
export const MINDESTALTER = 18

/**
 * Geburtsdatum bei Registrierung und Zustimmung: Pflicht, echtes Datum, mindestens 18.
 * Liefert den Text-Schlüssel des Fehlers oder null. `heute` als YYYY-MM-DD (lokal).
 */
export function pruefeGeburtsdatum(wert: string, heute: string): string | null {
  if (!wert) return 'login_err_birth_empty'
  if (!geburtsdatumGueltig(wert, heute)) return 'login_err_birth_bad'
  const alter = alterAm(wert, heute)
  return alter !== null && alter >= MINDESTALTER ? null : 'login_err_birth_young'
}

/** Heutiges Datum in der Zeitzone des Geräts, YYYY-MM-DD (dieselbe Regel wie im Körperprofil). */
export const heuteLokal = heuteIso

/** Spalten für `profiles` aus dem Geburtsdatum (das alte Feld `age` wird mitgeführt, s. bioProfile). */
export function geburtsdatumZeile(wert: string, heute: string): { birth_date: string; age: number | null } {
  return { birth_date: wert, age: alterAm(wert, heute) }
}

/** Gültiges Geburtsdatum (ab 18) aus den Konto-Metadaten der Registrierung, sonst null. */
export function geburtsdatumAusMetadaten(meta: Record<string, unknown> | null | undefined, heute: string): string | null {
  const wert = meta?.birth_date
  return typeof wert === 'string' && !pruefeGeburtsdatum(wert, heute) ? wert : null
}

export interface ConsentRow {
  age_confirmed_at: string | null
  terms_accepted_at: string | null
  terms_version: string | null
}

/** true, wenn der Nutzer (erneut) zustimmen muss. */
export function zustimmungFehlt(row: ConsentRow | null | undefined): boolean {
  if (!row) return true
  return !row.age_confirmed_at || !row.terms_accepted_at || row.terms_version !== TERMS_VERSION
}

/** Die Felder fuer `profiles` (und die Metadaten bei der Registrierung). */
export function zustimmungsZeile(now: Date): ConsentRow {
  const zeit = now.toISOString()
  return { age_confirmed_at: zeit, terms_accepted_at: zeit, terms_version: TERMS_VERSION }
}

/**
 * Bei der Registrierung steht die Zustimmung in den Konto-Metadaten — auch
 * dann, wenn das Profil noch nicht geschrieben werden konnte (etwa weil die
 * E-Mail erst bestaetigt werden muss). Beim ersten Start wird sie von dort
 * ins Profil uebernommen, statt erneut zu fragen.
 */
export function zustimmungAusMetadaten(meta: Record<string, unknown> | null | undefined): ConsentRow | null {
  if (!meta) return null
  const row: ConsentRow = {
    age_confirmed_at: typeof meta.age_confirmed_at === 'string' ? meta.age_confirmed_at : null,
    terms_accepted_at: typeof meta.terms_accepted_at === 'string' ? meta.terms_accepted_at : null,
    terms_version: typeof meta.terms_version === 'string' ? meta.terms_version : null,
  }
  return zustimmungFehlt(row) ? null : row
}

/**
 * Die zwei Haekchen der Registrierung bzw. der Zustimmungsseite. Das Alter
 * bestaetigt das Geburtsdatum (ab 18, `pruefeGeburtsdatum`); ein eigenes
 * Haekchen dafuer gibt es seit November 2026 nicht mehr (Nutzer).
 */
export interface ConsentState {
  bedingungen: boolean
  gesundheit: boolean
}

export const KEINE_ZUSTIMMUNG: ConsentState = { bedingungen: false, gesundheit: false }

export function vollstaendig(state: ConsentState): boolean {
  return state.bedingungen && state.gesundheit
}
