import { describe, expect, it } from 'vitest'
import { beschreibeExtraktionsFehler } from './extractError'

const antwort = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

describe('Fehler der Befund-Auswertung', () => {
  it('erkennt die fehlende Einwilligung', async () => {
    expect(await beschreibeExtraktionsFehler(antwort(403, { error: 'consent_required' }))).toEqual({ code: 'consent_required', schluessel: 'ai_consent_required' })
  })

  it('nennt Limit, Groesse und „kein Befund"', async () => {
    expect((await beschreibeExtraktionsFehler(antwort(429, { error: 'rate_limit' }))).schluessel).toBe('bw_err_limit')
    expect((await beschreibeExtraktionsFehler(antwort(413, {}))).schluessel).toBe('bw_err_too_large')
    expect((await beschreibeExtraktionsFehler(antwort(422, { error: 'no_bloodwork_found' }))).schluessel).toBe('bw_no_report_found')
  })

  it('faellt ohne Antwort oder bei Unbekanntem auf den allgemeinen Text zurueck', async () => {
    expect(await beschreibeExtraktionsFehler(undefined)).toEqual({ code: null, schluessel: 'bw_err_extract' })
    expect((await beschreibeExtraktionsFehler(antwort(500, 'kaputt'))).schluessel).toBe('bw_err_extract')
  })
})
