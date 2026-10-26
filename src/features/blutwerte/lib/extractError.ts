import { EINWILLIGUNG_FEHLT } from './aiConsent'

/**
 * Fehler der Edge Function `bloodwork-extract` — ein Code und der
 * Uebersetzungsschluessel fuer den Toast. Gemeinsam fuer Import und
 * Befund-Editor.
 */
export interface ExtraktionsFehler {
  code: string | null
  schluessel: string
}

async function fehlerCode(response: Response): Promise<string | null> {
  try {
    const body = await response.clone().json()
    return typeof body?.error === 'string' ? body.error : null
  } catch {
    return null
  }
}

export async function beschreibeExtraktionsFehler(response: Response | undefined): Promise<ExtraktionsFehler> {
  if (!response) return { code: null, schluessel: 'bw_err_extract' }
  const code = await fehlerCode(response)
  if (code === EINWILLIGUNG_FEHLT) return { code, schluessel: 'ai_consent_required' }
  if (response.status === 429 || code === 'rate_limit') return { code, schluessel: 'bw_err_limit' }
  if (response.status === 413 || code === 'file_too_large') return { code, schluessel: 'bw_err_too_large' }
  if (code === 'no_bloodwork_found') return { code, schluessel: 'bw_no_report_found' }
  return { code, schluessel: 'bw_err_extract' }
}
