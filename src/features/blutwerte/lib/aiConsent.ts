/**
 * Einwilligung in die KI-Auswertung von Befunden.
 *
 * Der Import schickt Foto oder PDF an Anthropic (Edge Function
 * `bloodwork-extract`). Vorher muss der Nutzer ausdruecklich einwilligen
 * (Apple 5.1.2(i), Art. 9 DSGVO); gespeichert in
 * `profiles.ai_import_consent_at`, null heisst nicht erteilt oder widerrufen.
 * Die Edge Function prueft dasselbe Feld — die App ist nur die Oberflaeche.
 */

interface QueryError { message: string }

export interface ConsentClient {
  from(table: 'profiles'): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: { ai_import_consent_at: string | null } | null; error: QueryError | null }>
      }
    }
    update(values: { ai_import_consent_at: string | null }): {
      eq(column: string, value: string): {
        select(columns: 'ai_import_consent_at'): PromiseLike<{ data: { ai_import_consent_at: string | null }[] | null; error: QueryError | null }>
      }
    }
  }
}

/** Zeitpunkt der Einwilligung oder null. Wirft bei Lesefehlern. */
export async function ladeKiEinwilligung(client: ConsentClient, userId: string): Promise<string | null> {
  const { data, error } = await client.from('profiles').select('ai_import_consent_at').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.ai_import_consent_at ?? null
}

/**
 * Einwilligung erteilen oder widerrufen (null). Den Zeitpunkt setzt die
 * Datenbank (Trigger `profiles_stamp_ai_import_consent`); zurueck kommt der
 * gespeicherte Wert. Wird keine Zeile getroffen (kein Profil), ist nichts
 * gespeichert — das ist ein Fehler, kein Erfolg.
 */
export async function setzeKiEinwilligung(client: ConsentClient, userId: string, zeitpunkt: Date | null): Promise<string | null> {
  const wert = zeitpunkt ? zeitpunkt.toISOString() : null
  const { data, error } = await client.from('profiles').update({ ai_import_consent_at: wert }).eq('id', userId).select('ai_import_consent_at')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('profil_fehlt')
  return data[0].ai_import_consent_at
}

/** Der Fehlercode der Edge Function, wenn die Einwilligung fehlt. */
export const EINWILLIGUNG_FEHLT = 'consent_required'

/**
 * Ab hier nennt der Einwilligungstext auch Etikettfotos (Substanz-Scan in My
 * Stack). Eine aeltere Einwilligung galt nur Befunden: fuer den Scan wird neu
 * gefragt. Gleicher Wert in `supabase/functions/label-extract/prompt.ts`
 * (`LABEL_CONSENT_SINCE`) — die Funktion setzt ihn durch, die App fragt vorher.
 */
export const ETIKETT_EINWILLIGUNG_AB = '2026-10-19T00:00:00.000Z'

/** Deckt die Einwilligung (Zeitpunkt oder null) auch Etikettfotos? */
export function giltFuerEtiketten(einwilligung: string | null): boolean {
  return einwilligung !== null && Date.parse(einwilligung) >= Date.parse(ETIKETT_EINWILLIGUNG_AB)
}
